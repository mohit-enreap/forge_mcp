import Resolver from '@forge/resolver';
import fetch from 'node-fetch';

const resolver = new Resolver();

async function getMCPTools(mcpUrl) {
  try {
    const res = await fetch(`${mcpUrl}/tools/list`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-tunnel-authorization': 'bypass'
      },
      body: JSON.stringify({})
    });
    const data = await res.json();
    const tools = data.tools || [];
    console.log('MCP tools loaded:', tools.length);
    return tools;
  } catch (err) {
    console.error('getMCPTools error:', err.message);
    return [];
  }
}

async function callMCPTool(mcpUrl, toolName, toolArgs) {
  try {
    console.log('Calling MCP tool:', toolName, JSON.stringify(toolArgs));
    const res = await fetch(`${mcpUrl}/tools/call`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-tunnel-authorization': 'bypass'
      },
      body: JSON.stringify({
        name: toolName,
        arguments: toolArgs
      })
    });
    const data = await res.json();
    console.log('MCP result:', JSON.stringify(data).substring(0, 300));
    return data;
  } catch (err) {
    console.error('callMCPTool error:', err.message);
    return { error: err.message };
  }
}

function selectRelevantTools(allTools, message) {
  const msg = message.toLowerCase();
  let toolNames = [];

  if (msg.includes('jira') || msg.includes('issue') ||
      msg.includes('task') || msg.includes('ticket') ||
      msg.includes('bug') || msg.includes('sprint') ||
      msg.includes('list') || msg.includes('show') ||
      msg.includes('create') || msg.includes('add')) {
    toolNames = [
      'search_jira_issues',
      'create_jira_issue',
      'read_jira_issue',
      'list_jira_projects',
      'get_jira_current_user',
      'add_jira_comment'
    ];
  } else if (msg.includes('confluence') || msg.includes('page') ||
             msg.includes('doc') || msg.includes('space') ||
             msg.includes('search') || msg.includes('find')) {
    toolNames = [
      'search_confluence_pages',
      'read_confluence_page',
      'list_confluence_spaces',
      'create_confluence_page',
      'get_confluence_current_user'
    ];
  } else {
    toolNames = [
      'search_jira_issues',
      'create_jira_issue',
      'search_confluence_pages',
      'list_jira_projects',
      'read_confluence_page'
    ];
  }

  const filtered = allTools.filter(t => toolNames.includes(t.name));
  console.log('Selected tools:', filtered.map(t => t.name).join(', '));
  return filtered;
}

function mcpToolsToGroqFormat(mcpTools) {
  return mcpTools.map(tool => ({
    type: 'function',
    function: {
      name: tool.name,
      description: tool.description || '',
      parameters: tool.inputSchema || {
        type: 'object',
        properties: {},
        required: []
      }
    }
  }));
}

async function callGroq(messages, apiKey, tools = []) {
  const body = {
    model: 'llama-3.3-70b-versatile',
    messages: [
      {
        role: 'system',
        content: `You are a helpful AI assistant embedded inside 
Atlassian Confluence. You have Jira and Confluence tools.

IMPORTANT tool usage rules:
- To list or show Jira issues → use search_jira_issues with ONLY jql parameter
  Example: { "jql": "project = KAN ORDER BY created DESC" }
- To show open/unresolved issues → { "jql": "project = KAN AND resolution = Unresolved ORDER BY created DESC" }
- To show done issues → { "jql": "project = KAN AND status = Done ORDER BY created DESC" }
- To create a ticket → use create_jira_issue with summary, issue_type, priority
- To search Confluence pages → use search_confluence_pages with query
- To read a page → use read_confluence_page
- To list projects → use list_jira_projects with NO parameters

NEVER include fields, maxResults, or startAt in search_jira_issues calls.
ONLY pass the jql parameter for search_jira_issues.

Always summarize tool results clearly in plain English.
For general questions answer directly without tools.`
      },
      ...messages
    ],
    max_tokens: 1024,
    temperature: 0.7,
  };

  if (tools.length > 0) {
    body.tools = tools;
    body.tool_choice = 'auto';
  }

  console.log('Calling Groq with', tools.length, 'tools');

  const response = await fetch(
    'https://api.groq.com/openai/v1/chat/completions',
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify(body)
    }
  );

  if (response.status === 429) {
    throw new Error('RATE_LIMITED');
  }

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Groq error ${response.status}: ${err}`);
  }

  return response.json();
}

resolver.define('chat', async (req) => {
  const { message, history } = req.payload;
  const apiKey = process.env.GROQ_API_KEY;
  const mcpUrl = process.env.MCP_SERVER_URL;

  console.log('Chat request:', message);

  if (!apiKey) {
    return { error: true, text: 'Groq API key not configured.' };
  }
  if (!mcpUrl) {
    return { error: true, text: 'MCP server URL not configured.' };
  }

  try {
    const allTools = await getMCPTools(mcpUrl);
    const relevantTools = selectRelevantTools(allTools, message);
    const groqTools = mcpToolsToGroqFormat(relevantTools);
    console.log('Using', groqTools.length, 'relevant tools');

    const messages = buildMessages(history || [], message);
    let currentMessages = [...messages];
    let iterations = 0;
    const MAX_ITER = 5;

    while (iterations < MAX_ITER) {
      iterations++;
      console.log('Groq iteration:', iterations);

      const groqResponse = await callGroq(
        currentMessages, apiKey, groqTools
      );

      const choice = groqResponse.choices?.[0];
      const responseMessage = choice?.message;
      const finishReason = choice?.finish_reason;

      console.log('Finish reason:', finishReason);

      if (finishReason === 'tool_calls' && responseMessage?.tool_calls) {
        const toolCall = responseMessage.tool_calls[0];
        const toolName = toolCall.function.name;
        const toolArgs = JSON.parse(toolCall.function.arguments || '{}');

        console.log('Tool:', toolName, JSON.stringify(toolArgs));

        const toolResult = await callMCPTool(mcpUrl, toolName, toolArgs);

        currentMessages = [
          ...currentMessages,
          {
            role: 'assistant',
            content: null,
            tool_calls: responseMessage.tool_calls
          },
          {
            role: 'tool',
            tool_call_id: toolCall.id,
            content: JSON.stringify(toolResult)
          }
        ];
        continue;
      }

      const text = responseMessage?.content;
      if (text) {
        console.log('Final answer received');
        return { error: false, text };
      }

      return { error: true, text: 'Empty response received.' };
    }

    return {
      error: true,
      text: 'Could not complete the request. Please try again.'
    };

  } catch (err) {
    console.error('Chat error:', err.message);
    if (err.message === 'RATE_LIMITED') {
      return {
        error: true,
        text: 'Too many requests. Please wait a moment and try again.'
      };
    }
    return { error: true, text: `Error: ${err.message}` };
  }
});

function buildMessages(history, newMessage) {
  const messages = [];
  for (const msg of history) {
    messages.push({
      role: msg.role === 'user' ? 'user' : 'assistant',
      content: msg.content
    });
  }
  messages.push({
    role: 'user',
    content: newMessage
  });
  return messages;
}

export const handler = resolver.getDefinitions();