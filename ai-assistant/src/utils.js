import { ALL_TOOLS } from "./tools/definitions.js";

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
    msg.includes("user") ||
    msg.includes("member") ||
    msg.includes("people") ||
    msg.includes("who") ||
    msg.includes("workspace") ||
    msg.includes("write") ||
    msg.includes("document") ||
    msg.includes("documentation") ||
    msg.includes("content")
  );
}

export function selectRelevantTools(message) {
  const msg = message.toLowerCase();

  const isConfluenceOnly =
    (msg.includes("confluence") ||
      msg.includes("page") ||
      msg.includes("doc") ||
      msg.includes("space") ||
      msg.includes("document") ||
      msg.includes("write") ||
      msg.includes("documentation") ||
      msg.includes("content")) &&
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
        "list_confluence_pages",
        "read_confluence_page",
        "list_confluence_spaces",
        "create_confluence_page",
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

  return [];
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
      const lines = data.pages.map(
        (p, i) => `${i + 1}. ${p.title} — Space: ${p.space}`,
      );
      return `Found ${data.total} page(s) in space ${data.space}:\n\n${lines.join("\n")}`;
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
