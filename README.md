# Forge AI Assistant — Jira & Confluence Chatbot

An AI-powered chat assistant embedded directly inside **Atlassian Confluence and Jira** as a native Forge app. Users can ask natural language questions and the assistant will search issues, create tickets, assign work, browse Confluence pages, and more — all without leaving their Atlassian workspace.

> Built on **Atlassian Forge** (Custom UI) + **React** frontend + **Groq LLM** (Llama 3.3 70B) + **Atlassian REST APIs**.

---

## Table of Contents

- [What This Project Does](#what-this-project-does)
- [Tech Stack](#tech-stack)
- [Architecture Overview](#architecture-overview)
- [Data Flow — How a Chat Message Works](#data-flow--how-a-chat-message-works)
- [Project Structure](#project-structure)
- [File-by-File Breakdown](#file-by-file-breakdown)
- [Key Features](#key-features)
- [Available Tools (AI Actions)](#available-tools-ai-actions)
- [Setup & Installation](#setup--installation)
- [Environment Variables](#environment-variables)
- [Forge Global Page — How It Works](#forge-global-page--how-it-works)
- [The Bridge Pattern — Frontend ↔ Backend](#the-bridge-pattern--frontend--backend)
- [Improvements & Best Practices](#improvements--best-practices)

---

## What This Project Does

When a user opens the **AI Assistant** page in Confluence or Jira, they see a chat interface. They can type things like:

- *"Show me all open bugs"*
- *"Create a task: Set up CI pipeline"*
- *"Assign KAN-12 to Mohit"*
- *"What does the onboarding Confluence page say?"*

The AI understands the request, calls the right Atlassian API, and replies in plain English. It is a smart layer between the user and the Atlassian REST API, powered by an LLM that decides which tool to call and how to format the response.

---

## Tech Stack

| Layer | Technology | Why |
|---|---|---|
| **App Platform** | Atlassian Forge (Custom UI) | Runs natively inside Confluence/Jira with built-in auth, storage, and egress controls |
| **Frontend** | React 16 + inline CSS | Renders the chat UI inside the Forge iframe |
| **Backend** | Forge Resolver (Node.js 24, arm64) | Serverless functions that handle LLM calls and Atlassian API calls |
| **LLM** | Groq API — Llama 3.3 70B Versatile | Fast, free-tier-friendly inference with native tool/function calling |
| **Credential Storage** | Forge KVS (Key-Value Storage) | Encrypted app-scoped storage for Atlassian API tokens |
| **Bridge** | `@forge/bridge` — `invoke()` | Secure RPC channel between the React frontend and backend resolvers |
| **Styling** | Custom CSS + `@atlaskit/css-reset` | Atlassian design language colours and typography |

---

## Architecture Overview

```
┌──────────────────────────────────────────────────────────┐
│                   Atlassian Cloud                        │
│                                                          │
│  ┌─────────────────────────────────────────────────┐    │
│  │            Forge App (ai-assistant/)            │    │
│  │                                                 │    │
│  │  ┌──────────────────────┐                       │    │
│  │  │   FRONTEND (React)   │  static/hello-world/  │    │
│  │  │                      │                       │    │
│  │  │  App.js              │                       │    │
│  │  │  ├── SettingsForm    │                       │    │
│  │  │  └── Chat UI         │                       │    │
│  │  │      ├── ChatWindow  │                       │    │
│  │  │      ├── MessageBubble                       │    │
│  │  │      ├── InputBar    │                       │    │
│  │  │      └── TypingIndicator                     │    │
│  │  │                      │                       │    │
│  │  │  forgeBridge.js      │ ← @forge/bridge       │    │
│  │  └──────────┬───────────┘                       │    │
│  │             │ invoke("chat" / "saveSettings"...) │    │
│  │             ▼                                   │    │
│  │  ┌──────────────────────┐                       │    │
│  │  │   BACKEND (Resolver) │  src/index.js         │    │
│  │  │                      │                       │    │
│  │  │  saveSettings ───────┼──► Forge KVS          │    │
│  │  │  getSettings  ───────┼──► Forge KVS          │    │
│  │  │  clearSettings ──────┼──► Forge KVS          │    │
│  │  │  chat ───────────────┼──► Groq API           │    │
│  │  │    └── tool call ────┼──► Atlassian REST API │    │
│  │  └──────────────────────┘                       │    │
│  └─────────────────────────────────────────────────┘    │
└──────────────────────────────────────────────────────────┘
```

**Key insight:** There is no separate server. Both frontend and backend run _inside_ Atlassian's Forge infrastructure. The "backend" is a set of serverless functions (resolvers). The "frontend" is a React app served from Forge's CDN inside a sandboxed iframe.

---

## Data Flow — How a Chat Message Works

Here is exactly what happens when a user types *"Show me open bugs"* and hits Enter:

```
1. User types message in InputBar
        │
        ▼
2. App.js calls invokeBackend("chat", { message, history })
   via forgeBridge.js → @forge/bridge invoke()
        │
        ▼
3. Forge securely routes the call to the "chat" resolver
   in src/index.js
        │
        ▼
4. needsTools(message) scans for keywords → returns true
   selectRelevantTools(message) → picks Jira tools
        │
        ▼
5. getCredentials() reads baseUrl, email, token from Forge KVS
        │
        ▼
6. callGroq(messages, apiKey, tools) sends the conversation
   + tool definitions to Groq API
   Model: llama-3.3-70b-versatile
        │
        ▼
7. Groq responds with finish_reason: "tool_calls"
   + tool_call: { name: "search_jira_issues", args: { jql: "..." } }
        │
        ▼
8. executeTool("search_jira_issues", args, creds)
   calls Atlassian REST API:
   GET /rest/api/3/search/jql?jql=...
        │
        ▼
9. formatToolResult() converts raw JSON → human-readable text
        │
        ▼
10. { error: false, text: "Found 5 issue(s):\n1. KAN-1 — ..." }
    returned back through the bridge to the frontend
        │
        ▼
11. React renders the response as an assistant message bubble
```

---

## Project Structure

```
forge_mcp/
├── README.md
└── ai-assistant/                    ← Single Forge app (frontend + backend together)
    │
    ├── manifest.yml                 ← App definition: modules, permissions, runtime
    ├── package.json                 ← Backend dependencies
    ├── .gitignore
    │
    ├── src/
    │   └── index.js                 ← Backend: ALL resolver logic (LLM + Atlassian tools)
    │
    └── static/
        └── hello-world/             ← Frontend: React app (built and served by Forge)
            ├── package.json
            ├── postcss.config.js
            ├── tailwind.config.js
            ├── public/
            │   └── index.html       ← HTML shell for React
            └── src/
                ├── index.js         ← React entry point
                ├── App.js           ← Root component (settings + chat orchestration)
                ├── App.css          ← All styles (chat UI + settings + modals)
                ├── forgeBridge.js   ← Abstraction over @forge/bridge (+ local mock)
                ├── index.css        ← Global CSS reset
                └── components/
                    ├── ChatWindow.jsx      ← Scrollable message list + empty state
                    ├── MessageBubble.jsx   ← Individual message rendering
                    ├── InputBar.jsx        ← Textarea + send button
                    └── TypingIndicator.jsx ← Animated "..." dots while AI responds
```

---

## File-by-File Breakdown

### `manifest.yml` — The App's Identity Card

This is the most important configuration file. Atlassian reads it to understand what your app is and what it needs.

```yaml
modules:
  confluence:globalPage:        # Registers the app as a page in Confluence sidebar
  jira:globalPage:              # Registers the app as a page in Jira sidebar
  function:
    - key: resolver             # Points to the backend entry handler

resources:
  - key: main
    path: static/hello-world/build   # Where the built React app lives

app:
  runtime:
    name: nodejs24.x           # Node.js version for backend
    memoryMB: 256
    architecture: arm64

permissions:
  scopes:                       # Atlassian API permissions (least-privilege)
  external:
    fetch:
      backend:
        - https://api.groq.com         # LLM calls
        - https://*.atlassian.net      # Atlassian REST API calls
```

**Why it matters:** Without the `external.fetch.backend` entries, Forge would block outbound HTTP requests entirely. Forge enforces an allowlist — you cannot call any URL not listed here.

---

### `src/index.js` — The Entire Backend (~1100 lines)

This is the brain of the application. It does four things:

**1. Credential management (lines 1–57)**
Stores and retrieves `baseUrl`, `email`, and `apiToken` in Forge KVS. These are the user's Atlassian credentials used to authenticate all REST API calls.

**2. Atlassian API functions (lines 100–576)**
Pure async functions, one per operation. Each takes credentials, calls the Atlassian REST API, and returns a result in MCP tool format `{ content: [{ type: "text", text: "..." }] }`.

| Function | API Called |
|---|---|
| `jiraSearch(jql, ...)` | `GET /rest/api/3/search/jql` |
| `jiraCreate(args, ...)` | `POST /rest/api/3/issue` |
| `jiraReadIssue(key, ...)` | `GET /rest/api/3/issue/:key` |
| `jiraUpdateStatus(key, status, ...)` | `GET + POST /rest/api/3/issue/:key/transitions` |
| `jiraAssignIssue(key, user, ...)` | `PUT /rest/api/3/issue/:key/assignee` |
| `jiraListUsers(...)` | `GET /rest/api/3/users/search` |
| `jiraListProjects(...)` | `GET /rest/api/3/project` |
| `jiraAddComment(key, text, ...)` | `POST /rest/api/3/issue/:key/comment` |
| `confluenceSearch(query, ...)` | `GET /wiki/rest/api/search` |
| `confluenceReadPage(title, ...)` | `GET /wiki/rest/api/content` |
| `confluenceListSpaces(...)` | `GET /wiki/rest/api/space` |

**3. Tool routing and LLM orchestration (lines 634–985)**
- `ALL_TOOLS` — Array of tool definitions in OpenAI/Groq function-calling schema format
- `selectRelevantTools(message)` — Keyword-based routing to avoid sending all 11 tool definitions on every request (reduces token cost and latency)
- `toGroqFormat(tools)` — Converts MCP-style tool definitions to Groq's `{ type: "function", function: {...} }` format
- `callGroq(messages, apiKey, tools)` — Makes the HTTP request to `https://api.groq.com/openai/v1/chat/completions`
- `executeTool(name, args, creds)` — Switch statement that dispatches to the correct Atlassian function
- `formatToolResult(toolName, text)` — Parses JSON tool results into readable plain text for the user

**4. The `chat` resolver (lines 1016–1098)**
The main entry point. Orchestrates the full loop:
1. Check API key and credentials exist
2. Detect if tools are needed (`needsTools`)
3. Build message history for Groq
4. Call Groq with or without tools
5. If `finish_reason === "tool_calls"` → execute the tool → return formatted result
6. If Groq returned raw text with `<function>` tags (fallback) → parse and execute
7. Otherwise return the text response directly

---

### `static/hello-world/src/App.js` — Frontend Orchestrator

The root React component. It owns all application state and manages two views:

**View 1: Settings Form** — shown when `configured === false`
- Collects `baseUrl`, `email`, `token`
- Validates the URL format before saving
- On save, calls `invoke("saveSettings", {...})`

**View 2: Chat UI** — shown when `configured === true`
- Maintains `messages[]` array (conversation history)
- On send, calls `invoke("chat", { message, history })`
- Renders `ChatWindow` + `InputBar`
- Settings button opens a modal to update/clear credentials

**Why the dual-view design?** Forge apps cannot use environment variables on the frontend — there is no `.env` file for the browser. Credentials must be entered by the user at runtime and stored securely in KVS.

---

### `static/hello-world/src/forgeBridge.js` — The Smart Bridge

```js
export async function invokeBackend(functionName, payload) {
  const isForge = window.self !== window.top;  // true inside Forge iframe

  if (isForge) {
    const { invoke } = await import('@forge/bridge');
    return await invoke(functionName, payload);
  } else {
    // Return a mock response when running locally with npm start
    return { error: false, text: `[localhost mock] ...` };
  }
}
```

**Why this exists:** `@forge/bridge` only works inside a Forge-served iframe. If you run `npm start` locally, `window.self === window.top` is true (not in an iframe), so `@forge/bridge` would crash. This file detects the environment and returns a mock when running locally, so you can develop the UI without needing a full Forge deployment.

---

### `components/` — UI Components

| Component | Purpose |
|---|---|
| `ChatWindow.jsx` | Wraps the message list. Handles auto-scroll to bottom and shows the empty state with suggestion chips |
| `MessageBubble.jsx` | Renders a single message. Blue right-aligned bubble for user, white left-aligned for AI. Strips basic markdown (`**bold**`, `* bullet`) |
| `InputBar.jsx` | Textarea with Enter-to-send and Shift+Enter-for-newline. Disables during loading |
| `TypingIndicator.jsx` | Three animated bouncing dots shown while the AI is processing |

---

### `AGENTS.md` — Coding Instructions for AI Agents

This file contains instructions for AI coding assistants (like Claude) working on this codebase. It defines Forge-specific rules: which templates to use, which UI kit components are valid, how to store data, how to deploy. It is not part of the runtime app.

---

## Key Features

### 1. Conversational Jira Management
Ask in plain English. The AI uses JQL under the hood.
- *"Show me all open issues"* → `search_jira_issues { jql: "resolution=Unresolved ORDER BY created DESC" }`
- *"Create a bug: login page crashes on Safari"* → `create_jira_issue { summary: "...", issue_type: "Bug" }`
- *"Move KAN-5 to In Progress"* → fetches available transitions, finds the matching one, POSTs the transition ID

### 2. Smart User Assignment with Fallback Search
`jiraAssignIssue` tries three strategies to find a user before giving up:
1. Exact match by display name via `/user/search?query=`
2. First-name match
3. Full workspace scan via `/users/search` with fuzzy matching

If the user is still not found, it returns a list of available users rather than silently failing.

### 3. Intelligent Tool Selection
The app does not send all 11 tools to Groq on every message. `selectRelevantTools()` reads the message and narrows the tool list:
- *"What is in the architecture doc?"* → only Confluence tools sent
- *"Who is in this workspace?"* → only `list_jira_users` sent
- General questions → no tools sent (direct LLM response, faster)

This reduces token usage and response time.

### 4. Dual Render Mode (Tool Calls + Text Fallback)
Groq normally returns structured tool calls (`finish_reason: "tool_calls"`). But some LLM responses include tool calls embedded as XML-like text (`<function=search_jira_issues>{...}</function>`). The `parseToolCallFromText()` function handles three different tag formats as a fallback, making the system resilient to different model output styles.

### 5. Local Development Mock
When running `npm start`, `forgeBridge.js` detects it is not inside a Forge iframe and returns a mock response. You can develop and test the UI layout without deploying to Atlassian.

### 6. Secure Credential Storage
Credentials are stored in Forge KVS — encrypted, app-scoped server-side storage. They are never exposed to the frontend after being saved. `getSettings` returns `configured: true/false` and the `baseUrl` + `email` for display, but never the API token.

---

## Available Tools (AI Actions)

| Tool Name | What it Does |
|---|---|
| `search_jira_issues` | Search/list issues using JQL. Project is auto-detected if not specified |
| `create_jira_issue` | Create a new issue (Task, Bug, Story, etc.) |
| `read_jira_issue` | Get full details of an issue by key (e.g. `KAN-12`) |
| `update_jira_issue` | Change an issue's status (via workflow transitions) |
| `assign_jira_issue` | Assign an issue to a user by name |
| `list_jira_users` | List all Atlassian users in the workspace |
| `list_jira_projects` | List all Jira projects |
| `add_jira_comment` | Add a comment to an issue |
| `search_confluence_pages` | Full-text search across Confluence |
| `read_confluence_page` | Read the content of a page by title |
| `list_confluence_spaces` | List all Confluence spaces |

---

## Setup & Installation

### Prerequisites

- [Node.js](https://nodejs.org/) 18 or higher
- [Atlassian Forge CLI](https://developer.atlassian.com/platform/forge/getting-started/) installed globally
- An Atlassian account with at least one Confluence or Jira site
- A [Groq API key](https://console.groq.com) (free tier available)

### Step 1 — Install the Forge CLI and log in

```bash
npm install -g @forge/cli
forge login
```

### Step 2 — Clone the repo and install backend dependencies

```bash
git clone <repo-url>
cd forge_mcp/ai-assistant
npm install
```

### Step 3 — Install and build the frontend

```bash
cd static/hello-world
npm install
npm run build
cd ../..
```

### Step 4 — Set the Groq API key as a Forge environment variable

```bash
forge variables set --environment development GROQ_API_KEY your_groq_api_key_here
```

This stores the key securely in Forge. It becomes available as `process.env.GROQ_API_KEY` in your resolver at runtime.

### Step 5 — Deploy the app

```bash
forge deploy --non-interactive --environment development
```

### Step 6 — Install the app on your Atlassian site

```bash
# For Confluence
forge install --non-interactive --site your-site.atlassian.net --product confluence --environment development

# For Jira
forge install --non-interactive --site your-site.atlassian.net --product jira --environment development
```

### Step 7 — Open the app

- In **Confluence**: Go to any space → look for "AI Assistant" in the sidebar under Apps
- In **Jira**: Go to Apps → AI Assistant in the left navigation

Enter your Atlassian credentials on first launch.

### Local Frontend Development (UI only)

```bash
cd static/hello-world
npm start
```

Open `http://localhost:3000`. The bridge will return mock responses — no Forge deployment needed for UI work.

### View Live Logs (Debugging)

```bash
forge logs --environment development --since 15m
```

---

## Environment Variables

| Variable | Where Set | Purpose |
|---|---|---|
| `GROQ_API_KEY` | `forge variables set` | Authenticates requests to the Groq LLM API |

Atlassian credentials (base URL, email, API token) are **not** environment variables — they are entered by the user at runtime and stored in Forge KVS.

### `.env.example` (for reference only — not used by Forge)

```bash
# This project uses Forge environment variables, not .env files.
# Set secrets with: forge variables set --environment development KEY value
#
# Required:
# GROQ_API_KEY=gsk_...
```

---

## Forge Global Page — How It Works

A **Global Page** is an Atlassian Forge module type that adds a full-page app to the Confluence or Jira navigation. Here is how it is configured:

```yaml
modules:
  confluence:globalPage:
    - key: ai-assistant-hello-world
      resource: main           # Points to the static/hello-world/build folder
      resolver:
        function: resolver     # Links to the backend function handler
      title: ai-assistant      # Label shown in the navigation
      route: hello-world       # URL path segment

  jira:globalPage:
    - key: ai-assistant-jira-global
      resource: main
      resolver:
        function: resolver
      title: ai-assistant
      route: hello-world
```

**How the pieces connect:**
- `resource: main` → Forge serves the built React app from `static/hello-world/build/`
- `resolver: { function: resolver }` → links this page to the backend handler exported from `src/index.js`
- When a user visits the page, Forge renders the React app inside a sandboxed iframe
- The React app uses `@forge/bridge invoke()` to call resolver functions through a secure Forge-managed RPC channel

---

## The Bridge Pattern — Frontend ↔ Backend

This is the most important architectural concept to understand.

```
React (iframe) ──invoke("chat", payload)──► Forge Bridge ──► Resolver (src/index.js)
                ◄──── { error, text } ──────────────────────────────────────────────
```

- **No HTTP server** — there is no Express server, no REST endpoint, no port to call
- **`@forge/bridge`** is an Atlassian SDK that acts as a secure message bus between the iframe and Forge's serverless runtime
- **`invoke("chat", payload)`** is essentially an RPC call: "run the function named `chat` with this payload and return the result"
- Forge handles authentication, serialization, and the network transport invisibly

This is why the app is simpler than a traditional fullstack app — you write a function, give it a name, and call it by name from the frontend. No API design needed.

---

## Improvements & Best Practices

### Security

**1. Use `.asUser()` for Atlassian API calls**

Currently the backend builds its own `Authorization: Basic` header using user-provided credentials. The Atlassian Forge SDK provides a safer alternative:

```js
// Current approach (manual Basic auth)
const res = await api.fetch(`${baseUrl}/rest/api/3/issue`, {
  headers: buildHeaders(email, token)
});

// Better approach (Forge-managed auth, respects user permissions)
import api, { route } from "@forge/api";
const res = await api.asUser().requestJira(route`/rest/api/3/issue/${issueKey}`);
```

Using `.asUser()` means the request is made in the context of the logged-in Atlassian user, so Jira's own permission model is enforced automatically. The current approach could allow any action the API token permits, bypassing project-level restrictions.

**2. Never log credentials**

The `buildHeaders` function constructs a `Basic` auth header from the token. Ensure `console.log` statements never print the token or headers object. Currently logs like `"Jira raw:"` truncate output, which is good — but add an explicit audit pass.

**3. Validate `baseUrl` server-side**

The `saveSettings` resolver trusts the `baseUrl` from the frontend. Add server-side validation:
```js
if (!baseUrl.startsWith("https://") || !baseUrl.includes(".atlassian.net")) {
  return { success: false, error: "Invalid Atlassian URL" };
}
```

---

### Code Structure

**4. Split `src/index.js` into modules**

At ~1100 lines, the backend file is doing too much. Suggested split:

```
src/
├── index.js              ← resolvers only (chat, saveSettings, etc.)
├── groq.js               ← callGroq, parseToolCallFromText, buildMessages
├── tools/
│   ├── definitions.js    ← ALL_TOOLS array
│   ├── jira.js           ← all jira* functions
│   └── confluence.js     ← all confluence* functions
└── utils.js              ← buildHeaders, formatToolResult, needsTools, selectRelevantTools
```

**5. Consistent component style**

`App.js` uses CSS classes from `App.css`. The `components/` folder uses inline styles. Pick one approach and be consistent. Inline styles make it hard to apply theming or dark mode later.

---

### Performance

**6. Cache credentials within a request**

`getCredentials()` makes 3 separate KVS reads on every chat request. Cache them:
```js
let _creds = null;
async function getCredentials() {
  if (_creds) return _creds;
  // ... kvs.get calls
  _creds = { baseUrl, email, token };
  return _creds;
}
```

**7. Use multi-turn tool calling**

Currently, the `chat` resolver only executes **one** tool call per message. If Groq decides to call multiple tools (e.g. search issues AND list users), only the first is executed. Consider a loop:

```js
while (finishReason === "tool_calls") {
  // execute tool, append result to messages, call Groq again
}
```

**8. Stream responses**

For long AI responses, consider Groq's streaming API to show text as it arrives instead of waiting for the full response. This would require changes to the Forge resolver (streaming is supported via `Response` objects) and the frontend.

---

### Scalability

**9. Add conversation memory limit**

The `history` array is passed from the frontend on every message and grows unbounded. Long conversations will eventually exceed Groq's context window (32K tokens for Llama 3.3 70B). Add a trim:

```js
const MAX_HISTORY = 20;
const trimmedHistory = (history || []).slice(-MAX_HISTORY);
const messages = buildMessages(trimmedHistory, message);
```

**10. Rate limiting awareness**

The `chat` resolver catches `RATE_LIMITED` (HTTP 429) and returns a user-friendly message. But it does not implement backoff or retry. For a production app, add exponential backoff with a max of 3 retries.

---

### Missing Things

**11. No loading state for settings save**

The `SettingsForm` has a `saving` state that disables the button, but there is no visual feedback (spinner) while saving. Add a spinner to the save button.

**12. No error boundary**

If the React app crashes (unhandled exception), the user sees a blank white page with no message. Add a React error boundary around `App`:

```jsx
class ErrorBoundary extends React.Component {
  state = { error: null };
  static getDerivedStateFromError(error) { return { error }; }
  render() {
    if (this.state.error) return <div>Something went wrong. Please reload.</div>;
    return this.props.children;
  }
}
```

**13. No Confluence write tools**

The current tool set covers Confluence reads (search, read page, list spaces) but has no `create_confluence_page` or `update_confluence_page` tool. The manifest already has `write:confluence-content` scope declared — the implementation is just missing.

**14. No tests**

There are no unit tests for the resolver functions. The pure functions (`formatToolResult`, `selectRelevantTools`, `needsTools`, `buildHeaders`) are straightforward to test with Jest:

```bash
cd ai-assistant
npm install --save-dev jest
```

**15. Suggestion chips are not clickable**

`ChatWindow.jsx` renders suggestion chips ("Create a Jira bug ticket", "Find open issues", etc.) but they have no `onClick` handler — they are purely decorative. Wire them up:

```jsx
// Pass onSend from App.js down to ChatWindow
<div onClick={() => onSend(text)} style={{ cursor: 'pointer' }}>
  {text}
</div>
```
