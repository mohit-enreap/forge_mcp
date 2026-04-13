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

// ── List Pages across ALL spaces or a specific space ──
export async function confluenceListPages(spaceKey, baseUrl, email, token) {
  try {
    if (!spaceKey) {
      const spaceRes = await api.fetch(
        `${baseUrl}/wiki/rest/api/space?limit=50`,
        { headers: buildHeaders(email, token) },
      );
      const spaceData = await spaceRes.json();
      const allSpaces = spaceData.results || [];

      if (!allSpaces.length) {
        return {
          content: [{ type: "text", text: "No Confluence spaces found." }],
        };
      }

      let allPages = [];
      for (const space of allSpaces) {
        const res = await api.fetch(
          `${baseUrl}/wiki/rest/api/content?spaceKey=${space.key}&type=page&limit=25&expand=space,ancestors`,
          { headers: buildHeaders(email, token) },
        );
        const data = await res.json();
        if (data.results?.length) {
          const pages = data.results
            .filter((p) => p.ancestors && p.ancestors.length > 0)
            .map((p) => ({
              title: p.title,
              id: p.id,
              space: space.name || space.key,
            }));
          allPages = [...allPages, ...pages];
        }
      }

      if (!allPages.length) {
        return { content: [{ type: "text", text: "No content pages found." }] };
      }

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({
              pages: allPages,
              total: allPages.length,
              space: "all",
            }),
          },
        ],
      };
    }

    const res = await api.fetch(
      `${baseUrl}/wiki/rest/api/content?spaceKey=${spaceKey}&type=page&limit=25&expand=space,ancestors`,
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

    const pages = data.results
      .filter((p) => p.ancestors && p.ancestors.length > 0)
      .map((p) => ({
        title: p.title,
        id: p.id,
        space: p.space?.name || spaceKey,
      }));

    if (!pages.length) {
      return {
        content: [
          {
            type: "text",
            text: `No content pages found in space ${spaceKey}.`,
          },
        ],
      };
    }

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

    const raw = page.body?.storage?.value || "";

    let text = raw.replace(/<[^>]+>/g, " ");

    text = text
      .replace(/&rsquo;/g, "'")
      .replace(/&lsquo;/g, "'")
      .replace(/&ldquo;/g, '"')
      .replace(/&rdquo;/g, '"')
      .replace(/&amp;/g, "&")
      .replace(/&nbsp;/g, " ")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&apos;/g, "'")
      .replace(/&quot;/g, '"')
      .replace(/&#\d+;/g, " ");

    text = text.replace(/\s+/g, " ").trim();

    if (text.length > 1500) {
      text = text.substring(0, 1500) + "...";
    }

    return {
      content: [{ type: "text", text: `Title: ${page.title}\n\n${text}` }],
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

// ── Update/Edit Page (supports title rename + content update) ──
export async function confluenceUpdatePage(
  title,
  newContent,
  newTitle,
  baseUrl,
  email,
  token,
) {
  try {
    // Get page ID, current version and existing content
    const searchRes = await api.fetch(
      `${baseUrl}/wiki/rest/api/content?title=${encodeURIComponent(title)}&expand=version,space,body.storage&limit=1`,
      { headers: buildHeaders(email, token) },
    );
    const searchData = await searchRes.json();
    const page = searchData.results?.[0];

    if (!page) {
      return {
        content: [{ type: "text", text: `Page "${title}" not found.` }],
      };
    }

    const pageId = page.id;
    const currentVersion = page.version?.number || 1;

    // ✅ Keep existing content if no new content provided
    const existingContent = page.body?.storage?.value || "";
    const finalContent = newContent
      ? `<p>${newContent.replace(/\n/g, "</p><p>")}</p>`
      : existingContent;

    // ✅ Keep existing title if no new title provided
    const finalTitle = newTitle || title;

    const res = await api.fetch(`${baseUrl}/wiki/rest/api/content/${pageId}`, {
      method: "PUT",
      headers: buildHeaders(email, token),
      body: JSON.stringify({
        version: { number: currentVersion + 1 },
        title: finalTitle,
        type: "page",
        body: {
          storage: {
            value: finalContent,
            representation: "storage",
          },
        },
      }),
    });

    const data = await res.json();
    if (data.id) {
      if (newTitle && newTitle !== title) {
        return {
          content: [
            {
              type: "text",
              text: `Successfully renamed page "${title}" to "${newTitle}"`,
            },
          ],
        };
      }
      return {
        content: [
          { type: "text", text: `Successfully updated page "${finalTitle}"` },
        ],
      };
    }
    return {
      content: [
        { type: "text", text: `Error updating page: ${JSON.stringify(data)}` },
      ],
    };
  } catch (err) {
    return { content: [{ type: "text", text: `Error: ${err.message}` }] };
  }
}
