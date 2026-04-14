export const ALL_TOOLS = [
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
    description:
      "Update or change the STATUS of a Jira issue e.g. In Progress, Done, To Do. Only for status changes.",
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
    name: "update_jira_priority",
    description:
      "Update or change the PRIORITY of a Jira issue. Only for priority changes.",
    inputSchema: {
      type: "object",
      properties: {
        issue_key: { type: "string", description: "Jira issue key e.g. KAN-1" },
        priority: {
          type: "string",
          description: "Lowest, Low, Medium, High, Highest, Critical",
        },
      },
      required: ["issue_key", "priority"],
    },
  },
  {
    name: "update_jira_summary",
    description:
      "Update or rename the TITLE or SUMMARY of a Jira issue. Use when user says change title, rename issue, update name, change summary.",
    inputSchema: {
      type: "object",
      properties: {
        issue_key: { type: "string", description: "Jira issue key e.g. AI-1" },
        summary: {
          type: "string",
          description: "New title or summary for the issue",
        },
      },
      required: ["issue_key", "summary"],
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
    description: "List all users in the Atlassian workspace.",
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
    name: "list_confluence_pages",
    description:
      "List all pages in a Confluence space. Use when asked to list pages, docs or content.",
    inputSchema: {
      type: "object",
      properties: {
        space_key: {
          type: "string",
          description: "Confluence space key e.g. SD (optional, auto-detected)",
        },
      },
      required: [],
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
  {
    name: "create_confluence_page",
    description:
      "Create a new Confluence page. Use when asked to write, create or document anything in Confluence.",
    inputSchema: {
      type: "object",
      properties: {
        title: { type: "string", description: "Page title" },
        content: {
          type: "string",
          description: "Full page content text to write",
        },
      },
      required: ["title", "content"],
    },
  },
  {
    name: "update_confluence_page",
    description:
      "Edit, update or rename an existing Confluence page. Use new_title to rename, content to update body.",
    inputSchema: {
      type: "object",
      properties: {
        title: {
          type: "string",
          description: "Current exact title of the page to update",
        },
        content: {
          type: "string",
          description: "New content (optional, keeps existing if not provided)",
        },
        new_title: {
          type: "string",
          description: "New title to rename the page to (optional)",
        },
      },
      required: ["title"],
    },
  },
  {
    name: "delete_confluence_page",
    description: "Delete or remove a Confluence page permanently by its title.",
    inputSchema: {
      type: "object",
      properties: {
        title: {
          type: "string",
          description: "Exact title of the page to delete",
        },
      },
      required: ["title"],
    },
  },
];
