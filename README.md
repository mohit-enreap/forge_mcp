# Forge MCP — AI Assistant for Atlassian Confluence & Jira

An AI-powered chat assistant embedded inside **Atlassian Confluence and Jira** as a Global Page Custom UI. Built on **Atlassian Forge**, it uses **Groq's LLM** (LLaMA 3.3 70B) for natural language understanding and the **Model Context Protocol (MCP)** to interact with Jira and Confluence APIs in real time.

Ask questions like *"Show me all open bugs in KAN"* or *"Create a task for the login bug"* — and the assistant takes action directly inside your Atlassian workspace.

---

## Table of Contents

- [Project Overview](#1-project-overview)
- [Architecture](#2-architecture)
- [Folder Structure](#3-folder-structure)
- [Prerequisites](#4-prerequisites)
- [Installation & Setup](#5-installation--setup)
- [MCP Bridge Setup](#6-mcp-bridge-setup)
- [server.js Deep Explanation](#7-serverjs-deep-explanation)
- [manifest.yml Explained](#8-manifestyml-explained)
- [How Everything Connects](#9-how-everything-connects)
- [Troubleshooting](#10-troubleshooting)
- [Suggested Improvements](#11-suggested-improvements)

---

## 1. Project Overview

### What it does

This project embeds an AI chat assistant inside Atlassian Confluence and Jira as a Global Page. Users can:

- **Search Jira issues** using natural language (converted to JQL)
- **Create Jira tickets** with a description, type, and priority
- **Search and read Confluence pages**
- **List projects and spaces**
- Ask general questions answered by the LLM directly

### Key Features

| Feature | Description |
|---|---|
| Natural Language → JQL | Converts plain English queries to Jira Query Language |
| Agentic Tool Calling | LLM decides which tool to use and iterates up to 5 times |
| Smart Tool Selection | Filters tools by keyword to reduce LLM context size |
| MCP Integration | Uses the Model Context Protocol for Atlassian tool discovery |
| Direct Jira API Fallback | Bypasses MCP for Jira search/create to avoid schema issues |
| Forge Custom UI | Secure, embedded React app inside Atlassian with no CORS |

### Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 16, Tailwind CSS, `@forge/bridge` |
| Forge Backend | Atlassian Forge (Node.js 24.x, ARM64) |
| LLM | Groq API — `llama-3.3-70b-versatile` |
| MCP Server | `mcp-atlassian` via stdio transport |
| MCP Bridge | Node.js + Express v5 |
| Atlassian APIs | Jira REST API v3, Confluence REST API |

---

## 2. Architecture

### High-Level Diagram

```
┌─────────────────────────────────────────┐
│           Atlassian Confluence / Jira   │
│                                         │
│  ┌──────────────────────────────────┐   │
│  │     React Frontend (Custom UI)   │   │
│  │  ChatWindow · InputBar · Bubbles │   │
│  └──────────────┬───────────────────┘   │
│                 │ @forge/bridge.invoke() │
│  ┌──────────────▼───────────────────┐   │
│  │   Forge Backend (index.js)       │   │
│  │   resolver.define("chat")        │   │
│  │   • Fetch MCP tools              │   │
│  │   • Select relevant tools        │   │
│  │   • Call Groq LLM                │   │
│  │   • Execute tool calls (loop ×5) │   │
│  └─────────┬──────────┬─────────────┘   │
│            │          │                 │
└────────────┼──────────┼─────────────────┘
             │          │
    HTTPS    │          │ HTTPS
             ▼          ▼
   ┌──────────────┐  ┌──────────────────┐
   │  Groq API    │  │  mcp-bridge      │
   │  LLaMA 3.3   │  │  (server.js)     │
   │  70B model   │  │  :3333           │
   └──────────────┘  └──────┬───────────┘
                            │
                   ┌────────┴─────────┐
                   │                  │
          ┌────────▼──────┐  ┌────────▼──────┐
          │  Jira REST    │  │  MCP Client   │
          │  API v3       │  │  (stdio)      │
          │  (direct)     │  │  mcp-atlassian│
          └───────────────┘  └────────┬──────┘
                                      │
                             ┌────────▼──────┐
                             │  Confluence   │
                             │  REST API     │
                             └───────────────┘
```

### Data Flow

1. **User types a message** in the React chat UI
2. **`@forge/bridge.invoke("chat", payload)`** securely sends the message to the Forge backend — no CORS, no exposed credentials
3. **Forge backend** (`src/index.js`):
   - Calls `mcp-bridge /tools/list` to discover available MCP tools
   - Filters tools based on keywords in the user's message (`selectRelevantTools`)
   - Sends the message + tools to the **Groq LLM**
4. **Groq LLM** decides whether to call a tool or answer directly
5. **If a tool is needed**, the backend calls `mcp-bridge /tools/call` with the tool name and arguments
6. **mcp-bridge** either:
   - Handles Jira search/create directly via the Jira REST API (bypasses MCP)
   - Forwards all other tool calls to `mcp-atlassian` over stdio
7. **Tool result** is fed back into the LLM as a `tool` message (agentic loop, max 5 iterations)
8. **Final text response** is returned to the React frontend
9. The response renders as a message bubble in the chat UI

### Role of the MCP Server

The **MCP server** (`mcp-atlassian`) is an npm package that wraps Atlassian APIs in the [Model Context Protocol](https://modelcontextprotocol.io/) standard. It runs as a **child process** launched by `mcp-bridge` via stdio. It exposes Confluence tools (page search, read, create, list spaces) that don't have custom direct implementations in `server.js`.

Jira tools (`search_jira_issues`, `create_jira_issue`) bypass MCP and call the Jira REST API directly because the MCP-provided schemas had parameter conflicts that caused LLM hallucinations.

---

## 3. Folder Structure

```
forge_mcp/
│
├── ai-assistant/                     # The Atlassian Forge app
│   ├── manifest.yml                  # Forge app registration & permissions
│   ├── package.json                  # Backend dependencies (Forge runtime)
│   ├── src/
│   │   └── index.js                  # Forge backend resolver — LLM + MCP orchestration
│   │
│   └── static/hello-world/           # React frontend (Custom UI)
│       ├── package.json              # Frontend dependencies
│       ├── tailwind.config.js        # Tailwind CSS configuration
│       ├── postcss.config.js         # PostCSS configuration
│       ├── public/
│       │   └── index.html            # HTML shell
│       ├── src/
│       │   ├── index.js              # React entry point
│       │   ├── App.js                # Root component — state + message sending
│       │   ├── forgeBridge.js        # Abstraction: Forge invoke vs. local mock
│       │   ├── index.css             # Tailwind + global styles
│       │   └── components/
│       │       ├── ChatWindow.jsx    # Scrollable message history + welcome screen
│       │       ├── InputBar.jsx      # Textarea input + send button
│       │       ├── MessageBubble.jsx # Individual message (user / AI)
│       │       └── TypingIndicator.jsx # Animated loading dots
│       └── build/                    # Production build output — served by Forge
│
├── mcp-bridge/                       # Standalone Express server — MCP middleware
│   ├── server.js                     # Main server: routes, direct Jira calls, MCP passthrough
│   ├── package.json                  # Server dependencies
│   └── .env                          # Atlassian credentials (never commit this)
│
└── README.md                         # This file
```

### Key Files at a Glance

| File | Purpose |
|---|---|
| `ai-assistant/manifest.yml` | Defines Forge modules, permissions, runtime, and static resource path |
| `ai-assistant/src/index.js` | Core intelligence: LLM calls, tool selection, agentic loop |
| `static/hello-world/src/App.js` | Frontend state management, sends messages to Forge backend |
| `static/hello-world/src/forgeBridge.js` | Switches between `@forge/bridge` (prod) and mock (local dev) |
| `mcp-bridge/server.js` | HTTP-to-MCP adapter; direct Jira API handler |
| `mcp-bridge/.env` | Atlassian credentials loaded at runtime |

---

## 4. Prerequisites

### Required Tools

| Tool | Version | Purpose |
|---|---|---|
| Node.js | ≥ 18.x (recommend 20 LTS) | Run both Forge backend and mcp-bridge |
| npm | ≥ 9.x | Package management |
| Forge CLI | Latest | Deploy and manage the Forge app |
| Git | Any | Clone the repository |

### Atlassian Requirements

- An Atlassian cloud account (Confluence and Jira access)
- A Jira project with key `KAN` (or update the hardcoded project key in `server.js`)
- An [Atlassian API Token](https://id.atlassian.com/manage-profile/security/api-tokens)

### External API Requirements

- A **Groq API key** from [console.groq.com](https://console.groq.com)
- A **publicly reachable URL** for `mcp-bridge` (the Forge backend cannot call `localhost` — use a tunnel; see [MCP Bridge Setup](#6-mcp-bridge-setup))

### Install Forge CLI

```bash
npm install -g @forge/cli
forge login
```

---

## 5. Installation & Setup

### a. Clone the Repository

```bash
git clone <your-repo-url>
cd forge_mcp
```

### b. Install Dependencies

Install all three dependency sets:

```bash
# 1. Forge backend
cd ai-assistant
npm install

# 2. React frontend
cd static/hello-world
npm install
cd ../..

# 3. MCP Bridge
cd ../../mcp-bridge
npm install
cd ..
```

### c. Build the React Frontend

The Forge app serves the frontend from the compiled `build/` directory. You must build before deploying.

```bash
cd ai-assistant/static/hello-world
npm run build
cd ../../..
```

This produces `ai-assistant/static/hello-world/build/` — the path referenced in `manifest.yml`.

### d. Configure Forge Environment Variables

Set the required secrets in Forge (these are stored securely and injected at runtime):

```bash
cd ai-assistant

# Your Groq API key
forge variables set GROQ_API_KEY

# The public URL of your running mcp-bridge (e.g., tunnel URL)
forge variables set MCP_SERVER_URL
```

Verify the variables:

```bash
forge variables list
```

### e. Register the Forge App

> Skip this step if the app already has an ID in `manifest.yml` (check the `app.id` field).

```bash
cd ai-assistant
forge register
```

### f. Deploy the Forge App

```bash
cd ai-assistant
forge deploy
```

This packages and uploads the backend (`src/index.js`) and the frontend (`static/hello-world/build/`) to Atlassian's infrastructure.

### g. Install the App on Your Atlassian Site

```bash
forge install
```

You will be prompted to select your Atlassian cloud site and which products (Confluence, Jira) to install on.

To reinstall after changes:

```bash
forge install --upgrade
```

### h. Verify the Installation

In Confluence, navigate to **Apps → ai-assistant** in the global navigation. In Jira, check the global pages section. The chat UI should appear.

---

## 6. MCP Bridge Setup

### What is the MCP Bridge?

The `mcp-bridge` is a **locally-run Express server** that acts as a translation layer between the Forge backend (which can only make HTTPS calls) and the MCP protocol (which communicates over stdio with a child process).

The Forge runtime cannot spawn child processes — so `mcp-bridge` handles that, and Forge communicates with it over HTTP.

### Configure Credentials

Create `mcp-bridge/.env`:

```dotenv
ATLASSIAN_BASE_URL=https://your-domain.atlassian.net
ATLASSIAN_EMAIL=your-email@example.com
ATLASSIAN_API_TOKEN=your_atlassian_api_token
PORT=3333
```

> Never commit `.env` to version control. It is already in `.gitignore`.

### Run the MCP Bridge

```bash
cd mcp-bridge
node server.js
```

Expected output:

```
MCP Bridge running on http://localhost:3333
Connecting to MCP server via stdio...
Connected to MCP server successfully!
Loaded 11 tools
```

### Expose via Tunnel (Required for Forge)

Forge's backend runs in Atlassian's cloud and cannot reach `localhost`. You must expose `mcp-bridge` using a tunnel:

**Option 1 — VS Code Dev Tunnels:**
```bash
# In VS Code: Ports panel → Forward Port 3333 → Set visibility to Public
# Copy the tunnel URL (e.g., https://abc123.devtunnels.ms)
```

**Option 2 — ngrok:**
```bash
ngrok http 3333
# Copy the https URL from ngrok output
```

Then update the Forge environment variable:

```bash
cd ai-assistant
forge variables set MCP_SERVER_URL
# Enter: https://your-tunnel-url.devtunnels.ms
```

Redeploy after updating:

```bash
forge deploy
```

### Verify the MCP Bridge

```bash
# Health check
curl http://localhost:3333/health

# Expected response:
# {"status":"ok","mcp":"connected","tools":11}

# Test Jira connectivity
curl http://localhost:3333/test-jira
```

### How the Frontend Connects to the MCP Bridge

The frontend **does not** connect to `mcp-bridge` directly. The connection chain is:

```
React Frontend
    → @forge/bridge.invoke("chat", ...)
        → Forge Backend (index.js)
            → fetch(MCP_SERVER_URL + "/tools/list")
            → fetch(MCP_SERVER_URL + "/tools/call")
                → mcp-bridge (server.js)
```

The `MCP_SERVER_URL` environment variable in the Forge backend is the only connection point.

---

## 7. server.js Deep Explanation

**Location:** `mcp-bridge/server.js`

### Why It Exists

The Forge runtime executes JavaScript in a sandboxed environment with no access to the local filesystem, child processes, or stdio. The `mcp-atlassian` npm package communicates via **stdio** — it must be run as a subprocess. `server.js` bridges this gap by:

1. Running as a regular Node.js process (outside Forge)
2. Spawning `mcp-atlassian` as a child process via the MCP SDK's `StdioClientTransport`
3. Exposing the MCP capabilities as simple HTTP endpoints that Forge can call

### Endpoints

#### `POST /tools/list`

Returns the list of available MCP tools. Loads tools once and caches them.

Also **patches two tool schemas** to prevent LLM hallucinations:

- `search_jira_issues`: Strips out `fields`, `maxResults`, and `startAt` — the LLM would pass these but they caused errors. Now only `jql` is accepted.
- `list_jira_projects`: Cleans up the `expand` parameter description.

```bash
curl -X POST http://localhost:3333/tools/list -H "Content-Type: application/json" -d '{}'
```

#### `POST /tools/call`

Executes a tool by name with arguments. This is the main action endpoint.

**Special handling for Jira tools:**

- **`search_jira_issues`** — Calls the Jira REST API directly:
  - Normalizes JQL: replaces `currentUser()` with the actual email
  - Defaults to `project = KAN ORDER BY created DESC` if JQL is blank or starts with `ORDER BY`
  - First fetches issue IDs, then fetches full details for each (key, summary, status, priority, type, assignee)

- **`create_jira_issue`** — Calls the Jira REST API directly:
  - Creates in the `KAN` project
  - Accepts `summary`, `description`, `issue_type`, `priority`
  - Formats the description as Atlassian Document Format (ADF)

- **All other tools** — Passed through to the MCP client (Confluence tools, `read_jira_issue`, etc.)

```bash
curl -X POST http://localhost:3333/tools/call \
  -H "Content-Type: application/json" \
  -d '{"name": "search_jira_issues", "arguments": {"jql": "project = KAN AND status = Open"}}'
```

#### `GET /health`

Returns the server status, MCP connection state, and number of cached tools.

#### `GET /test-jira`

Debug endpoint. Directly queries the Jira API and returns the first 5 issues from `KAN`. Use this to verify Atlassian credentials are working.

### MCP Connection

```javascript
const transport = new StdioClientTransport({
  command: 'npx',
  args: ['mcp-atlassian'],
  env: { ATLASSIAN_BASE_URL, ATLASSIAN_EMAIL, ATLASSIAN_API_TOKEN }
});
const mcpClient = new Client({ name: 'mcp-bridge', version: '1.0.0' }, { capabilities: {} });
await mcpClient.connect(transport);
```

`mcp-atlassian` is launched as a child process and communicates over stdin/stdout using the MCP JSON-RPC protocol. The MCP SDK wraps this in a typed client interface.

### Authentication

All direct Jira API calls use **HTTP Basic Authentication** with base64-encoded `email:token`:

```javascript
const auth = Buffer.from(`${email}:${token}`).toString('base64');
// Header: Authorization: Basic <base64>
```

---

## 8. manifest.yml Explained

```yaml
modules:
  confluence:globalPage:              # Adds a Global Page in Confluence
    - key: ai-assistant-hello-world
      resource: main                  # Serves static/hello-world/build
      resolver:
        function: resolver            # Backend function for @forge/bridge calls
      title: ai-assistant
      route: hello-world

  jira:globalPage:                    # Adds a Global Page in Jira
    - key: ai-assistant-jira-global
      resource: main
      resolver:
        function: resolver
      title: ai-assistant
      route: hello-world

  function:
    - key: resolver
      handler: index.handler          # Entry point: src/index.js → export handler

resources:
  - key: main
    path: static/hello-world/build    # Built React app served as Custom UI

permissions:
  scopes:
    - read:confluence-content.all     # Read all Confluence pages
    - write:confluence-content        # Create/update Confluence pages
    - read:confluence-space.summary   # List Confluence spaces
    - search:confluence               # Search Confluence content
    - read:jira-work                  # Read Jira issues
    - write:jira-work                 # Create/update Jira issues
    - read:jira-user                  # Read Jira user info
  external:
    fetch:
      backend:
        - "https://generativelanguage.googleapis.com"  # (reserved, not used)
        - "https://api.groq.com"                       # Groq LLM API
        - "https://*.devtunnels.ms"                    # Dev tunnel for mcp-bridge

app:
  runtime:
    name: nodejs24.x
    memoryMB: 256
    architecture: arm64
  id: ari:cloud:ecosystem::app/0dcee5bc-b384-4f3f-afad-3ed2e611d3a0
```

> **Important:** The `external.fetch.backend` list must include the `mcp-bridge` tunnel URL's domain. If you switch tunnel providers, add the new domain here and redeploy.

---

## 9. How Everything Connects

Here is the complete end-to-end flow for a user message:

```
User: "Show me all open bugs"
         │
         ▼
  InputBar.jsx → onSend("Show me all open bugs")
         │
         ▼
  App.js → sendMessage(text)
    • Adds user message to state
    • Sets isLoading = true
    • Calls invokeBackend("chat", { message, history: last10 })
         │
         ▼
  forgeBridge.js → @forge/bridge.invoke("chat", payload)
         │  [Forge sandboxed IPC — no HTTP, no CORS]
         ▼
  Forge Backend → resolver.define("chat", handler)
    1. Reads GROQ_API_KEY, MCP_SERVER_URL from env
    2. POST MCP_SERVER_URL/tools/list → gets 11 tools
    3. selectRelevantTools("show me all open bugs")
       → keywords: "show" → returns 6 Jira tools
    4. mcpToolsToGroqFormat() → converts to OpenAI function format
    5. callGroq(messages, apiKey, 6 tools)
         │
         ▼
  Groq API (llama-3.3-70b-versatile)
    → finish_reason: "tool_calls"
    → tool: search_jira_issues
    → args: { "jql": "project = KAN AND issuetype = Bug AND status = Open" }
         │
         ▼
  Forge Backend → callMCPTool(mcpUrl, "search_jira_issues", { jql })
         │
         ▼
  mcp-bridge POST /tools/call
    → name = "search_jira_issues" (intercepted, not passed to MCP)
    → directJiraSearch(jql)
       • GET /rest/api/3/search/jql?jql=...&maxResults=10
       • For each issue: GET /rest/api/3/issue/{id}?fields=...
    → returns { issues: [...], total: 3 }
         │
         ▼
  Forge Backend → appends tool result to messages
    → callGroq(messages + tool result, apiKey, tools)
         │
         ▼
  Groq API
    → finish_reason: "stop"
    → content: "Here are 3 open bugs in KAN: ..."
         │
         ▼
  Forge Backend → return { error: false, text: "Here are 3 open bugs..." }
         │
         ▼
  App.js → setMessages([...messages, { role: "assistant", content: text }])
         │
         ▼
  ChatWindow.jsx → renders MessageBubble with AI response
  TypingIndicator disappears, response is displayed
```

---

## 10. Troubleshooting

### Forge Deployment Issues

**`forge deploy` fails with permission error**

Make sure you are logged in with the correct account:
```bash
forge logout
forge login
```

**`forge deploy` fails: "resource path not found"**

The frontend build is missing. Run:
```bash
cd ai-assistant/static/hello-world
npm run build
cd ../../..
forge deploy
```

**Changes not reflected after deploy**

Forge caches aggressively. Try:
```bash
forge deploy --no-cache
# or
forge install --upgrade
```

**External fetch blocked**

If `mcp-bridge` uses a tunnel domain not in `manifest.yml`, add it to `permissions.external.fetch.backend` and redeploy:
```yaml
- "https://*.ngrok-free.app"   # if using ngrok
```

---

### MCP Bridge / Connection Errors

**Forge backend returns: "MCP server URL not configured"**

The `MCP_SERVER_URL` environment variable is not set:
```bash
forge variables set MCP_SERVER_URL
forge deploy
```

**`server.js` fails to connect: "spawn npx ENOENT"**

`npx` is not in the PATH when running via a service manager. Use the full path:
```bash
which npx  # e.g. /usr/local/bin/npx
```
Then update the `command` in `server.js` to the full path.

**Jira API returns 401 Unauthorized**

Your API token is incorrect or expired. Generate a new one at:
`https://id.atlassian.com/manage-profile/security/api-tokens`

Then update `mcp-bridge/.env` and restart.

**Jira search returns "No issues found" unexpectedly**

Check with the test endpoint:
```bash
curl http://localhost:3333/test-jira
```
If this also returns nothing, verify the project key (`KAN`) matches your Jira project.

**Tunnel disconnects during use**

Forge calls will fail mid-conversation. Keep the tunnel process running. Consider running it as a background service. Reconnect and update `MCP_SERVER_URL` if the URL changes.

**Rate limit error from Groq**

The backend returns: `"Too many requests. Please wait a moment and try again."` This is the Groq API rate limit on the free tier. Wait a few seconds and retry.

---

### Local Development

**Chat shows mock responses ("This is a simulated response")**

`forgeBridge.js` detects it's not inside Forge (i.e., `window.self === window.top`) and returns a mock. This is expected when running with `npm start` in the browser outside Forge.

To test the real integration, deploy to Forge and use the Confluence/Jira interface.

---

## 11. Suggested Improvements

### Code Quality

- **Hardcoded project key**: `KAN` is hardcoded in `server.js` in several places. Move it to the `.env` file as `JIRA_PROJECT_KEY` and reference `process.env.JIRA_PROJECT_KEY`.
- **Tool schema patching**: The schema fixes in `/tools/list` are applied once on first load. Consider loading a local override file (`tool-overrides.json`) rather than patching in code.
- **Error types**: The Forge backend returns `{ error: true, text: "..." }` for all errors. Add an error code field to let the frontend differentiate rate limits from config errors from tool failures.

### Architecture

- **Production tunnel**: Replace dev tunnels with a permanently hosted instance of `mcp-bridge` (e.g., a small VPS, Railway, or Fly.io deployment). This removes the tunnel dependency and makes the app always-on.
- **Conversation persistence**: Currently, only the last 10 messages are sent as history and nothing is persisted. Use Forge Storage (`@forge/api` `storage.set/get`) to save conversation history per user.
- **Multi-project support**: Allow users to select which Jira project to query through the UI rather than defaulting to `KAN`.

### Performance

- **Tool caching in Forge**: `getMCPTools()` is called on every chat request. Cache the tool list in Forge Storage with a TTL (e.g., 5 minutes) to reduce round trips to `mcp-bridge`.
- **Parallel tool calls**: The agentic loop currently executes tool calls sequentially. Groq can return multiple tool calls in one response — handle them in parallel with `Promise.all`.
- **Streaming responses**: Groq supports streaming (`stream: true`). Implementing streaming in Forge (via `@forge/api` response streaming) would make the UI feel faster for long responses.

### Security

- **Tunnel authorization**: The `x-tunnel-authorization: bypass` header in `index.js` suggests a bypass pattern. For production, implement proper authentication (e.g., a shared secret validated in `server.js` middleware).
- **Input validation**: Add JQL injection protection in `directJiraSearch` — sanitize or allowlist JQL operators before passing to the Jira API.
- **Rotate the API token**: The `.env` file in the repository contains a live Atlassian API token. Rotate it immediately if this repository has ever been pushed to a remote.
