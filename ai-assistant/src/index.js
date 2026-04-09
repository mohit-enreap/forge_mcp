import Resolver from "@forge/resolver";
import api from "@forge/api";
import { kvs } from "@forge/kvs";

const resolver = new Resolver();

async function getCredentials() {
  const baseUrl = await kvs.get("atlassian_base_url");
  const email = await kvs.get("atlassian_email");
  const token = await kvs.get("atlassian_api_token");
  return { baseUrl, email, token };
}

function buildHeaders(email, token) {
  const base64 = Buffer.from(`${email}:${token}`).toString("base64");
  return {
    Authorization: `Basic ${base64}`,
    Accept: "application/json",
    "Content-Type": "application/json",
  };
}

resolver.define("saveSettings", async (req) => {
  const { baseUrl, email, token } = req.payload;
  try {
    await kvs.set("atlassian_base_url", baseUrl.trim());
    await kvs.set("atlassian_email", email.trim());
    await kvs.set("atlassian_api_token", token.trim());
    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

resolver.define("getSettings", async () => {
  try {
    const { baseUrl, email, token } = await getCredentials();
    return {
      configured: !!(baseUrl && email && token),
      baseUrl: baseUrl || "",
      email: email || "",
    };
  } catch (err) {
    return { configured: false, baseUrl: "", email: "" };
  }
});

resolver.define("clearSettings", async () => {
  try {
    await kvs.delete("atlassian_base_url");
    await kvs.delete("atlassian_email");
    await kvs.delete("atlassian_api_token");
    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

function needsTools(message) {
  const msg = message.toLowerCase();
  return (
    msg.includes("jira") ||
    msg.includes("issue") ||
    msg.includes("ticket") ||
    msg.includes("bug") ||
    msg.includes("task") ||
    msg.includes("sprint") ||
    msg.includes("list") ||
    msg.includes("show") ||
    msg.includes("create") ||
    msg.includes("open") ||
    msg.includes("assign") ||
    msg.includes("reassign") ||
    msg.includes("project") ||
    msg.includes("confluence") ||
    msg.includes("page") ||
    msg.includes("space") ||
    msg.includes("doc") ||
    msg.includes("search") ||
    msg.includes("find") ||
    msg.includes("comment") ||
    msg.includes("status") ||
    msg.includes("priority") ||
    msg.includes("update") ||
    msg.includes("change") ||
    msg.includes("move") ||
    msg.includes("explain") ||
    msg.includes("detail") ||
    msg.includes("done") ||
    msg.includes("progress") ||
    msg.includes("kan-") ||
    msg.includes("user") ||
    msg.includes("member") ||
    msg.includes("people") ||
    msg.includes("who") ||
    msg.includes("workspace")
  );
}

// ── Jira: Search Issues ──
async function jiraSearch(jql, baseUrl, email, token) {
  try {
    let cleanJql = jql?.trim();

    if (!cleanJql || !cleanJql.toLowerCase().includes("project")) {
      const projRes = await api.fetch(
        `${baseUrl}/rest/api/3/project?maxResults=50`,
        { headers: buildHeaders(email, token) },
      );
      const projData = await projRes.json();
      const projectKeys = Array.isArray(projData)
        ? projData.filter((p) => p.key).map((p) => p.key)
        : [];

      if (projectKeys.length > 0) {
        const projectFilter = `project in (${projectKeys.map((k) => `"${k}"`).join(",")})`;
        if (!cleanJql) {
          cleanJql = `${projectFilter} ORDER BY created DESC`;
        } else if (cleanJql.trim().toUpperCase().startsWith("ORDER BY")) {
          cleanJql = `${projectFilter} ${cleanJql}`;
        } else {
          cleanJql = `${projectFilter} AND ${cleanJql}`;
        }
      } else {
        cleanJql = cleanJql || "ORDER BY created DESC";
      }
    }

    console.log("Jira search JQL (final):", cleanJql);

    const res = await api.fetch(
      `${baseUrl}/rest/api/3/search/jql?jql=${encodeURIComponent(cleanJql)}&maxResults=15&fields=summary,status,priority,issuetype,assignee`,
      { headers: buildHeaders(email, token) },
    );
    const data = await res.json();
    console.log("Jira raw:", JSON.stringify(data).substring(0, 300));

    if (data.errorMessages?.length || data.errors) {
      return {
        content: [
          {
            type: "text",
            text: `Jira error: ${JSON.stringify(data.errorMessages || data.errors)}`,
          },
        ],
      };
    }
    if (!data.issues?.length) {
      return { content: [{ type: "text", text: "No Jira issues found." }] };
    }
    const issues = data.issues.map((issue) => ({
      key: issue.key,
      summary: issue.fields?.summary,
      status: issue.fields?.status?.name,
      priority: issue.fields?.priority?.name,
      type: issue.fields?.issuetype?.name,
      assignee: issue.fields?.assignee?.displayName || "Unassigned",
    }));
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify({ issues, total: issues.length }),
        },
      ],
    };
  } catch (err) {
    console.error("jiraSearch error:", err.message);
    return { content: [{ type: "text", text: `Error: ${err.message}` }] };
  }
}

// ── Jira: Create Issue ──
async function jiraCreate(args, baseUrl, email, token) {
  try {
    let projectKey = args.project_key;
    if (!projectKey) {
      const projRes = await api.fetch(
        `${baseUrl}/rest/api/3/project?maxResults=1`,
        { headers: buildHeaders(email, token) },
      );
      const projData = await projRes.json();
      projectKey = Array.isArray(projData) ? projData?.[0]?.key : null;
    }

    if (!projectKey) {
      return { content: [{ type: "text", text: "No Jira project found." }] };
    }

    const res = await api.fetch(`${baseUrl}/rest/api/3/issue`, {
      method: "POST",
      headers: buildHeaders(email, token),
      body: JSON.stringify({
        fields: {
          project: { key: projectKey },
          summary: args.summary,
          description: {
            type: "doc",
            version: 1,
            content: [
              {
                type: "paragraph",
                content: [
                  { type: "text", text: args.description || args.summary },
                ],
              },
            ],
          },
          issuetype: { name: args.issue_type || "Task" },
          priority: { name: args.priority || "Medium" },
        },
      }),
    });
    const data = await res.json();
    if (data.errors || data.errorMessages) {
      return {
        content: [
          {
            type: "text",
            text: `Error: ${JSON.stringify(data.errors || data.errorMessages)}`,
          },
        ],
        isError: true,
      };
    }
    return {
      content: [
        { type: "text", text: `Created issue ${data.key}: ${args.summary}` },
      ],
    };
  } catch (err) {
    return {
      content: [{ type: "text", text: `Error: ${err.message}` }],
      isError: true,
    };
  }
}

// ── Jira: Read Issue ──
async function jiraReadIssue(issueKey, baseUrl, email, token) {
  try {
    const res = await api.fetch(
      `${baseUrl}/rest/api/3/issue/${issueKey}?fields=summary,status,priority,issuetype,assignee,reporter,created,updated`,
      { headers: buildHeaders(email, token) },
    );
    const data = await res.json();
    if (data.errorMessages || data.errors) {
      return {
        content: [
          {
            type: "text",
            text: `Error: ${JSON.stringify(data.errorMessages || data.errors)}`,
          },
        ],
      };
    }
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify({
            key: data.key,
            summary: data.fields?.summary,
            status: data.fields?.status?.name,
            priority: data.fields?.priority?.name,
            type: data.fields?.issuetype?.name,
            assignee: data.fields?.assignee?.displayName || "Unassigned",
            reporter: data.fields?.reporter?.displayName || "Unknown",
            created: data.fields?.created,
            updated: data.fields?.updated,
          }),
        },
      ],
    };
  } catch (err) {
    return { content: [{ type: "text", text: `Error: ${err.message}` }] };
  }
}

