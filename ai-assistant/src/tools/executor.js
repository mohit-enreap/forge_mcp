import {
  jiraSearch,
  jiraCreate,
  jiraReadIssue,
  jiraUpdateStatus,
  jiraUpdatePriority,
  jiraAssignIssue,
  jiraListUsers,
  jiraListProjects,
  jiraAddComment,
} from "./jira.js";

import {
  confluenceSearch,
  confluenceListPages,
  confluenceReadPage,
  confluenceListSpaces,
  confluenceCreatePage,
  confluenceUpdatePage,
  confluenceDeletePage,
} from "./confluence.js";

export async function executeTool(name, args, creds) {
  const { baseUrl, email, token } = creds;

  // ✅ Always default args to empty object to prevent null crashes
  const a = args || {};

  console.log("Executing tool:", name, JSON.stringify(a));

  switch (name) {
    case "search_jira_issues":
      return jiraSearch(a.jql, baseUrl, email, token);
    case "create_jira_issue":
      return jiraCreate(a, baseUrl, email, token);
    case "read_jira_issue":
      return jiraReadIssue(a.issue_key, baseUrl, email, token);
    case "update_jira_issue":
      return jiraUpdateStatus(a.issue_key, a.status, baseUrl, email, token);
    case "update_jira_priority":
      return jiraUpdatePriority(a.issue_key, a.priority, baseUrl, email, token);
    case "assign_jira_issue":
      return jiraAssignIssue(a.issue_key, a.user_name, baseUrl, email, token);
    case "list_jira_users":
      return jiraListUsers(baseUrl, email, token);
    case "list_jira_projects":
      return jiraListProjects(baseUrl, email, token);
    case "add_jira_comment":
      return jiraAddComment(a.issue_key, a.comment, baseUrl, email, token);
    case "search_confluence_pages":
      return confluenceSearch(a.query, baseUrl, email, token);
    case "list_confluence_pages":
      return confluenceListPages(a.space_key || null, baseUrl, email, token);
    case "read_confluence_page":
      return confluenceReadPage(a.title || a.page_title, baseUrl, email, token);
    case "list_confluence_spaces":
      return confluenceListSpaces(baseUrl, email, token);
    case "create_confluence_page":
      return confluenceCreatePage(
        a.title,
        a.content,
        null,
        baseUrl,
        email,
        token,
      );
    case "update_confluence_page":
      return confluenceUpdatePage(
        a.title,
        a.content,
        a.new_title,
        baseUrl,
        email,
        token,
      );
    case "delete_confluence_page":
      return confluenceDeletePage(a.title, baseUrl, email, token);
    default:
      return { content: [{ type: "text", text: `Unknown tool: ${name}` }] };
  }
}
