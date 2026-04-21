import api, { route } from "@forge/api";

// ONLY handles API communication
export async function searchJiraIssuesApi(jql) {
  try {
    const res = await api.asUser().requestJira(
      route`/rest/api/3/search/jql?jql=${jql}&maxResults=15&fields=summary,status,priority,issuetype,assignee`
    );

    const data = await res.json();

    if (data.errorMessages?.length || data.errors) {
      throw new Error(JSON.stringify(data.errorMessages || data.errors));
    }

    return data;
  } catch (err) {
    throw new Error(`Jira API Error: ${err.message}`);
  }
}

export async function getIssueTypesApi(projectKey) {
  const res = await api.asUser().requestJira(
    route`/rest/api/3/issue/createmeta?projectKeys=${projectKey}&expand=projects.issuetypes`
  );

  const data = await res.json();

  return (
    data?.projects?.[0]?.issuetypes?.map((t) => t.name) || []
  );
}

// API layer ONLY
export async function createJiraIssueApi(payload) {
  try {
    const res = await api.asUser().requestJira(route`/rest/api/3/issue`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const data = await res.json();

    if (data.errors || data.errorMessages) {
      throw new Error(JSON.stringify(data.errors || data.errorMessages));
    }

    return data;
  } catch (err) {
    throw new Error(`Jira API Error: ${err.message}`);
  }
}

export async function getJiraIssueApi(issueKey) {
  try {
    const res = await api.asUser().requestJira(
      route`/rest/api/3/issue/${issueKey}?fields=summary,status,priority,issuetype,assignee,reporter,created,updated,description`
    );

    const data = await res.json();

    if (data.errorMessages || data.errors) {
      throw new Error(JSON.stringify(data.errorMessages || data.errors));
    }

    return data;
  } catch (err) {
    throw new Error(`Jira API Error: ${err.message}`);
  }
}



export async function updateJiraIssueStatusApi(issueKey, transitionId) {
  try {
    const res = await api.asUser().requestJira(
      route`/rest/api/3/issue/${issueKey}/transitions`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          transition: { id: transitionId },
        }),
      }
    );

    // Jira returns empty body on success sometimes
    if (!res.ok) {
      const data = await res.json();
      throw new Error(JSON.stringify(data));
    }

    return { success: true };
  } catch (err) {
    throw new Error(`Jira API Error: ${err.message}`);
  }
}

// Get available transitions
export async function getJiraTransitionsApi(issueKey) {
  try {
    const res = await api.asUser().requestJira(
      route`/rest/api/3/issue/${issueKey}/transitions`
    );

    const data = await res.json();

    if (data.errorMessages || data.errors) {
      throw new Error(JSON.stringify(data.errorMessages || data.errors));
    }

    return data.transitions || [];
  } catch (err) {
    throw new Error(`Jira API Error: ${err.message}`);
  }
}