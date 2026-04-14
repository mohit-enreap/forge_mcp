import api from "@forge/api";
import { buildHeaders } from "../credentials.js";

// ── Search Issues ──
export async function jiraSearch(jql, baseUrl, email, token) {
  try {
    let cleanJql = jql?.trim();

    if (cleanJql) {
      cleanJql = cleanJql.replace(/currentUser\(\)/gi, `"${email}"`);
    }

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
    console.error("jiraSearch error:", err.message);
    return { content: [{ type: "text", text: `Error: ${err.message}` }] };
  }
}

// ── Create Issue ──
export async function jiraCreate(args, baseUrl, email, token) {
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
      };
    }
    return {
      content: [
        { type: "text", text: `Created issue ${data.key}: ${args.summary}` },
      ],
    };
  } catch (err) {
    return { content: [{ type: "text", text: `Error: ${err.message}` }] };
  }
}

// ── Read Issue ──
export async function jiraReadIssue(issueKey, baseUrl, email, token) {
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
            priority: data.fields?.priority?.name || "None",
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

// ── Update Status ──
export async function jiraUpdateStatus(
  issueKey,
  statusName,
  baseUrl,
  email,
  token,
) {
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

// ── Update Priority ──
export async function jiraUpdatePriority(
  issueKey,
  priorityName,
  baseUrl,
  email,
  token,
) {
  try {
    const res = await api.fetch(`${baseUrl}/rest/api/3/issue/${issueKey}`, {
      method: "PUT",
      headers: buildHeaders(email, token),
      body: JSON.stringify({ fields: { priority: { name: priorityName } } }),
    });
    if (res.status === 204) {
      return {
        content: [
          {
            type: "text",
            text: `Successfully updated ${issueKey} priority to "${priorityName}"`,
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

// ── Update Summary/Title ──
export async function jiraUpdateSummary(
  issueKey,
  newSummary,
  baseUrl,
  email,
  token,
) {
  try {
    const res = await api.fetch(`${baseUrl}/rest/api/3/issue/${issueKey}`, {
      method: "PUT",
      headers: buildHeaders(email, token),
      body: JSON.stringify({
        fields: { summary: newSummary },
      }),
    });
    if (res.status === 204) {
      return {
        content: [
          {
            type: "text",
            text: `Successfully updated ${issueKey} title to "${newSummary}"`,
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

// ── List Users ──
export async function jiraListUsers(baseUrl, email, token) {
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

// ── Assign Issue ──
export async function jiraAssignIssue(
  issueKey,
  userName,
  baseUrl,
  email,
  token,
) {
  try {
    let user = null;

    const s1 = await api.fetch(
      `${baseUrl}/rest/api/3/user/search?query=${encodeURIComponent(userName)}&maxResults=10`,
      { headers: buildHeaders(email, token) },
    );
    const r1 = await s1.json();
    if (Array.isArray(r1) && r1.length > 0) {
      user =
        r1.find(
          (u) => u.displayName?.toLowerCase() === userName.toLowerCase(),
        ) || null;
    }

    if (!user) {
      const s2 = await api.fetch(
        `${baseUrl}/rest/api/3/user/search?query=${encodeURIComponent(userName.split(" ")[0])}&maxResults=10`,
        { headers: buildHeaders(email, token) },
      );
      const r2 = await s2.json();
      if (Array.isArray(r2) && r2.length > 0) {
        user =
          r2.find((u) =>
            u.displayName?.toLowerCase().includes(userName.toLowerCase()),
          ) || null;
      }
    }

    if (!user) {
      const s3 = await api.fetch(
        `${baseUrl}/rest/api/3/users/search?maxResults=50`,
        { headers: buildHeaders(email, token) },
      );
      const r3 = await s3.json();
      if (Array.isArray(r3)) {
        user =
          r3.find(
            (u) =>
              u.displayName?.toLowerCase() === userName.toLowerCase() ||
              u.displayName?.toLowerCase().includes(userName.toLowerCase()) ||
              u.emailAddress?.toLowerCase().includes(userName.toLowerCase()),
          ) || null;

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
                text: `User "${userName}" not found.\n\nAvailable users: ${available || "none found"}`,
              },
            ],
          };
        }
      }
    }

    if (!user) {
      return {
        content: [{ type: "text", text: `User "${userName}" not found.` }],
      };
    }

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

// ── List Projects ──
export async function jiraListProjects(baseUrl, email, token) {
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

// ── Add Comment ──
export async function jiraAddComment(issueKey, comment, baseUrl, email, token) {
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
