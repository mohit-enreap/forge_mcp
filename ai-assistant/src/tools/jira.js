import api, { route } from "@forge/api";

// ── Search Issues ──
export async function jiraSearch(jql) {
  try {
    let cleanJql = jql?.trim();

    // Normalize status values — handle LLM-generated variants (quoted or unquoted)
    if (cleanJql) {
      cleanJql = cleanJql
        .replace(/status\s*=\s*["']?To-Do["']?/gi,       'status="To Do"')
        .replace(/status\s*=\s*["']?todo["']?/gi,         'status="To Do"')
        .replace(/status\s*=\s*["']?In-Progress["']?/gi,  'status="In Progress"')
        .replace(/status\s*=\s*["']?in progress["']?/gi,  'status="In Progress"')
        .replace(/status\s*=\s*["']?done["']?/gi,         'status="Done"')
        .replace(/status\s*=\s*["']?in review["']?/gi,    'status="In Review"');
    }

    if (!cleanJql || !cleanJql.toLowerCase().includes("project")) {
      const projRes  = await api.asUser().requestJira(route`/rest/api/3/project?maxResults=50`);
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

    const res  = await api.asUser().requestJira(
      route`/rest/api/3/search/jql?jql=${cleanJql}&maxResults=15&fields=summary,status,priority,issuetype,assignee`
    );
    const data = await res.json();

    if (data.errorMessages?.length || data.errors) {
      return { content: [{ type: "text", text: `Jira error: ${JSON.stringify(data.errorMessages || data.errors)}` }] };
    }
    if (!data.issues?.length) {
      return { content: [{ type: "text", text: "No Jira issues found." }] };
    }

    const issues = data.issues.map((issue) => ({
      key:      issue.key,
      summary:  issue.fields?.summary,
      status:   issue.fields?.status?.name,
      priority: issue.fields?.priority?.name || "None",
      type:     issue.fields?.issuetype?.name,
      assignee: issue.fields?.assignee?.displayName || "Unassigned",
    }));

    return { content: [{ type: "text", text: JSON.stringify({ issues, total: issues.length }) }] };
  } catch (err) {
    console.error("jiraSearch error:", err.message);
    return { content: [{ type: "text", text: `Error: ${err.message}` }] };
  }
}

// ── Create Issue ──
export async function jiraCreate(args) {
  try {
    let projectKey = args.project_key;
    if (!projectKey) {
      const projRes  = await api.asUser().requestJira(route`/rest/api/3/project?maxResults=1`);
      const projData = await projRes.json();
      projectKey = Array.isArray(projData) ? projData?.[0]?.key : null;
    }

    if (!projectKey) {
      return { content: [{ type: "text", text: "No Jira project found." }] };
    }

    const res  = await api.asUser().requestJira(route`/rest/api/3/issue`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        fields: {
          project:     { key: projectKey },
          summary:     args.summary,
          description: {
            type: "doc", version: 1,
            content: [{ type: "paragraph", content: [{ type: "text", text: args.description || args.summary }] }],
          },
          issuetype: { name: args.issue_type || "Task" },
          priority:  { name: args.priority   || "Medium" },
        },
      }),
    });
    const data = await res.json();
    if (data.errors || data.errorMessages) {
      return { content: [{ type: "text", text: `Error: ${JSON.stringify(data.errors || data.errorMessages)}` }] };
    }
    return { content: [{ type: "text", text: `Created issue ${data.key}: ${args.summary}` }] };
  } catch (err) {
    return { content: [{ type: "text", text: `Error: ${err.message}` }] };
  }
}

// ── Read Issue ──
export async function jiraReadIssue(issueKey) {
  try {
    const res  = await api.asUser().requestJira(
      route`/rest/api/3/issue/${issueKey}?fields=summary,status,priority,issuetype,assignee,reporter,created,updated`
    );
    const data = await res.json();
    if (data.errorMessages || data.errors) {
      return { content: [{ type: "text", text: `Error: ${JSON.stringify(data.errorMessages || data.errors)}` }] };
    }
    return {
      content: [{
        type: "text",
        text: JSON.stringify({
          key:      data.key,
          summary:  data.fields?.summary,
          status:   data.fields?.status?.name,
          priority: data.fields?.priority?.name || "None",
          type:     data.fields?.issuetype?.name,
          assignee: data.fields?.assignee?.displayName  || "Unassigned",
          reporter: data.fields?.reporter?.displayName  || "Unknown",
          created:  data.fields?.created,
          updated:  data.fields?.updated,
        }),
      }],
    };
  } catch (err) {
    return { content: [{ type: "text", text: `Error: ${err.message}` }] };
  }
}

// ── Update Status ──
export async function jiraUpdateStatus(issueKey, statusName) {
  try {
    const transRes  = await api.asUser().requestJira(route`/rest/api/3/issue/${issueKey}/transitions`);
    const transData = await transRes.json();
    const transition = transData.transitions?.find(
      (t) =>
        t.name.toLowerCase().includes(statusName.toLowerCase()) ||
        t.to?.name.toLowerCase().includes(statusName.toLowerCase()),
    );

    if (!transition) {
      const available = transData.transitions?.map((t) => t.name).join(", ");
      return { content: [{ type: "text", text: `Status "${statusName}" not found. Available: ${available}` }] };
    }

    await api.asUser().requestJira(route`/rest/api/3/issue/${issueKey}/transitions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ transition: { id: transition.id } }),
    });

    return { content: [{ type: "text", text: `Successfully updated ${issueKey} status to "${transition.to?.name}"` }] };
  } catch (err) {
    return { content: [{ type: "text", text: `Error: ${err.message}` }] };
  }
}

// ── Update Priority ──
export async function jiraUpdatePriority(issueKey, priorityName) {
  try {
    const res = await api.asUser().requestJira(route`/rest/api/3/issue/${issueKey}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fields: { priority: { name: priorityName } } }),
    });
    if (res.status === 204) {
      return { content: [{ type: "text", text: `Successfully updated ${issueKey} priority to "${priorityName}"` }] };
    }
    const data = await res.json();
    return { content: [{ type: "text", text: `Error: ${JSON.stringify(data)}` }] };
  } catch (err) {
    return { content: [{ type: "text", text: `Error: ${err.message}` }] };
  }
}

// ── List Users ──
export async function jiraListUsers() {
  try {
    const res   = await api.asUser().requestJira(route`/rest/api/3/users/search?maxResults=50`);
    const users = await res.json();
    if (!Array.isArray(users) || !users.length) {
      return { content: [{ type: "text", text: "No users found in this workspace." }] };
    }
    const list = users
      .filter((u) => u.accountType === "atlassian")
      .map((u) => ({ name: u.displayName, email: u.emailAddress, accountId: u.accountId }));
    return { content: [{ type: "text", text: JSON.stringify({ users: list, total: list.length }) }] };
  } catch (err) {
    return { content: [{ type: "text", text: `Error: ${err.message}` }] };
  }
}

// ── Assign Issue ──
export async function jiraAssignIssue(issueKey, userName) {
  try {
    let user = null;

    // Strategy 1 — exact name search
    const s1 = await api.asUser().requestJira(route`/rest/api/3/user/search?query=${userName}&maxResults=10`);
    const r1  = await s1.json();
    if (Array.isArray(r1) && r1.length > 0) {
      user = r1.find((u) => u.displayName?.toLowerCase() === userName.toLowerCase()) || null;
    }

    // Strategy 2 — first name search
    if (!user) {
      const firstName = userName.split(" ")[0];
      const s2 = await api.asUser().requestJira(route`/rest/api/3/user/search?query=${firstName}&maxResults=10`);
      const r2  = await s2.json();
      if (Array.isArray(r2) && r2.length > 0) {
        user = r2.find((u) => u.displayName?.toLowerCase().includes(userName.toLowerCase())) || null;
      }
    }

    // Strategy 3 — full list scan
    if (!user) {
      const s3 = await api.asUser().requestJira(route`/rest/api/3/users/search?maxResults=50`);
      const r3  = await s3.json();
      if (Array.isArray(r3)) {
        user = r3.find(
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
            content: [{ type: "text", text: `User "${userName}" not found.\n\nAvailable users: ${available || "none found"}` }],
          };
        }
      }
    }

    if (!user) {
      return { content: [{ type: "text", text: `User "${userName}" not found.` }] };
    }

    const res = await api.asUser().requestJira(route`/rest/api/3/issue/${issueKey}/assignee`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ accountId: user.accountId }),
    });

    if (res.status === 204) {
      return { content: [{ type: "text", text: `Successfully assigned ${issueKey} to ${user.displayName}` }] };
    }
    const data = await res.json();
    return { content: [{ type: "text", text: `Error: ${JSON.stringify(data)}` }] };
  } catch (err) {
    return { content: [{ type: "text", text: `Error: ${err.message}` }] };
  }
}

// ── List Projects ──
export async function jiraListProjects() {
  try {
    const res  = await api.asUser().requestJira(route`/rest/api/3/project`);
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
export async function jiraAddComment(issueKey, comment) {
  try {
    await api.asUser().requestJira(route`/rest/api/3/issue/${issueKey}/comment`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        body: {
          type: "doc", version: 1,
          content: [{ type: "paragraph", content: [{ type: "text", text: comment }] }],
        },
      }),
    });
    return { content: [{ type: "text", text: `Comment added to ${issueKey}` }] };
  } catch (err) {
    return { content: [{ type: "text", text: `Error: ${err.message}` }] };
  }
}