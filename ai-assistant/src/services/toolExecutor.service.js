// import {
//   jiraSearch,
//   jiraCreate,
//   jiraReadIssue,
//   jiraUpdateStatus,
//   jiraUpdatePriority,
//   jiraAssignIssue,
//   jiraListUsers,
//   jiraListProjects,
//   jiraAddComment,
// } from "./jira.js";

// import {
//   confluenceSearch,
//   confluenceListPages,
//   confluenceReadPage,
//   confluenceListSpaces,
//   confluenceCreatePage,
//   confluenceUpdatePage,
//   confluenceDeletePage,
// } from "./confluence.js";

// // No creds param — Forge native auth handles everything
// export async function executeTool(name, args) {
//   console.log("🚀 ~ executeTool ~ args:", args)
//   console.log("🚀 ~ executeTool ~ Name:", name)
  
//   const a = args || {};
//   console.log("Executing tool:", name, JSON.stringify(a));

//   switch (name) {
//     case "search_jira_issues":
//       return jiraSearch(a.jql);
//     case "create_jira_issue":
//       return jiraCreate(a);
//     case "read_jira_issue":
//       return jiraReadIssue(a.issue_key);
//     case "update_jira_issue":
//       return jiraUpdateStatus(a.issue_key, a.status);
//     case "update_jira_priority":
//       return jiraUpdatePriority(a.issue_key, a.priority);
//     case "assign_jira_issue":
//       return jiraAssignIssue(a.issue_key, a.user_name);
//     case "list_jira_users":
//       return jiraListUsers();
//     case "list_jira_projects":
//       return jiraListProjects();
//     case "add_jira_comment":
//       return jiraAddComment(a.issue_key, a.comment);
//     case "search_confluence_pages":
//       return confluenceSearch(a.query);
//     case "list_confluence_pages":
//       return confluenceListPages(a.space_key || null);
//     case "read_confluence_page":
//       return confluenceReadPage(a.title || a.page_title);
//     case "list_confluence_spaces":
//       return confluenceListSpaces();
//     case "create_confluence_page":
//       return confluenceCreatePage(a.title, a.content, null);
//     case "update_confluence_page":
//       return confluenceUpdatePage(a.title, a.content, a.new_title);
//     case "delete_confluence_page":
//       return confluenceDeletePage(a.title);
//     default:
//       return { content: [{ type: "text", text: `Unknown tool: ${name}` }] };
//   }
// }


import { tools } from "../tools";

export async function executeTool(name, args) {
  console.log("Executing tool🤖🤖🤖🤖🤖🤖", name, args);

  const tool = tools[name];

  if (!tool) {
    return {
      content: [{ type: "text", text: `Unknown tool: ${name}` }],
    };
  }

  return await tool(args || {});
}