import React, { useState, useRef, useEffect } from "react";
import { invoke } from "@forge/bridge";
import "./App.css";

const SUGGESTIONS = [
  { label: "📋 All Jira Issues", text: "List all my jira issues" },
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

function Message({ msg, index }) {
  const isUser = msg.role === "user";
  return (
    <div
      className={`msg-row ${isUser ? "msg-user" : "msg-ai"}`}
      style={{ animationDelay: `${index * 0.05}s` }}
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

export default function App() {
  const [configured, setConfigured] = useState(null);
  const [existingCreds, setExistingCreds] = useState({});
  const [showSettings, setShowSettings] = useState(false);
  const [messages, setMessages] = useState([
    {
      role: "assistant",
      content:
        "Hi! I'm your AI Assistant for Jira & Confluence. Ask me anything or tap a suggestion below ↓",
    },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(true);
  const bottomRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    invoke("getSettings")
      .then((result) => {
        setConfigured(result.configured);
        setExistingCreds({ baseUrl: result.baseUrl, email: result.email });
      })
      .catch(() => setConfigured(false));
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  const handleSaved = () => {
    setConfigured(true);
    setShowSettings(false);
    setMessages([
      {
        role: "assistant",
        content: "Connected! Ask me anything or tap a suggestion below ↓",
      },
    ]);
    setShowSuggestions(true);
    invoke("getSettings").then((result) => {
      setExistingCreds({ baseUrl: result.baseUrl, email: result.email });
    });
  };

  const sendMessage = async (text) => {
    const msgText = (text || input).trim();
    if (!msgText || loading) return;
    setInput("");
    setShowSuggestions(false);
    const userMsg = { role: "user", content: msgText };
    const updated = [...messages, userMsg];
    setMessages(updated);
    setLoading(true);
    try {
      const result = await invoke("chat", {
        message: msgText,
        history: messages.filter((m) => m.role !== "system"),
      });
      const responseText = result?.text || result?.reply || "No response.";
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: responseText },
      ]);
    } catch (e) {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: "Error: " + e.message },
      ]);
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

  const handleClear = async () => {
    await invoke("clearSettings");
    setConfigured(false);
    setShowSettings(false);
    setMessages([
      {
        role: "assistant",
        content:
          "Hi! I'm your AI Assistant for Jira & Confluence. Ask me anything or tap a suggestion below ↓",
      },
    ]);
    setShowSuggestions(true);
  };

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

  if (!configured) {
    return <SettingsForm onSave={handleSaved} existing={existingCreds} />;
  }

  return (
    <div className="app">
      {/* Header */}
      <div className="app-header">
        <div className="header-left">
          <div className="header-logo">✦</div>
          <div>
            <div className="header-title">AI Assistant</div>
            <div className="header-sub">
              Jira + Confluence · Powered by Groq
            </div>
          </div>
        </div>
        <button
          className="header-settings"
          onClick={() => setShowSettings(true)}
          title="Settings"
        >
          ⚙
        </button>
      </div>

      {/* Settings Modal */}
      {showSettings && (
        <div className="modal-backdrop" onClick={() => setShowSettings(false)}>
          <div className="modal-box" onClick={(e) => e.stopPropagation()}>
            <div className="modal-top">
              <span className="modal-title">Update Credentials</span>
              <button
                className="modal-close"
                onClick={() => setShowSettings(false)}
              >
                ✕
              </button>
            </div>
            <SettingsForm onSave={handleSaved} existing={existingCreds} />
            <button className="danger-btn" onClick={handleClear}>
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

      {/* Input Bar */}
      <div className="input-area">
        {!showSuggestions && (
          <button
            className="toggle-suggestions"
            onClick={() => setShowSuggestions(true)}
            title="Show suggestions"
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
  );
}