// ── Jira: Update Status ──
async function jiraUpdateStatus(issueKey, statusName, baseUrl, email, token) {
  try {
    const transRes = await api.fetch(
      `${baseUrl}/rest/api/3/issue/${issueKey}/transitions`,
      { headers: buildHeaders(email, token) },
    );
    const transData = await transRes.json();

    const transition = transData.transitions?.find(
      (t) =>
        t.name.toLowerCase().includes(statusName.toLowerCase()) ||
        t.to?.name.toLowerCase().includes(statusName.toLowerCase()),
    );

    if (!transition) {
      const available = transData.transitions?.map((t) => t.name).join(", ");
      return {
        content: [
          {
            type: "text",
            text: `Status "${statusName}" not found. Available: ${available}`,
          },
        ],
      };
    }

    await api.fetch(`${baseUrl}/rest/api/3/issue/${issueKey}/transitions`, {
      method: "POST",
      headers: buildHeaders(email, token),
      body: JSON.stringify({ transition: { id: transition.id } }),
    });

    return {
      content: [
        {
          type: "text",
          text: `Successfully updated ${issueKey} status to "${transition.to?.name}"`,
        },
      ],
    };
  } catch (err) {
    return { content: [{ type: "text", text: `Error: ${err.message}` }] };
  }
}

