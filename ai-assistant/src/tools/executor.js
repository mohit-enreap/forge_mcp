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
} from "./confluence.js";

export async function executeTool(name, args, creds) {
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
    case "update_jira_priority":
      return jiraUpdatePriority(
        args.issue_key,
        args.priority,
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
    case "list_confluence_pages":
      return confluenceListPages(args.space_key, baseUrl, email, token);
    case "read_confluence_page":
      return confluenceReadPage(
        args.title || args.page_title,
        baseUrl,
        email,
        token,
      );
    case "list_confluence_spaces":
      return confluenceListSpaces(baseUrl, email, token);
    case "create_confluence_page":
      return confluenceCreatePage(
        args.title,
        args.content,
        null,
        baseUrl,
        email,
        token,
      );
    case "update_confluence_page":
      return confluenceUpdatePage(
        args.title,
        args.content,
        args.new_title,
        baseUrl,
        email,
        token,
      );
    default:
      return { content: [{ type: "text", text: `Unknown tool: ${name}` }] };
  }
}
