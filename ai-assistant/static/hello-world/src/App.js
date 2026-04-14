import React, { useState, useRef, useEffect, useCallback } from "react";
import { invoke } from "@forge/bridge";
import "./App.css";

const SUGGESTIONS = [
  { label: "📋 All Jira Issues", text: "List all jira issues" },
  { label: "🔓 Open Issues", text: "Show all open jira issues" },
  { label: "✅ Done Issues", text: "Show all completed jira issues" },
  { label: "👤 My Issues", text: "List issues assigned to me" },
  { label: "📄 Confluence Pages", text: "List all confluence pages" },
  { label: "🗂️ Confluence Spaces", text: "List all confluence spaces" },
  { label: "👥 Team Members", text: "Show all users in my workspace" },
  { label: "📁 Jira Projects", text: "List all jira projects" },
  { label: "🚀 Create Task", text: "Create a new task titled " },
  { label: "📝 Create Page", text: "Create a confluence page titled " },
];

// ── Generate unique chat ID ──
function generateId() {
  return `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

// ── Generate chat title from first message ──
function generateTitle(message) {
  return message.length > 40 ? message.substring(0, 40) + "..." : message;
}

// ── Group chats by date ──
function groupChatsByDate(chats) {
  const now = new Date();
  const today = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
  ).getTime();
  const yesterday = today - 86400000;
  const week = today - 7 * 86400000;
  const month = today - 30 * 86400000;

  const groups = {
    Today: [],
    Yesterday: [],
    "Previous 7 Days": [],
    "Previous 30 Days": [],
    Older: [],
  };

  chats.forEach((chat) => {
    const t = chat.createdAt;
    if (t >= today) groups["Today"].push(chat);
    else if (t >= yesterday) groups["Yesterday"].push(chat);
    else if (t >= week) groups["Previous 7 Days"].push(chat);
    else if (t >= month) groups["Previous 30 Days"].push(chat);
    else groups["Older"].push(chat);
  });

  return groups;
}

// ── Settings Form ──
function SettingsForm({ onSave, existing }) {
  const [baseUrl, setBaseUrl] = useState(existing?.baseUrl || "https://");
  const [email, setEmail] = useState(existing?.email || "");
  const [token, setToken] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const handleSave = async () => {
    if (
      !baseUrl.startsWith("https://") ||
      !baseUrl.includes(".atlassian.net") ||
      !email ||
      !token
    ) {
      setError(
        "All fields required. URL must be https://your-site.atlassian.net",
      );
      return;
    }
    setSaving(true);
    setError("");
    try {
      const result = await invoke("saveSettings", {
        baseUrl: baseUrl.trim(),
        email: email.trim(),
        token: token.trim(),
      });
      if (result.success) onSave();
      else setError(result.error || "Failed to save.");
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="setup-screen">
      <div className="setup-card">
        <div className="setup-header">
          <div className="setup-logo">
            <span className="logo-icon">✦</span>
            <span>AI Assistant</span>
          </div>
          <p className="setup-subtitle">
            Connect your Atlassian workspace to get started
          </p>
        </div>
        <div className="setup-body">
          <div className="field-group">
            <label>Atlassian Site URL</label>
            <input
              type="url"
              value={baseUrl}
              onChange={(e) => setBaseUrl(e.target.value)}
              placeholder="https://your-company.atlassian.net"
            />
          </div>
          <div className="field-group">
            <label>Email Address</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@company.com"
            />
          </div>
          <div className="field-group">
            <label>API Token</label>
            <input
              type="password"
              value={token}
              onChange={(e) => setToken(e.target.value)}
              placeholder="Your Atlassian API token"
            />
            <span className="field-hint">
              Get token from{" "}
              <strong>id.atlassian.com → Security → API Tokens</strong>
            </span>
          </div>
          {error && <div className="setup-error">{error}</div>}
          <button className="setup-btn" onClick={handleSave} disabled={saving}>
            {saving ? (
              <>
                <span className="btn-spinner" /> Connecting...
              </>
            ) : (
              <>
                <span>→</span> Connect Workspace
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Message Component ──
function Message({ msg, index }) {
  const isUser = msg.role === "user";
  return (
    <div
      className={`msg-row ${isUser ? "msg-user" : "msg-ai"}`}
      style={{ animationDelay: `${index * 0.04}s` }}
    >
      {!isUser && (
        <div className="msg-avatar ai-avatar">
          <span>✦</span>
        </div>
      )}
      <div className={`msg-bubble ${isUser ? "bubble-user" : "bubble-ai"}`}>
        <p className="msg-text">{msg.content}</p>
      </div>
      {isUser && (
        <div className="msg-avatar user-avatar">
          <span>U</span>
        </div>
      )}
    </div>
  );
}

// ── Typing Indicator ──
function TypingIndicator() {
  return (
    <div className="msg-row msg-ai">
      <div className="msg-avatar ai-avatar">
        <span>✦</span>
      </div>
      <div className="msg-bubble bubble-ai typing-bubble">
        <span className="dot" />
        <span className="dot" />
        <span className="dot" />
      </div>
    </div>
  );
}

// ── Sidebar Chat Item ──
function ChatItem({ chat, isActive, onSelect, onDelete }) {
  const [showDelete, setShowDelete] = useState(false);

  return (
    <div
      className={`chat-item ${isActive ? "chat-item-active" : ""}`}
      onClick={() => onSelect(chat.id)}
      onMouseEnter={() => setShowDelete(true)}
      onMouseLeave={() => setShowDelete(false)}
    >
      <div className="chat-item-icon">💬</div>
      <div className="chat-item-title">{chat.title}</div>
      {showDelete && (
        <button
          className="chat-delete-btn"
          onClick={(e) => {
            e.stopPropagation();
            onDelete(chat.id);
          }}
          title="Delete chat"
        >
          🗑
        </button>
      )}
    </div>
  );
}

// ── Main App ──
export default function App() {
  const [configured, setConfigured] = useState(null);
  const [existingCreds, setExistingCreds] = useState({});
  const [showSettings, setShowSettings] = useState(false);

  // Chat history state
  const [chatList, setChatList] = useState([]);
  const [currentChatId, setCurrentChatId] = useState(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [loadingChats, setLoadingChats] = useState(false);

  // Message state
  const [messages, setMessages] = useState([
    {
      role: "assistant",
      content:
        "Hi! I'm your AI Assistant. Ask me anything or tap a suggestion below ↓",
    },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(true);

  const bottomRef = useRef(null);
  const inputRef = useRef(null);
  const currentChatIdRef = useRef(null);

  // Keep ref in sync
  useEffect(() => {
    currentChatIdRef.current = currentChatId;
  }, [currentChatId]);

  // ── Load settings on startup ──
  useEffect(() => {
    invoke("getSettings")
      .then((result) => {
        setConfigured(result.configured);
        setExistingCreds({ baseUrl: result.baseUrl, email: result.email });
      })
      .catch(() => setConfigured(false));
  }, []);

  // ── Load chat list when configured ──
  useEffect(() => {
    if (configured) {
      loadChatList();
    }
  }, [configured]);

  // ── Auto scroll ──
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  // ── Load chat list from KVS ──
  const loadChatList = async () => {
    setLoadingChats(true);
    try {
      const result = await invoke("listChats");
      if (result.success) setChatList(result.chats || []);
    } catch (e) {
      console.error("loadChatList error:", e);
    } finally {
      setLoadingChats(false);
    }
  };

  // ── Start new chat ──
  const startNewChat = () => {
    setCurrentChatId(null);
    setMessages([
      {
        role: "assistant",
        content:
          "Hi! I'm your AI Assistant. Ask me anything or tap a suggestion below ↓",
      },
    ]);
    setInput("");
    setShowSuggestions(true);
  };

  // ── Load existing chat ──
  const loadChat = async (chatId) => {
    try {
      const result = await invoke("loadChat", { chatId });
      if (result.success && result.chat) {
        setCurrentChatId(chatId);
        setMessages(result.chat.messages);
        setShowSuggestions(false);
      }
    } catch (e) {
      console.error("loadChat error:", e);
    }
  };

  // ── Save chat to KVS ──
  const saveChat = useCallback(async (chatId, msgs) => {
    try {
      const userMessages = msgs.filter((m) => m.role === "user");
      const title =
        userMessages.length > 0
          ? generateTitle(userMessages[0].content)
          : "New Chat";

      await invoke("saveChat", { chatId, title, messages: msgs });

      // Refresh chat list
      const result = await invoke("listChats");
      if (result.success) setChatList(result.chats || []);
    } catch (e) {
      console.error("saveChat error:", e);
    }
  }, []);

  // ── Delete chat ──
  const deleteChat = async (chatId) => {
    try {
      await invoke("deleteChat", { chatId });
      setChatList((prev) => prev.filter((c) => c.id !== chatId));

      // If deleted current chat → start new
      if (currentChatIdRef.current === chatId) {
        startNewChat();
      }
    } catch (e) {
      console.error("deleteChat error:", e);
    }
  };

  // ── After saving settings ──
  const handleSaved = () => {
    setConfigured(true);
    setShowSettings(false);
    startNewChat();
    invoke("getSettings").then((result) => {
      setExistingCreds({ baseUrl: result.baseUrl, email: result.email });
    });
    loadChatList();
  };

  // ── Clear all chats ──
  const handleClearAll = async () => {
    if (!window.confirm || window.confirm("Delete all chat history?")) {
      await invoke("clearAllChats");
      setChatList([]);
      startNewChat();
    }
  };

  // ── Clear credentials ──
  const handleClearCreds = async () => {
    await invoke("clearSettings");
    setConfigured(false);
    setShowSettings(false);
    startNewChat();
  };

  // ── Send message ──
  const sendMessage = async (text) => {
    const msgText = (text || input).trim();
    if (!msgText || loading) return;

    setInput("");
    setShowSuggestions(false);

    // Generate chat ID if new conversation
    let chatId = currentChatIdRef.current;
    if (!chatId) {
      chatId = generateId();
      setCurrentChatId(chatId);
    }

    const userMsg = { role: "user", content: msgText };
    const updatedMessages = [...messages, userMsg];
    setMessages(updatedMessages);
    setLoading(true);

    try {
      const result = await invoke("chat", {
        message: msgText,
        history: messages.filter((m) => m.role !== "system"),
      });

      const responseText = result?.text || "No response.";
      const aiMsg = { role: "assistant", content: responseText };
      const finalMessages = [...updatedMessages, aiMsg];

      setMessages(finalMessages);

      // Auto-save after each exchange
      await saveChat(chatId, finalMessages);
    } catch (e) {
      const errorMsg = { role: "assistant", content: "Error: " + e.message };
      const finalMessages = [...updatedMessages, errorMsg];
      setMessages(finalMessages);
      await saveChat(chatId, finalMessages);
    } finally {
      setLoading(false);
    }
  };

  const handleSuggestion = (suggestion) => {
    setInput(suggestion.text);
    inputRef.current?.focus();
  };

  const handleKey = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  // ── Group chats by date ──
  const groupedChats = groupChatsByDate(chatList);

  // ── Loading screen ──
  if (configured === null) {
    return (
      <div className="loading-screen">
        <div className="loading-logo">✦</div>
        <div className="loading-bar">
          <div className="loading-fill" />
        </div>
      </div>
    );
  }

  // ── Settings screen ──
  if (!configured) {
    return <SettingsForm onSave={handleSaved} existing={existingCreds} />;
  }

  return (
    <div className="app-shell">
      {/* ── Sidebar ── */}
      <div
        className={`sidebar ${sidebarOpen ? "sidebar-open" : "sidebar-closed"}`}
      >
        {/* Sidebar Header */}
        <div className="sidebar-header">
          <div className="sidebar-logo">
            <span className="sidebar-logo-icon">✦</span>
            {sidebarOpen && (
              <span className="sidebar-logo-text">AI Assistant</span>
            )}
          </div>
          <button
            className="sidebar-toggle"
            onClick={() => setSidebarOpen(!sidebarOpen)}
            title="Toggle sidebar"
          >
            {sidebarOpen ? "◀" : "▶"}
          </button>
        </div>

        {sidebarOpen && (
          <>
            {/* New Chat Button */}
            <button className="new-chat-btn" onClick={startNewChat}>
              <span>✏</span> New Chat
            </button>

            {/* Chat List */}
            <div className="chat-list">
              {loadingChats ? (
                <div className="chat-list-loading">Loading history...</div>
              ) : chatList.length === 0 ? (
                <div className="chat-list-empty">No conversations yet</div>
              ) : (
                Object.entries(groupedChats).map(([group, chats]) =>
                  chats.length > 0 ? (
                    <div key={group} className="chat-group">
                      <div className="chat-group-label">{group}</div>
                      {chats.map((chat) => (
                        <ChatItem
                          key={chat.id}
                          chat={chat}
                          isActive={currentChatId === chat.id}
                          onSelect={loadChat}
                          onDelete={deleteChat}
                        />
                      ))}
                    </div>
                  ) : null,
                )
              )}
            </div>

            {/* Sidebar Footer */}
            <div className="sidebar-footer">
              <button
                className="sidebar-footer-btn"
                onClick={() => setShowSettings(true)}
              >
                ⚙ Settings
              </button>
              <button
                className="sidebar-footer-btn danger"
                onClick={handleClearAll}
              >
                🗑 Clear History
              </button>
            </div>
          </>
        )}
      </div>

      {/* ── Main Area ── */}
      <div className="main-area">
        {/* Header */}
        <div className="app-header">
          <div className="header-left">
            {!sidebarOpen && (
              <button
                className="header-menu-btn"
                onClick={() => setSidebarOpen(true)}
              >
                ☰
              </button>
            )}
            <div className="header-title">
              {currentChatId
                ? chatList.find((c) => c.id === currentChatId)?.title ||
                  "AI Assistant"
                : "AI Assistant"}
            </div>
          </div>
          <div className="header-sub">Jira + Confluence · Powered by Groq</div>
        </div>

        {/* Settings Modal */}
        {showSettings && (
          <div
            className="modal-backdrop"
            onClick={() => setShowSettings(false)}
          >
            <div className="modal-box" onClick={(e) => e.stopPropagation()}>
              <div className="modal-top">
                <span className="modal-title">Settings</span>
                <button
                  className="modal-close"
                  onClick={() => setShowSettings(false)}
                >
                  ✕
                </button>
              </div>
              <SettingsForm onSave={handleSaved} existing={existingCreds} />
              <button className="danger-btn" onClick={handleClearCreds}>
                🗑 Clear & Reset All Credentials
              </button>
            </div>
          </div>
        )}

        {/* Messages */}
        <div className="messages-area">
          <div className="messages-inner">
            {messages.map((msg, i) => (
              <Message key={i} msg={msg} index={i} />
            ))}
            {loading && <TypingIndicator />}
            <div ref={bottomRef} />
          </div>
        </div>

        {/* Suggestions */}
        {showSuggestions && (
          <div className="suggestions-bar">
            <div className="suggestions-label">Quick actions</div>
            <div className="suggestions-scroll">
              {SUGGESTIONS.map((s, i) => (
                <button
                  key={i}
                  className="suggestion-chip"
                  onClick={() => handleSuggestion(s)}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Input */}
        <div className="input-area">
          {!showSuggestions && (
            <button
              className="toggle-suggestions"
              onClick={() => setShowSuggestions(true)}
            >
              💡
            </button>
          )}
          <div className="input-wrapper">
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKey}
              placeholder="Ask anything about Jira or Confluence..."
              rows={1}
              disabled={loading}
            />
            <button
              className={`send-btn ${input.trim() && !loading ? "send-active" : ""}`}
              onClick={() => sendMessage()}
              disabled={loading || !input.trim()}
            >
              {loading ? <span className="send-spinner" /> : "↑"}
            </button>
          </div>
          <div className="input-hint">
            Enter to send · Shift+Enter for new line
          </div>
        </div>
      </div>
    </div>
  );
}
