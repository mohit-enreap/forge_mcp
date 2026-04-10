import api from "@forge/api";

export async function callGroq(
  messages,
  apiKey,
  tools = [],
  forceTools = false,
) {
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
- change priority: update_jira_priority (Lowest/Low/Medium/High/Highest/Critical)
- assign: assign_jira_issue
- list users/members/people: list_jira_users
- comment: add_jira_comment
- projects: list_jira_projects

CONFLUENCE TOOLS:
- search pages by keyword: search_confluence_pages
- list all pages in a space: list_confluence_pages (space_key optional)
- read page content: read_confluence_page
- list spaces: list_confluence_spaces
- create/write/document: create_confluence_page`,
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