// ── Jira: List Users ──
async function jiraListUsers(baseUrl, email, token) {
  try {
    const res = await api.fetch(
      `${baseUrl}/rest/api/3/users/search?maxResults=50`,
      { headers: buildHeaders(email, token) },
    );
    const users = await res.json();
    if (!Array.isArray(users) || !users.length) {
      return {
        content: [{ type: "text", text: "No users found in this workspace." }],
      };
    }
    const list = users
      .filter((u) => u.accountType === "atlassian")
      .map((u) => ({
        name: u.displayName,
        email: u.emailAddress,
        accountId: u.accountId,
      }));
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify({ users: list, total: list.length }),
        },
      ],
    };
  } catch (err) {
    return { content: [{ type: "text", text: `Error: ${err.message}` }] };
  }
}

// ── Jira: Assign Issue ──
async function jiraAssignIssue(issueKey, userName, baseUrl, email, token) {
  try {
    let user = null;

    // Strategy 1 — /user/search (exact)
    const s1 = await api.fetch(
      `${baseUrl}/rest/api/3/user/search?query=${encodeURIComponent(userName)}&maxResults=10`,
      { headers: buildHeaders(email, token) },
    );
    const r1 = await s1.json();
    console.log("Search 1:", JSON.stringify(r1).substring(0, 200));
    if (Array.isArray(r1) && r1.length > 0) {
      user =
        r1.find(
          (u) => u.displayName?.toLowerCase() === userName.toLowerCase(),
        ) || null;
    }

    // Strategy 2 — /user/search by first name
    if (!user) {
      const s2 = await api.fetch(
        `${baseUrl}/rest/api/3/user/search?query=${encodeURIComponent(userName.split(" ")[0])}&maxResults=10`,
        { headers: buildHeaders(email, token) },
      );
      const r2 = await s2.json();
      console.log("Search 2:", JSON.stringify(r2).substring(0, 200));
      if (Array.isArray(r2) && r2.length > 0) {
        user =
          r2.find((u) =>
            u.displayName?.toLowerCase().includes(userName.toLowerCase()),
          ) || null;
      }
    }

    // Strategy 3 — /users/search full list
    if (!user) {
      const s3 = await api.fetch(
        `${baseUrl}/rest/api/3/users/search?maxResults=50`,
        { headers: buildHeaders(email, token) },
      );
      const r3 = await s3.json();
      console.log("All users:", r3?.map((u) => u.displayName)?.join(", "));

      if (Array.isArray(r3)) {
        user =
          r3.find(
            (u) =>
              u.displayName?.toLowerCase() === userName.toLowerCase() ||
              u.displayName?.toLowerCase().includes(userName.toLowerCase()) ||
              u.emailAddress?.toLowerCase().includes(userName.toLowerCase()),
          ) || null;

        // ✅ If still no match — show available users, don't assign wrong person
        if (!user) {
          const available = r3
            .filter((u) => u.accountType === "atlassian")
            .map((u) => u.displayName)
            .filter(Boolean)
            .join(", ");
          return {
            content: [
              {
                type: "text",
                text: `User "${userName}" not found in this Atlassian site.\n\nAvailable users: ${available || "none found"}\n\nMake sure the user is invited to the workspace first.`,
              },
            ],
          };
        }
      }
    }

    if (!user) {
      return {
        content: [
          {
            type: "text",
            text: `User "${userName}" not found. Please invite them to the workspace first.`,
          },
        ],
      };
    }

    console.log("Assigning to:", user.displayName, user.accountId);

    const res = await api.fetch(
      `${baseUrl}/rest/api/3/issue/${issueKey}/assignee`,
      {
        method: "PUT",
        headers: buildHeaders(email, token),
        body: JSON.stringify({ accountId: user.accountId }),
      },
    );

    if (res.status === 204) {
      return {
        content: [
          {
            type: "text",
            text: `Successfully assigned ${issueKey} to ${user.displayName}`,
          },
        ],
      };
    }

    const data = await res.json();
    return {
      content: [{ type: "text", text: `Error: ${JSON.stringify(data)}` }],
    };
  } catch (err) {
    return { content: [{ type: "text", text: `Error: ${err.message}` }] };
  }
}

