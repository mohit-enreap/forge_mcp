require('dotenv').config();
const express = require('express');
const { Client } = require('@modelcontextprotocol/sdk/client/index.js');
const { StdioClientTransport } = require('@modelcontextprotocol/sdk/client/stdio.js');

const app = express();
app.use(express.json());

let mcpClient = null;
let toolsCache = null;

async function getMCPClient() {
  if (mcpClient) return mcpClient;
  console.log('Connecting to MCP server via stdio...');
  const transport = new StdioClientTransport({
    command: 'npx',
    args: ['mcp-atlassian'],
    env: {
      ...process.env,
      ATLASSIAN_BASE_URL: process.env.ATLASSIAN_BASE_URL,
      ATLASSIAN_EMAIL: process.env.ATLASSIAN_EMAIL,
      ATLASSIAN_API_TOKEN: process.env.ATLASSIAN_API_TOKEN,
    }
  });
  mcpClient = new Client(
    { name: 'mcp-bridge', version: '1.0.0' },
    { capabilities: {} }
  );
  await mcpClient.connect(transport);
  console.log('Connected to MCP server successfully!');
  return mcpClient;
}

async function directJiraSearch(jql) {
  const fetch = (await import('node-fetch')).default;
  const baseUrl = process.env.ATLASSIAN_BASE_URL;
  const email = process.env.ATLASSIAN_EMAIL;
  const token = process.env.ATLASSIAN_API_TOKEN;
  const auth = Buffer.from(`${email}:${token}`).toString('base64');

  // Fix unbounded JQL
  let cleanJql = jql || '';
  cleanJql = cleanJql.replace(
    /assignee\s*=\s*currentUser\(\)/gi,
    `assignee="${email}"`
  );
  if (cleanJql.trim().startsWith('ORDER BY') || cleanJql.trim() === '') {
    cleanJql = `project = KAN ORDER BY created DESC`;
  }

  console.log('Direct Jira search JQL:', cleanJql);

  // Step 1 — Get issue IDs
  const searchUrl = `${baseUrl}/rest/api/3/search/jql?jql=${encodeURIComponent(cleanJql)}&maxResults=10`;
  const searchRes = await fetch(searchUrl, {
    headers: { 'Authorization': `Basic ${auth}`, 'Accept': 'application/json' }
  });
  const searchData = await searchRes.json();
  console.log('Issues found:', searchData.issues?.length || 0);

  if (!searchData.issues || searchData.issues.length === 0) {
    return { content: [{ type: 'text', text: 'No Jira issues found.' }] };
  }

  // Step 2 — Fetch full details for each issue
  const issues = await Promise.all(
    searchData.issues.map(async (issue) => {
      const issueRes = await fetch(
        `${baseUrl}/rest/api/3/issue/${issue.id}?fields=summary,status,priority,issuetype,assignee`,
        {
          headers: { 'Authorization': `Basic ${auth}`, 'Accept': 'application/json' }
        }
      );
      const issueData = await issueRes.json();
      return {
        key: issueData.key,
        summary: issueData.fields?.summary,
        status: issueData.fields?.status?.name,
        priority: issueData.fields?.priority?.name,
        type: issueData.fields?.issuetype?.name,
        assignee: issueData.fields?.assignee?.displayName || 'Unassigned'
      };
    })
  );

  console.log('First issue:', JSON.stringify(issues[0]));

  return {
    content: [{
      type: 'text',
      text: JSON.stringify({ issues, total: issues.length })
    }]
  };
}

