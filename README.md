# Forge MCP — AI Assistant

An Atlassian Forge app that embeds an AI-powered chat assistant directly inside Confluence and Jira. The frontend and backend live together in the `ai-assistant/` folder as a single Forge app.

---

## Project Structure

```
forge_mcp/
└── ai-assistant/
    ├── manifest.yml                  # Forge app manifest (modules, permissions, runtime)
    ├── package.json                  # Backend dependencies (@forge/api, @forge/kvs, @forge/resolver)
    ├── src/
    │   └── index.js                  # Backend — Forge resolver (chat, Jira/Confluence tools, settings)
    └── static/
        └── hello-world/
            └── src/
                ├── App.js            # Frontend — React chat UI
                ├── App.css           # Styles
                ├── forgeBridge.js    # @forge/bridge invoke helper
                ├── index.js          # React entry point
                └── components/       # Reusable UI components
```

---

## How It Works

### Backend (`src/index.js`)

Built with `@forge/resolver`. Exposes the following resolver functions called from the frontend via `@forge/bridge`:

| Resolver | Description |
|---|---|
| `saveSettings` | Stores Atlassian credentials (URL, email, API token) in Forge KVS |
| `getSettings` | Reads stored credentials and returns configuration status |
| `clearSettings` | Deletes all stored credentials from KVS |
| `chat` | Main AI chat handler — routes messages to Groq and invokes Jira/Confluence tools as needed |

The `chat` resolver uses Groq as the LLM. It detects intent from the user's message (keywords like `jira`, `issue`, `confluence`, `page`, etc.) and calls the relevant Atlassian REST APIs before responding.

**Supported Atlassian operations:**
- Jira: search issues (JQL), get issue details, create issues, update status/assignee/priority, add comments
- Confluence: search pages, get page content, create/update pages

### Frontend (`static/hello-world/src/`)

A React app built with `@forge/bridge` for communicating with the backend resolver.

- On first load, checks if credentials are configured
- If not configured, shows a **Settings Form** to enter Atlassian site URL, email, and API token
- Once configured, shows the **Chat UI** — a full conversation thread with the AI assistant
- Credentials can be updated or cleared at any time via the settings button

---

## Forge Modules

Defined in `manifest.yml`:

| Module | Location | Route |
|---|---|---|
| `confluence:globalPage` | Confluence sidebar | `hello-world` |
| `jira:globalPage` | Jira sidebar | `hello-world` |

Both modules use the same React frontend and backend resolver.

---

## Prerequisites

- [Atlassian Forge CLI](https://developer.atlassian.com/platform/forge/getting-started/) installed and logged in
- Node.js 18+
- An Atlassian account with API token access
- A Groq API key (set via Forge environment variables)

---

## Setup & Development

```bash
# Install backend dependencies
cd ai-assistant
npm install

# Install frontend dependencies
cd static/hello-world
npm install

# Build the frontend
npm run build

# Go back to ai-assistant root
cd ../..

# Deploy to Atlassian Forge (staging)
forge deploy

# Install the app on your Atlassian site
forge install
```

For local development with tunnel:

```bash
forge tunnel
```

---

## Configuration (First Run)

1. Open the app in Confluence or Jira (Global Pages)
2. Enter your **Atlassian Site URL** — e.g. `https://your-company.atlassian.net`
3. Enter your **Atlassian Email**
4. Enter your **Atlassian API Token** — generate one at [id.atlassian.com](https://id.atlassian.com) → Security → API Tokens
5. Click **Save and Connect**

Credentials are stored securely in Forge KVS (key-value storage) and scoped to the app.

---

## Permissions

Declared in `manifest.yml`:

| Permission | Purpose |
|---|---|
| `storage:app` | Forge KVS for credential storage |
| `read/write:confluence-content` | Read and create Confluence pages |
| `search:confluence` | Search Confluence content |
| `read/write:jira-work` | Read and manage Jira issues |
| `read:jira-user` | Resolve Jira user/assignee info |
| `fetch: api.groq.com` | LLM API calls via Groq |
| `fetch: *.atlassian.net` | Atlassian REST API calls |

---

## Runtime

- **Runtime:** `nodejs24.x`
- **Architecture:** `arm64`
- **Memory:** 256 MB