// ── Jira: List Projects ──
async function jiraListProjects(baseUrl, email, token) {
  try {
    const res = await api.fetch(`${baseUrl}/rest/api/3/project`, {
      headers: buildHeaders(email, token),
    });
    const data = await res.json();
    const projects = Array.isArray(data)
      ? data.map((p) => ({ key: p.key, name: p.name, type: p.projectTypeKey }))
      : [];
    return { content: [{ type: "text", text: JSON.stringify({ projects }) }] };
  } catch (err) {
    return { content: [{ type: "text", text: `Error: ${err.message}` }] };
  }
}

// ── Jira: Add Comment ──
async function jiraAddComment(issueKey, comment, baseUrl, email, token) {
  try {
    await api.fetch(`${baseUrl}/rest/api/3/issue/${issueKey}/comment`, {
      method: "POST",
      headers: buildHeaders(email, token),
      body: JSON.stringify({
        body: {
          type: "doc",
          version: 1,
          content: [
            { type: "paragraph", content: [{ type: "text", text: comment }] },
          ],
        },
      }),
    });
    return {
      content: [{ type: "text", text: `Comment added to ${issueKey}` }],
    };
  } catch (err) {
    return { content: [{ type: "text", text: `Error: ${err.message}` }] };
  }
}

// ── Confluence: Search Pages ──
async function confluenceSearch(query, baseUrl, email, token) {
  try {
    const res = await api.fetch(
      `${baseUrl}/wiki/rest/api/search?cql=text~"${encodeURIComponent(query)}"&limit=5`,
      { headers: buildHeaders(email, token) },
    );
    const data = await res.json();
    const results =
      data.results?.map((r) => ({
        title: r.title,
        type: r.type,
        url: r._links?.webui,
        space: r.resultParentContainer?.title,
      })) || [];
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify({ results, total: results.length }),
        },
      ],
    };
  } catch (err) {
    return { content: [{ type: "text", text: `Error: ${err.message}` }] };
  }
}

// ── Confluence: Read Page ──
async function confluenceReadPage(title, baseUrl, email, token) {
  try {
    const res = await api.fetch(
      `${baseUrl}/wiki/rest/api/content?title=${encodeURIComponent(title)}&expand=body.storage&limit=1`,
      { headers: buildHeaders(email, token) },
    );
    const data = await res.json();
    const page = data.results?.[0];
    if (!page) return { content: [{ type: "text", text: "Page not found." }] };
    const body =
      page.body?.storage?.value?.replace(/<[^>]+>/g, " ").substring(0, 2000) ||
      "";
    return {
      content: [{ type: "text", text: `Title: ${page.title}\n\n${body}` }],
    };
  } catch (err) {
    return { content: [{ type: "text", text: `Error: ${err.message}` }] };
  }
}

