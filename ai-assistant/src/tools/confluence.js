import api, { route } from "@forge/api";

// ── Search Pages ──
export async function confluenceSearch(query) {
  try {
    const res  = await api.asUser().requestConfluence(
      route`/wiki/rest/api/search?cql=text~"${query}" AND type=page&limit=10`
    );
    const data = await res.json();
    console.log("🚀 ~ confluenceSearch ~ data:", data)
    const results = data.results?.map((r) => ({
      title: r.title,
      type:  r.type,
      space: r.resultParentContainer?.title,
    })) || [];
    return { content: [{ type: "text", text: JSON.stringify({ results, total: results.length }) }] };
  } catch (err) {
    return { content: [{ type: "text", text: `Error: ${err.message}` }] };
  }
}

// ── List Pages (all spaces or specific space) ──
export async function confluenceListPages(spaceKey) {
  console.log("🚀 confluenceListPages called with spaceKey:", spaceKey);

  try {
    // ✅ Build CQL correctly
    const cql = spaceKey
      ? `type="page" AND space="${spaceKey}"`
      : `type="page"`;

    console.log("🔍 CQL Query:", cql);

    let allPages = [];
    let start = 0;
    const limit = 25;
    let hasMore = true;

    while (hasMore) {
      console.log(`📡 Fetching pages: start=${start}`);

      // ✅ Use correct endpoint
      const res = await api.asUser().requestConfluence(
        route`/wiki/rest/api/search?cql=${cql}&limit=${limit}&start=${start}`
      );

      console.log("✅ Status:", res.status);

      const text = await res.text();
      console.log("📦 RAW RESPONSE:", text);

      const data = JSON.parse(text);

      const results = data.results || [];

      console.log(`📊 Fetched ${results.length} pages`);

      if (results.length === 0) {
        break; // ✅ stop if no more data
      }

      // ✅ Extract page info properly
      const pages = results
        .filter((r) => r.content) // search API wraps content
        .map((r) => ({
          title: r.content.title,
          id: r.content.id,
          space: r.content.space?.name || "Unknown",
        }));

      allPages = [...allPages, ...pages];

      // ✅ Pagination logic
      if (results.length < limit) {
        hasMore = false;
      } else {
        start += limit;
      }

      // ⚠️ Safety break (Forge timeout protection)
      if (start >= 100) {
        console.log("⛔ Stopping early to avoid timeout");
        break;
      }
    }

    // ✅ Handle empty result
    if (allPages.length === 0) {
      return {
        content: [
          {
            type: "text",
            text: "⚠️ No Confluence pages found. Possible reasons:\n- No access to pages\n- No pages exist\n- Wrong permissions context",
          },
        ],
      };
    }

    // ✅ Success response
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify({
            pages: allPages,
            total: allPages.length,
          }),
        },
      ],
    };
  } catch (err) {
    console.error("❌ Error in confluenceListPages:", err);

    return {
      content: [
        {
          type: "text",
          text: `❌ Error: ${err.message}`,
        },
      ],
    };
  }
}

// ── Read Page ──
export async function confluenceReadPage(title) {
  try {
    const res  = await api.asUser().requestConfluence(
      route`/wiki/rest/api/content?title=${title}&expand=body.storage&limit=1`
    );
    const data = await res.json();
    const page = data.results?.[0];
    if (!page) return { content: [{ type: "text", text: "Page not found." }] };

    const raw  = page.body?.storage?.value || "";
    let text   = raw.replace(/<[^>]+>/g, " ");

    text = text
      .replace(/&rsquo;/g, "'").replace(/&lsquo;/g, "'")
      .replace(/&ldquo;/g, '"').replace(/&rdquo;/g, '"')
      .replace(/&amp;/g, "&").replace(/&nbsp;/g, " ")
      .replace(/&lt;/g, "<").replace(/&gt;/g, ">")
      .replace(/&apos;/g, "'").replace(/&quot;/g, '"')
      .replace(/&#\d+;/g, " ")
      .replace(/\s+/g, " ").trim();

    if (text.length > 1500) text = text.substring(0, 1500) + "...";

    return { content: [{ type: "text", text: `Title: ${page.title}\n\n${text}` }] };
  } catch (err) {
    return { content: [{ type: "text", text: `Error: ${err.message}` }] };
  }
}

// ── List Spaces ──
export async function confluenceListSpaces() {
  try {
    const res = await api.asApp().requestConfluence(
      route`/wiki/api/v2/spaces?limit=10`
    );

    console.log("Status:", res.status);

    const data = await res.json();
    console.log("🚀 ~ confluenceListSpaces ~ data:", data);

    const spaces = data.results?.map((s) => ({
      key: s.key,
      name: s.name,
      type: s.type,
      id: s.id
    })) || [];

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify({ spaces }),
        },
      ],
    };
  } catch (err) {
    console.error("❌ Error:", err);

    return {
      content: [
        {
          type: "text",
          text: `Error: ${err.message}`,
        },
      ],
    };
  }
}