async function directJiraCreate(args) {
  const fetch = (await import('node-fetch')).default;
  const baseUrl = process.env.ATLASSIAN_BASE_URL;
  const email = process.env.ATLASSIAN_EMAIL;
  const token = process.env.ATLASSIAN_API_TOKEN;
  const auth = Buffer.from(`${email}:${token}`).toString('base64');

  const body = {
    fields: {
      project: { key: 'KAN' },
      summary: args.summary,
      description: {
        type: 'doc', version: 1,
        content: [{
          type: 'paragraph',
          content: [{ type: 'text', text: args.description || args.summary }]
        }]
      },
      issuetype: { name: args.issue_type || args.issueType || 'Task' },
      priority: { name: args.priority || 'Medium' }
    }
  };

  const res = await fetch(`${baseUrl}/rest/api/3/issue`, {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${auth}`,
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    },
    body: JSON.stringify(body)
  });

  const data = await res.json();
  console.log('Create issue response:', JSON.stringify(data));

  if (data.errors || data.errorMessages) {
    return {
      content: [{
        type: 'text',
        text: `Error: ${JSON.stringify(data.errors || data.errorMessages)}`
      }],
      isError: true
    };
  }

  return {
    content: [{
      type: 'text',
      text: `Successfully created issue ${data.key}: ${args.summary}`
    }]
  };
}

app.post('/tools/list', async (req, res) => {
  try {
    const client = await getMCPClient();
    if (!toolsCache) {
      const result = await client.listTools();
      toolsCache = result.tools;

      // Fix search_jira_issues schema — remove extra params
      const searchTool = toolsCache.find(t => t.name === 'search_jira_issues');
      if (searchTool?.inputSchema?.properties) {
        // Only keep jql — remove fields, maxResults, startAt
        searchTool.inputSchema.properties = {
          jql: {
            type: 'string',
            description: 'JQL query string to search Jira issues. Example: project = KAN ORDER BY created DESC'
          }
        };
        searchTool.inputSchema.required = ['jql'];
        console.log('Fixed search_jira_issues schema — jql only');
      }

      // Fix list_jira_projects schema
      const projectsTool = toolsCache.find(t => t.name === 'list_jira_projects');
      if (projectsTool?.inputSchema?.properties?.expand) {
        projectsTool.inputSchema.properties.expand = {
          type: 'string',
          description: 'Fields to expand (optional)'
        };
        console.log('Fixed list_jira_projects schema');
      }

      console.log(`Loaded ${toolsCache.length} tools`);
    }
    res.json({ tools: toolsCache });
  } catch (err) {
    console.error('list tools error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

app.post('/tools/call', async (req, res) => {
  try {
    const { name, arguments: args } = req.body;
    console.log('Tool call:', name, JSON.stringify(args));

    // Intercept and handle directly
    if (name === 'search_jira_issues') {
      const jql = args?.jql || 'project = KAN ORDER BY created DESC';
      const result = await directJiraSearch(jql);
      return res.json(result);
    }

    if (name === 'create_jira_issue') {
      const result = await directJiraCreate(args);
      return res.json(result);
    }

    // All other tools — pass through to MCP
    const client = await getMCPClient();
    const result = await client.callTool({ name, arguments: args });
    console.log('MCP result:', JSON.stringify(result).substring(0, 200));
    res.json(result);
  } catch (err) {
    console.error('call tool error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    mcp: mcpClient ? 'connected' : 'disconnected',
    tools: toolsCache?.length || 0
  });
});

app.get('/test-jira', async (req, res) => {
  const fetch = (await import('node-fetch')).default;
  const baseUrl = process.env.ATLASSIAN_BASE_URL;
  const email = process.env.ATLASSIAN_EMAIL;
  const token = process.env.ATLASSIAN_API_TOKEN;
  const auth = Buffer.from(`${email}:${token}`).toString('base64');
  const url = `${baseUrl}/rest/api/3/search/jql?jql=project%20%3D%20KAN%20ORDER%20BY%20created%20DESC&maxResults=5`;
  const response = await fetch(url, {
    headers: { 'Authorization': `Basic ${auth}`, 'Accept': 'application/json' }
  });
  const data = await response.json();
  res.json({ status: response.status, count: data.issues?.length, data });
});

const PORT = process.env.PORT || 3333;
app.listen(PORT, () => {
  console.log(`MCP Bridge running on http://localhost:${PORT}`);
});