// ── Confluence: List Spaces ──
async function confluenceListSpaces(baseUrl, email, token) {
  try {
    const res = await api.fetch(`${baseUrl}/wiki/rest/api/space?limit=10`, {
      headers: buildHeaders(email, token),
    });
    const data = await res.json();
    const spaces =
      data.results?.map((s) => ({ key: s.key, name: s.name, type: s.type })) ||
      [];
    return { content: [{ type: "text", text: JSON.stringify({ spaces }) }] };
  } catch (err) {
    return { content: [{ type: "text", text: `Error: ${err.message}` }] };
  }
}

// ── Format tool results ──
function formatToolResult(toolName, resultText) {
  try {
    const data = JSON.parse(resultText);

    if (toolName === "search_jira_issues") {
      if (!data.issues?.length) return "No Jira issues found.";
      const lines = data.issues.map(
        (issue, i) =>
          `${i + 1}. ${issue.key} — ${issue.summary}\n   Status: ${issue.status} | Priority: ${issue.priority} | Type: ${issue.type} | Assignee: ${issue.assignee}`,
      );
      return `Found ${data.total} Jira issue(s):\n\n${lines.join("\n\n")}`;
    }

    if (toolName === "read_jira_issue") {
      return `${data.key} — ${data.summary}\n\nStatus: ${data.status}\nPriority: ${data.priority}\nType: ${data.type}\nAssignee: ${data.assignee}\nReporter: ${data.reporter}\nCreated: ${data.created?.split("T")[0]}\nUpdated: ${data.updated?.split("T")[0]}`;
    }

    if (toolName === "list_jira_projects") {
      if (!data.projects?.length) return "No projects found.";
      const lines = data.projects.map(
        (p, i) => `${i + 1}. ${p.key} — ${p.name} (${p.type})`,
      );
      return `Found ${data.projects.length} project(s):\n\n${lines.join("\n")}`;
    }

    if (toolName === "list_jira_users") {
      if (!data.users?.length) return "No users found.";
      const lines = data.users.map(
        (u, i) => `${i + 1}. ${u.name}${u.email ? ` (${u.email})` : ""}`,
      );
      return `Found ${data.total} user(s) in this workspace:\n\n${lines.join("\n")}`;
    }

    if (toolName === "search_confluence_pages") {
      if (!data.results?.length) return "No Confluence pages found.";
      const lines = data.results.map(
        (r, i) => `${i + 1}. ${r.title} — Space: ${r.space || "N/A"}`,
      );
      return `Found ${data.total} page(s):\n\n${lines.join("\n")}`;
    }

    if (toolName === "list_confluence_spaces") {
      if (!data.spaces?.length) return "No Confluence spaces found.";
      const lines = data.spaces.map(
        (s, i) => `${i + 1}. ${s.key} — ${s.name} (${s.type})`,
      );
      return `Found ${data.spaces.length} space(s):\n\n${lines.join("\n")}`;
    }

    return resultText;
  } catch {
    return resultText;
  }
}

