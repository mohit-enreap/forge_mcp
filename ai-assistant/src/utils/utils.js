import { ALL_TOOLS } from "../tools/defination";


export function needsTools(message) {
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
    msg.includes("ai-") ||
    msg.includes("described") ||
    msg.includes("describe") ||
    msg.includes("user") ||
    msg.includes("member") ||
    msg.includes("people") ||
    msg.includes("who") ||
    msg.includes("workspace") ||
    msg.includes("write") ||
    msg.includes("document") ||
    msg.includes("documentation") ||
    msg.includes("content") ||
    msg.includes("read") ||
    msg.includes("view") ||
    msg.includes("get") ||
    msg.includes("fetch") ||
    msg.includes("display") ||
    msg.includes("edit") ||
    msg.includes("mcp-") ||
    msg.includes("tell me about")
  );
}

export function selectRelevantTools(message) {
  const msg = message.toLowerCase();

  const hasConfluenceKeyword =
    msg.includes("confluence") ||
    msg.includes("page") ||
    msg.includes("doc") ||
    msg.includes("space") ||
    msg.includes("document") ||
    msg.includes("write") ||
    msg.includes("documentation") ||
    msg.includes("content");

  const hasJiraKeyword =
    msg.includes("jira") ||
    msg.includes("issue") ||
    msg.includes("ticket") ||
    msg.includes("bug") ||
    msg.includes("sprint") ||
    msg.includes("backlog") ||
    msg.includes("kan-") ||
    msg.includes("ai-") ||
    msg.includes("mcp-");

  // Detect read/explain/open/edit intent for a named page
  const isReadIntent =
    msg.startsWith("open ") ||
    msg.startsWith("read ") ||
    msg.startsWith("describe ") ||
    msg.startsWith("described ") ||
    msg.startsWith("show me ") ||
    msg.startsWith("tell me about ") ||
    msg.startsWith("what is ") ||
    msg.startsWith("explain ") ||
    msg.startsWith("view ") ||
    msg.startsWith("fetch ") ||
    msg.startsWith("edit ") ||
    msg.startsWith("update ") ||
    msg.includes("describe ") ||
    msg.includes("described ") ||
    msg.includes("edit ") ||
    msg.includes("modify ");

  // If read/edit intent and no Jira keyword → treat as Confluence
  if (isReadIntent && !hasJiraKeyword) {
    return ALL_TOOLS.filter((t) =>
      [
        "read_confluence_page",
        "search_confluence_pages",
        "list_confluence_pages",
        "list_confluence_spaces",
        "update_confluence_page",
      ].includes(t.name),
    );
  }

  const isConfluenceOnly =
    hasConfluenceKeyword &&
    !hasJiraKeyword &&
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
    hasJiraKeyword ||
    msg.includes("issue") ||
    msg.includes("ticket") ||
    msg.includes("task") ||
    msg.includes("list") ||
    msg.includes("show") ||
    msg.includes("create") ||
    msg.includes("assign") ||
    msg.includes("reassign") ||
    msg.includes("project") ||
    msg.includes("comment") ||
    msg.includes("status") ||
    msg.includes("priority") ||
    msg.includes("done") ||
    msg.includes("progress") ||
    msg.includes("user") ||
    msg.includes("member") ||
    msg.includes("people");

  if (isConfluenceOnly)
    return ALL_TOOLS.filter((t) =>
      [
        "search_confluence_pages",
        "list_confluence_pages",
        "read_confluence_page",
        "list_confluence_spaces",
        "create_confluence_page",
        "update_confluence_page",
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
        "update_jira_priority",
        "assign_jira_issue",
        "list_jira_users",
        "list_jira_projects",
        "add_jira_comment",
      ].includes(t.name),
    );

  // Fallback — give all tools
  return ALL_TOOLS;
}

export function toGroqFormat(tools) {
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

export function formatToolResult(toolName, resultText) {
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
      return `
      Issue: ${data.key} — ${data.summary}

      Details
      -------
      Status     : ${data.status}
      Priority   : ${data.priority}
      Type       : ${data.type}

      People
      ------
      Assignee   : ${data.assignee}
      Reporter   : ${data.reporter}

      Dates
      -----
      Created    : ${data.created?.split("T")[0]}
      Updated    : ${data.updated?.split("T")[0]}

      Description
      -----------
      ${data.description?.trim() || "No description available."}
      `;
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
      return `Found ${data.total} user(s):\n\n${lines.join("\n")}`;
    }

    if (toolName === "search_confluence_pages") {
      if (!data.results?.length) return "No Confluence pages found.";
      const lines = data.results.map(
        (r, i) => `${i + 1}. ${r.title} — Space: ${r.space || "N/A"}`,
      );
      return `Found ${data.total} page(s):\n\n${lines.join("\n")}`;
    }

    if (toolName === "list_confluence_pages") {
      if (!data.pages?.length) return "No pages found.";
      const grouped = {};
      data.pages.forEach((p) => {
        if (!grouped[p.space]) grouped[p.space] = [];
        grouped[p.space].push(p.title);
      });
      const lines = Object.entries(grouped).map(
        ([space, pages]) =>
          `📁 ${space}:\n${pages.map((t, i) => `   ${i + 1}. ${t}`).join("\n")}`,
      );
      return `Found ${data.total} page(s) across all spaces:\n\n${lines.join("\n\n")}`;
    }

    if (toolName === "list_confluence_spaces") {
      if (!data.spaces?.length) return "No Confluence spaces found.";
      const lines = data.spaces.map(
        (s, i) =>
          `${i + 1}. ${s.name} (${s.key}) - ID: ${s.id}, Type: ${s.type}`,
      );
      return `Confluence Spaces (${data.spaces.length}):\n${lines.join("\n")}`;
    }

    return resultText;
  } catch {
    return resultText;
  }
}

export function buildMessages(history, newMessage) {
  const messages = history.map((msg) => ({
    role: msg.role === "user" ? "user" : "assistant",
    content: msg.content,
  }));
  messages.push({ role: "user", content: newMessage });
  return messages;
}

export function parseToolCallFromText(text) {
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

export function extractTextFromADF(adf) {
  if (!adf || !adf.content) return "";

  let text = "";

  const traverse = (nodes) => {
    for (const node of nodes) {
      switch (node.type) {
        case "heading":
          traverse(node.content || []);
          text += "\n\n";
          break;

        case "paragraph":
          traverse(node.content || []);
          text += "\n";
          break;

        case "text":
          text += node.text; // ❗ removed extra space
          break;

        case "bulletList":
          node.content?.forEach((item) => {
            text += "\n• ";
            traverse(item.content || []);
          });
          text += "\n";
          break;

        case "listItem":
          traverse(node.content || []);
          break;

        default:
          if (node.content) {
            traverse(node.content);
          }
      }
    }
  };

  traverse(adf.content);

  // ✅ Clean up extra spaces & newlines
  return text
    .replace(/[ \t]+/g, " ")        // remove extra spaces
    .replace(/\n{3,}/g, "\n\n")     // max 2 line breaks
    .replace(/\n\s+\n/g, "\n\n")    // remove blank lines with spaces
    .trim();
}
