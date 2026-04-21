import api, { route } from "@forge/api";
import {
  searchJiraIssuesApi,
  createJiraIssueApi,
  getIssueTypesApi,
  getJiraIssueApi,
  getJiraTransitionsApi,
  updateJiraIssueStatusApi,
} from "../../clients/jira.client";
import { extractTextFromADF } from "../../utils/utils";

// Tool layer (AI-facing)
export const jiraTools = {
  search_jira_issues: async ({ jql }) => {
    try {
      let cleanJql = jql?.trim();

      // Normalize status values
      if (cleanJql) {
        cleanJql = cleanJql
          .replace(/status\s*=\s*["']?To-Do["']?/gi, 'status="To Do"')
          .replace(/status\s*=\s*["']?todo["']?/gi, 'status="To Do"')
          .replace(
            /status\s*=\s*["']?In-Progress["']?/gi,
            'status="In Progress"',
          )
          .replace(
            /status\s*=\s*["']?in progress["']?/gi,
            'status="In Progress"',
          )
          .replace(/status\s*=\s*["']?done["']?/gi, 'status="Done"')
          .replace(/status\s*=\s*["']?in review["']?/gi, 'status="In Review"');
      }

      // Ensure project filter exists
      if (!cleanJql || !cleanJql.toLowerCase().includes("project")) {
        const projRes = await api
          .asUser()
          .requestJira(route`/rest/api/3/project?maxResults=50`);
        const projData = await projRes.json();

        const projectKeys = Array.isArray(projData)
          ? projData.map((p) => p.key).filter(Boolean)
          : [];

        if (projectKeys.length > 0) {
          const projectFilter = `project in (${projectKeys
            .map((k) => `"${k}"`)
            .join(",")})`;

          if (!cleanJql) {
            cleanJql = `${projectFilter} ORDER BY created DESC`;
          } else if (cleanJql.toUpperCase().startsWith("ORDER BY")) {
            cleanJql = `${projectFilter} ${cleanJql}`;
          } else {
            cleanJql = `${projectFilter} AND ${cleanJql}`;
          }
        } else {
          cleanJql = cleanJql || "ORDER BY created DESC";
        }
      }

      console.log("Final JQL:", cleanJql);

      // 👉 Call client
      const data = await searchJiraIssuesApi(cleanJql);

      if (!data.issues?.length) {
        return {
          content: [{ type: "text", text: "No Jira issues found." }],
        };
      }

      const issues = data.issues.map((issue) => ({
        key: issue.key,
        summary: issue.fields?.summary,
        status: issue.fields?.status?.name,
        priority: issue.fields?.priority?.name || "None",
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
      return {
        content: [{ type: "text", text: `Error: ${err.message}` }],
      };
    }
  },

  create_jira_issue: async (args) => {
    try {
      let projectKey = args.project_key;

      // Auto-detect project if not provided
      if (!projectKey) {
        const projRes = await api
          .asUser()
          .requestJira(route`/rest/api/3/project?maxResults=1`);
        const projData = await projRes.json();

        projectKey = Array.isArray(projData) ? projData?.[0]?.key : null;
      }

      if (!projectKey) {
        return {
          content: [{ type: "text", text: "No Jira project found." }],
        };
      }

      // ✅ Get valid issue types
      const validTypes = await getIssueTypesApi(projectKey);

      // ✅ Choose safe issue type
      let issueType = args.issue_type || "Story";

      if (!validTypes.includes(issueType)) {
        console.log("Invalid issue type:", issueType);
        console.log("Falling back to:", validTypes[0]);

        issueType = validTypes[0]; // fallback to first valid type
      }

      // Prepare payload
      const payload = {
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
                  {
                    type: "text",
                    text: args.description || args.summary,
                  },
                ],
              },
            ],
          },
          issuetype: { name: issueType || "Story" },
          priority: { name: args.priority || "Medium" },
        },
      };

      // Call client
      const data = await createJiraIssueApi(payload);

      return {
        content: [
          {
            type: "text",
            text: `Created issue ${data.key}: ${args.summary}`,
          },
        ],
      };
    } catch (err) {
      return {
        content: [{ type: "text", text: `Error: ${err.message}` }],
      };
    }
  },

  read_jira_issue: async ({ issue_key }) => {
    try {
      const data = await getJiraIssueApi(issue_key);

      const descriptionRaw = data.fields?.description;
      const descriptionText = extractTextFromADF(descriptionRaw);
      console.log("🚀 ~ descriptionText:", descriptionText);

      const result = {
        key: data.key,
        summary: data.fields?.summary,
        status: data.fields?.status?.name,
        priority: data.fields?.priority?.name || "None",
        type: data.fields?.issuetype?.name,
        assignee: data.fields?.assignee?.displayName || "Unassigned",
        reporter: data.fields?.reporter?.displayName || "Unknown",
        created: data.fields?.created,
        updated: data.fields?.updated,
        description: descriptionText || "No description",
      };

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(result, null, 2),
          },
        ],
      };
    } catch (err) {
      return {
        content: [{ type: "text", text: `Error: ${err.message}` }],
      };
    }
  },

  update_jira_issue: async ({ issue_key, status }) => {
    try {
      if (!issue_key) {
        return {
          content: [{ type: "text", text: "issue_key is required" }],
        };
      }

      if (!status) {
        return {
          content: [{ type: "text", text: "status is required" }],
        };
      }

      // ✅ Get available transitions
      const transitions = await getJiraTransitionsApi(issue_key);

      if (!transitions.length) {
        return {
          content: [
            {
              type: "text",
              text: "No transitions available for this issue.",
            },
          ],
        };
      }

      // Normalize status
      const targetStatus = status.toLowerCase().trim();

      const matchedTransition = transitions.find(
        (t) => t.name.toLowerCase() === targetStatus,
      );

      if (!matchedTransition) {
        const available = transitions.map((t) => t.name).join(", ");

        return {
          content: [
            {
              type: "text",
              text: `Invalid status. Available transitions: ${available}`,
            },
          ],
        };
      }

      // ✅ Call client
      await updateJiraIssueStatusApi(issue_key, matchedTransition.id);

      return {
        content: [
          {
            type: "text",
            text: `Issue ${issue_key} moved to "${matchedTransition.name}"`,
          },
        ],
      };
    } catch (err) {
      return {
        content: [{ type: "text", text: `Error: ${err.message}` }],
      };
    }
  },
};