// ── All Tool Definitions ──
const ALL_TOOLS = [
  {
    name: "search_jira_issues",
    description:
      "Search or list Jira issues using JQL. Project is auto-detected.",
    inputSchema: {
      type: "object",
      properties: {
        jql: {
          type: "string",
          description:
            "JQL without project. Examples: ORDER BY created DESC | assignee=currentUser() ORDER BY created DESC | resolution=Unresolved ORDER BY created DESC",
        },
      },
      required: ["jql"],
    },
  },
  {
    name: "create_jira_issue",
    description: "Create a new Jira issue, ticket, bug or task.",
    inputSchema: {
      type: "object",
      properties: {
        summary: { type: "string", description: "Issue title" },
        description: { type: "string", description: "Issue description" },
        issue_type: { type: "string", description: "Task, Bug, Story etc." },
        priority: {
          type: "string",
          description: "Low, Medium, High, Critical",
        },
        project_key: {
          type: "string",
          description: "Jira project key (optional, auto-detected)",
        },
      },
      required: ["summary"],
    },
  },
  {
    name: "read_jira_issue",
    description: "Read full details of a specific Jira issue by its key",
    inputSchema: {
      type: "object",
      properties: {
        issue_key: {
          type: "string",
          description: "Jira issue key e.g. KAN-12",
        },
      },
      required: ["issue_key"],
    },
  },
  {
    name: "update_jira_issue",
    description: "Update or change the status of a Jira issue",
    inputSchema: {
      type: "object",
      properties: {
        issue_key: {
          type: "string",
          description: "Jira issue key e.g. KAN-12",
        },
        status: {
          type: "string",
          description: "New status e.g. In Progress, Done, To Do",
        },
      },
      required: ["issue_key", "status"],
    },
  },
  {
    name: "assign_jira_issue",
    description: "Assign a Jira issue to a user by their name",
    inputSchema: {
      type: "object",
      properties: {
        issue_key: {
          type: "string",
          description: "Jira issue key e.g. KAN-12",
        },
        user_name: {
          type: "string",
          description: "Name of the user to assign",
        },
      },
      required: ["issue_key", "user_name"],
    },
  },
  {
    name: "list_jira_users",
    description:
      "List all users in the Atlassian workspace. Use when asked about users, members, people, or who is available to assign.",
    inputSchema: { type: "object", properties: {}, required: [] },
  },
  {
    name: "list_jira_projects",
    description: "List all available Jira projects",
    inputSchema: { type: "object", properties: {}, required: [] },
  },
  {
    name: "add_jira_comment",
    description: "Add a comment to a Jira issue",
    inputSchema: {
      type: "object",
      properties: {
        issue_key: { type: "string", description: "Jira issue key" },
        comment: { type: "string", description: "Comment text" },
      },
      required: ["issue_key", "comment"],
    },
  },
  {
    name: "search_confluence_pages",
    description: "Search Confluence pages by keyword",
    inputSchema: {
      type: "object",
      properties: { query: { type: "string", description: "Search keyword" } },
      required: ["query"],
    },
  },
  {
    name: "read_confluence_page",
    description: "Read content of a Confluence page by title",
    inputSchema: {
      type: "object",
      properties: {
        title: { type: "string", description: "Exact page title" },
      },
      required: ["title"],
    },
  },
  {
    name: "list_confluence_spaces",
    description: "List all Confluence spaces",
    inputSchema: { type: "object", properties: {}, required: [] },
  },
];

// ── Select tools based on message ──
function selectRelevantTools(message) {
  const msg = message.toLowerCase();

  const isConfluenceOnly =
    (msg.includes("confluence") ||
      msg.includes("page") ||
      msg.includes("doc") ||
      msg.includes("space")) &&
    !msg.includes("jira") &&
    !msg.includes("issue") &&
    !msg.includes("ticket") &&
    !msg.includes("bug") &&
    !msg.includes("user") &&
    !msg.includes("member");

  const isUserSearch =
    (msg.includes("user") ||
      msg.includes("member") ||
      msg.includes("people") ||
      msg.includes("who") ||
      msg.includes("workspace") ||
      msg.includes("available")) &&
    !msg.includes("issue") &&
    !msg.includes("ticket");

  const isJira =
    msg.includes("jira") ||
    msg.includes("issue") ||
    msg.includes("ticket") ||
    msg.includes("bug") ||
    msg.includes("task") ||
    msg.includes("sprint") ||
    msg.includes("list") ||
    msg.includes("show") ||
    msg.includes("create") ||
    msg.includes("open") ||
    msg.includes("assign") ||
    msg.includes("reassign") ||
    msg.includes("project") ||
    msg.includes("comment") ||
    msg.includes("status") ||
    msg.includes("priority") ||
    msg.includes("update") ||
    msg.includes("change") ||
    msg.includes("move") ||
    msg.includes("explain") ||
    msg.includes("detail") ||
    msg.includes("done") ||
    msg.includes("progress") ||
    msg.includes("kan-") ||
    msg.includes("user") ||
    msg.includes("member") ||
    msg.includes("people");

  if (isConfluenceOnly)
    return ALL_TOOLS.filter((t) =>
      [
        "search_confluence_pages",
        "read_confluence_page",
        "list_confluence_spaces",
      ].includes(t.name),
    );

  if (isUserSearch)
    return ALL_TOOLS.filter((t) => ["list_jira_users"].includes(t.name));

  if (isJira)
    return ALL_TOOLS.filter((t) =>
      [
        "search_jira_issues",
        "create_jira_issue",
        "read_jira_issue",
        "update_jira_issue",
        "assign_jira_issue",
        "list_jira_users",
        "list_jira_projects",
        "add_jira_comment",
      ].includes(t.name),
    );

  return [];
}