// ── Create Page ──
export async function confluenceCreatePage(title, content, spaceKey) {
  try {
    if (!spaceKey) {
      const spaceRes  = await api.asUser().requestConfluence(route`/wiki/rest/api/space?limit=10`);
      const spaceData = await spaceRes.json();
      const spaces    = spaceData.results?.filter((s) => s.type === "global") || [];
      spaceKey        = spaces[0]?.key;
    }

    if (!spaceKey) {
      return { content: [{ type: "text", text: "No Confluence space found." }] };
    }

    const res  = await api.asUser().requestConfluence(route`/wiki/rest/api/content`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type:  "page",
        title: title,
        space: { key: spaceKey },
        body: {
          storage: {
            value:          `<p>${content.replace(/\n/g, "</p><p>")}</p>`,
            representation: "storage",
          },
        },
      }),
    });

    const data = await res.json();
    if (data.id) {
      return { content: [{ type: "text", text: `Successfully created Confluence page: "${title}" in space ${spaceKey}` }] };
    }
    return { content: [{ type: "text", text: `Error creating page: ${JSON.stringify(data)}` }] };
  } catch (err) {
    return { content: [{ type: "text", text: `Error: ${err.message}` }] };
  }
}

// ── Update / Rename Page ──
export async function confluenceUpdatePage(title, newContent, newTitle) {
  try {
    const searchRes  = await api.asUser().requestConfluence(
      route`/wiki/rest/api/content?title=${title}&expand=version,space,body.storage&limit=1`
    );
    const searchData = await searchRes.json();
    const page       = searchData.results?.[0];

    if (!page) {
      return { content: [{ type: "text", text: `Page "${title}" not found.` }] };
    }

    const pageId          = page.id;
    const currentVersion  = page.version?.number || 1;
    const existingContent = page.body?.storage?.value || "";
    const finalContent    = newContent
      ? `<p>${newContent.replace(/\n/g, "</p><p>")}</p>`
      : existingContent;
    const finalTitle = newTitle || title;

    const res  = await api.asUser().requestConfluence(route`/wiki/rest/api/content/${pageId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        version: { number: currentVersion + 1 },
        title:   finalTitle,
        type:    "page",
        body: { storage: { value: finalContent, representation: "storage" } },
      }),
    });

    const data = await res.json();
    if (data.id) {
      if (newTitle && newTitle !== title) {
        return { content: [{ type: "text", text: `Successfully renamed page "${title}" to "${newTitle}"` }] };
      }
      return { content: [{ type: "text", text: `Successfully updated page "${finalTitle}"` }] };
    }
    return { content: [{ type: "text", text: `Error updating page: ${JSON.stringify(data)}` }] };
  } catch (err) {
    return { content: [{ type: "text", text: `Error: ${err.message}` }] };
  }
}

// ── Delete Page ──
export async function confluenceDeletePage(title) {
  try {
    const searchRes  = await api.asUser().requestConfluence(
      route`/wiki/rest/api/content?title=${title}&limit=1`
    );
    const searchData = await searchRes.json();
    const page       = searchData.results?.[0];

    if (!page) {
      return { content: [{ type: "text", text: `Page "${title}" not found.` }] };
    }

    const res = await api.asUser().requestConfluence(route`/wiki/rest/api/content/${page.id}`, {
      method: "DELETE",
    });

    if (res.status === 204) {
      return { content: [{ type: "text", text: `Successfully deleted page "${title}"` }] };
    }
    return { content: [{ type: "text", text: `Error deleting page "${title}"` }] };
  } catch (err) {
    return { content: [{ type: "text", text: `Error: ${err.message}` }] };
  }
}