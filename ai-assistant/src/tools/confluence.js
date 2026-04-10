import api from "@forge/api";
import { buildHeaders } from "../credentials.js";

// ── Search Pages (by keyword — pages only, no SVGs) ──
export async function confluenceSearch(query, baseUrl, email, token) {
  try {
    const res = await api.fetch(
      `${baseUrl}/wiki/rest/api/search?cql=text~"${encodeURIComponent(query)}" AND type=page&limit=10`,
      { headers: buildHeaders(email, token) },
    );
    const data = await res.json();
    const results =
      data.results?.map((r) => ({
        title: r.title,
        type: r.type,
        space: r.resultParentContainer?.title,
      })) || [];
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify({ results, total: results.length }),
        },
      ],
    };
  } catch (err) {
    return { content: [{ type: "text", text: `Error: ${err.message}` }] };
  }
}

// ── List Pages in a Space ──
export async function confluenceListPages(spaceKey, baseUrl, email, token) {
  try {
    // Auto-detect space if not provided
    if (!spaceKey) {
      const spaceRes = await api.fetch(
        `${baseUrl}/wiki/rest/api/space?limit=10`,
        { headers: buildHeaders(email, token) },
      );
      const spaceData = await spaceRes.json();
      const spaces =
        spaceData.results?.filter((s) => s.type === "global") || [];
      if (!spaces.length)
        return {
          content: [{ type: "text", text: "No Confluence spaces found." }],
        };
      spaceKey = spaces[0].key;
    }

    const res = await api.fetch(
      `${baseUrl}/wiki/rest/api/content?spaceKey=${spaceKey}&type=page&limit=25&expand=space`,
      { headers: buildHeaders(email, token) },
    );
    const data = await res.json();

    if (!data.results?.length) {
      return {
        content: [
          { type: "text", text: `No pages found in space ${spaceKey}.` },
        ],
      };
    }

    const pages = data.results.map((p) => ({
      title: p.title,
      id: p.id,
      space: p.space?.name || spaceKey,
    }));

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify({ pages, total: pages.length, space: spaceKey }),
        },
      ],
    };
  } catch (err) {
    return { content: [{ type: "text", text: `Error: ${err.message}` }] };
  }
}

// ── Read Page ──
export async function confluenceReadPage(title, baseUrl, email, token) {
  try {
    const res = await api.fetch(
      `${baseUrl}/wiki/rest/api/content?title=${encodeURIComponent(title)}&expand=body.storage&limit=1`,
      { headers: buildHeaders(email, token) },
    );
    const data = await res.json();
    const page = data.results?.[0];
    if (!page) return { content: [{ type: "text", text: "Page not found." }] };
    const body =
      page.body?.storage?.value?.replace(/<[^>]+>/g, " ").substring(0, 2000) ||
      "";
    return {
      content: [{ type: "text", text: `Title: ${page.title}\n\n${body}` }],
    };
  } catch (err) {
    return { content: [{ type: "text", text: `Error: ${err.message}` }] };
  }
}

// ── List Spaces ──
export async function confluenceListSpaces(baseUrl, email, token) {
  try {
    const res = await api.fetch(`${baseUrl}/wiki/rest/api/space?limit=10`, {
      headers: buildHeaders(email, token),
    });
    const data = await res.json();
    const spaces =
      data.results?.map((s) => ({ key: s.key, name: s.name, type: s.type })) ||
      [];
    return { content: [{ type: "text", text: JSON.stringify({ spaces }) }] };
  } catch (err) {
    return { content: [{ type: "text", text: `Error: ${err.message}` }] };
  }
}

// ── Create Page ──
export async function confluenceCreatePage(
  title,
  content,
  spaceKey,
  baseUrl,
  email,
  token,
) {
  try {
    if (!spaceKey) {
      const spaceRes = await api.fetch(
        `${baseUrl}/wiki/rest/api/space?limit=10`,
        { headers: buildHeaders(email, token) },
      );
      const spaceData = await spaceRes.json();
      const spaces =
        spaceData.results?.filter((s) => s.type === "global") || [];
      spaceKey = spaces[0]?.key;
    }

    if (!spaceKey) {
      return {
        content: [{ type: "text", text: "No Confluence space found." }],
      };
    }

    const res = await api.fetch(`${baseUrl}/wiki/rest/api/content`, {
      method: "POST",
      headers: buildHeaders(email, token),
      body: JSON.stringify({
        type: "page",
        title: title,
        space: { key: spaceKey },
        body: {
          storage: {
            value: `<p>${content.replace(/\n/g, "</p><p>")}</p>`,
            representation: "storage",
          },
        },
      }),
    });

    const data = await res.json();
    if (data.id) {
      return {
        content: [
          {
            type: "text",
            text: `Successfully created Confluence page: "${title}" in space ${spaceKey}`,
          },
        ],
      };
    }
    return {
      content: [
        { type: "text", text: `Error creating page: ${JSON.stringify(data)}` },
      ],
    };
  } catch (err) {
    return { content: [{ type: "text", text: `Error: ${err.message}` }] };
  }
}