function toGroqFormat(tools) {
  return tools.map((tool) => ({
    type: "function",
    function: {
      name: tool.name,
      description: tool.description || "",
      parameters: tool.inputSchema || {
        type: "object",
        properties: {},
        required: [],
      },
    },
  }));
}

async function executeTool(name, args, creds) {
  const { baseUrl, email, token } = creds;
  console.log("Executing tool:", name, JSON.stringify(args));
  switch (name) {
    case "search_jira_issues":
      return jiraSearch(args.jql, baseUrl, email, token);
    case "create_jira_issue":
      return jiraCreate(args, baseUrl, email, token);
    case "read_jira_issue":
      return jiraReadIssue(args.issue_key, baseUrl, email, token);
    case "update_jira_issue":
      return jiraUpdateStatus(
        args.issue_key,
        args.status,
        baseUrl,
        email,
        token,
      );
    case "assign_jira_issue":
      return jiraAssignIssue(
        args.issue_key,
        args.user_name,
        baseUrl,
        email,
        token,
      );
    case "list_jira_users":
      return jiraListUsers(baseUrl, email, token);
    case "list_jira_projects":
      return jiraListProjects(baseUrl, email, token);
    case "add_jira_comment":
      return jiraAddComment(
        args.issue_key,
        args.comment,
        baseUrl,
        email,
        token,
      );
    case "search_confluence_pages":
      return confluenceSearch(args.query, baseUrl, email, token);
    case "read_confluence_page":
      return confluenceReadPage(args.title, baseUrl, email, token);
    case "list_confluence_spaces":
      return confluenceListSpaces(baseUrl, email, token);
    default:
      return { content: [{ type: "text", text: `Unknown tool: ${name}` }] };
  }
}

async function callGroq(messages, apiKey, tools = [], forceTools = false) {
  const body = {
    model: "llama-3.3-70b-versatile",
    messages: [
      {
        role: "system",
        content: `You are an AI assistant for Atlassian Jira and Confluence with tool access.

RULES:
- hi/hello/general questions: answer directly, no tools
- Jira/Confluence questions: ALWAYS use tools
- NEVER output <function> tags in text

JIRA TOOLS:
- all issues: search_jira_issues {"jql":"ORDER BY created DESC"}
- open issues: search_jira_issues {"jql":"resolution=Unresolved ORDER BY created DESC"}
- done issues: search_jira_issues {"jql":"status=Done ORDER BY created DESC"}
- my issues: search_jira_issues {"jql":"assignee=currentUser() ORDER BY created DESC"}
- explain issue: read_jira_issue {"issue_key":"ISSUE-KEY"}
- create: create_jira_issue
- change status: update_jira_issue
- assign: assign_jira_issue
- list users/members/people/workspace: list_jira_users
- comment: add_jira_comment
- projects: list_jira_projects

CONFLUENCE TOOLS:
- search: search_confluence_pages
- read: read_confluence_page
- spaces: list_confluence_spaces`,
      },
      ...messages,
    ],
    max_tokens: 512,
    temperature: 0.2,
  };

  if (tools.length > 0) {
    body.tools = tools;
    body.tool_choice = forceTools ? "required" : "auto";
  }

  console.log(
    `Calling Groq — tools: ${tools.length} | forceTools: ${forceTools}`,
  );

  const response = await api.fetch(
    "https://api.groq.com/openai/v1/chat/completions",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(body),
    },
  );

  if (response.status === 429) throw new Error("RATE_LIMITED");
  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Groq error ${response.status}: ${err}`);
  }
  return response.json();
}

function buildMessages(history, newMessage) {
  const messages = history.map((msg) => ({
    role: msg.role === "user" ? "user" : "assistant",
    content: msg.content,
  }));
  messages.push({ role: "user", content: newMessage });
  return messages;
}

function parseToolCallFromText(text) {
  try {
    const match1 = text.match(/<function>(\w+)<\/function>\s*(\{.*?\})/s);
    if (match1) return { name: match1[1], args: JSON.parse(match1[2]) };

    const match2 = text.match(/<function=(\w+)>\s*(\{.*?\})\s*<\/function>/s);
    if (match2) return { name: match2[1], args: JSON.parse(match2[2]) };

    const match3 = text.match(/<function=(\w+)>\s*(\{.*)/s);
    if (match3) {
      const jsonStr = match3[2].replace(/<\/function>.*$/s, "").trim();
      return { name: match3[1], args: JSON.parse(jsonStr) };
    }
    return null;
  } catch (e) {
    console.error("parseToolCallFromText error:", e.message);
    return null;
  }
}

resolver.define("chat", async (req) => {
  const { message, history } = req.payload;
  const apiKey = process.env.GROQ_API_KEY;

  console.log("Chat request:", message);
  if (!apiKey) return { error: true, text: "Groq API key not configured." };

  const creds = await getCredentials();
  if (!creds.baseUrl || !creds.email || !creds.token) {
    return {
      error: true,
      text: "Please configure your Atlassian credentials first.",
    };
  }

  try {
    const requiresTools = needsTools(message);
    const relevantTools = requiresTools ? selectRelevantTools(message) : [];
    const groqTools = toGroqFormat(relevantTools);
    const messages = buildMessages(history || [], message);
    const forceTools = requiresTools && groqTools.length > 0;

    console.log(
      "Requires tools:",
      requiresTools,
      "| Tool count:",
      groqTools.length,
    );

    const groqResponse = await callGroq(
      messages,
      apiKey,
      groqTools,
      forceTools,
    );
    const choice = groqResponse.choices?.[0];
    const responseMessage = choice?.message;
    const finishReason = choice?.finish_reason;

    console.log("Finish reason:", finishReason);

    if (finishReason === "tool_calls" && responseMessage?.tool_calls) {
      const toolCall = responseMessage.tool_calls[0];
      const toolName = toolCall.function.name;
      const toolArgs = JSON.parse(toolCall.function.arguments || "{}");
      const toolResult = await executeTool(toolName, toolArgs, creds);
      const resultText = toolResult?.content?.[0]?.text || "No result";
      const formatted = formatToolResult(toolName, resultText);
      return { error: false, text: formatted };
    }

    const rawText = responseMessage?.content || "";

    if (rawText.includes("<function") && groqTools.length > 0) {
      const parsed = parseToolCallFromText(rawText);
      if (parsed) {
        console.log("Parsed text tool call:", parsed.name);
        const toolResult = await executeTool(parsed.name, parsed.args, creds);
        const resultText = toolResult?.content?.[0]?.text || "No result";
        const formatted = formatToolResult(parsed.name, resultText);
        return { error: false, text: formatted };
      }
    }

    if (rawText) {
      console.log("Final answer received");
      return { error: false, text: rawText };
    }

    return { error: true, text: "Empty response received." };
  } catch (err) {
    console.error("Chat error:", err.message);
    if (err.message === "RATE_LIMITED") {
      return {
        error: true,
        text: "Rate limit reached. Please wait 30 seconds and try again.",
      };
    }
    return { error: true, text: `Error: ${err.message}` };
  }
});

export const handler = resolver.getDefinitions();
