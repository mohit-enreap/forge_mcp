import React, { useState, useRef, useEffect } from "react";
import { invoke } from "@forge/bridge";
import "./App.css";

// ── Settings Form Component ──
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
      if (result.success) {
        onSave();
      } else {
        setError(result.error || "Failed to save.");
      }
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="settings-overlay">
      <div className="settings-card">
        <div className="settings-header">
          <div className="settings-icon">⚙️</div>
          <div>
            <div className="settings-title">Connect to Atlassian</div>
            <div className="settings-sub">
              Enter your credentials to get started
            </div>
          </div>
        </div>

        <div className="settings-body">
          <div className="field">
            <label>Atlassian Site URL</label>
            <input
              type="url"
              value={baseUrl}
              onChange={(e) => setBaseUrl(e.target.value)}
              placeholder="https://your-company.atlassian.net"
            />
            <span className="hint">
              Example: https://mohit-demo-enreap.atlassian.net
            </span>
          </div>

          <div className="field">
            <label>Atlassian Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@company.com"
            />
            <span className="hint">Email used to log in to Atlassian</span>
          </div>

          <div className="field">
            <label>Atlassian API Token</label>
            <input
              type="password"
              value={token}
              onChange={(e) => setToken(e.target.value)}
              placeholder="Your API token"
            />
            <span className="hint">
              Get your token from id.atlassian.com - Security - API Tokens
            </span>
          </div>

          {error && <div className="settings-error">{error}</div>}

          <button className="save-btn" onClick={handleSave} disabled={saving}>
            {saving ? "Saving..." : "Save and Connect"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main App ──
export default function App() {
  const [configured, setConfigured] = useState(null);
  const [existingCreds, setExistingCreds] = useState({});
  const [showSettings, setShowSettings] = useState(false);
  const [messages, setMessages] = useState([
    {
      role: "assistant",
      content:
        "Hi! I am your AI Assistant. Ask me anything about Jira, Confluence, or general questions!",
    },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef(null);

  // ── Check credentials on load ──
  useEffect(() => {
    invoke("getSettings")
      .then((result) => {
        setConfigured(result.configured);
        setExistingCreds({ baseUrl: result.baseUrl, email: result.email });
      })
      .catch(() => setConfigured(false));
  }, []);

  // ── Auto scroll to bottom ──
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  // ── After saving credentials ──
  const handleSaved = () => {
    setConfigured(true);
    setShowSettings(false);
    setMessages([
      {
        role: "assistant",
        content:
          "Connected! Ask me anything about Jira, Confluence, or general questions!",
      },
    ]);
    invoke("getSettings").then((result) => {
      setExistingCreds({ baseUrl: result.baseUrl, email: result.email });
    });
  };

  // ── Send message ──
  const sendMessage = async () => {
    if (!input.trim() || loading) return;
    const userMsg = { role: "user", content: input.trim() };
    const updated = [...messages, userMsg];
    setMessages(updated);
    setInput("");
    setLoading(true);
    try {
      const result = await invoke("chat", {
        message: input.trim(),
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

  // ── Enter key handler ──
  const handleKey = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  // ── Clear credentials ──
  const handleClearSettings = async () => {
    await invoke("clearSettings");
    setConfigured(false);
    setShowSettings(false);
    setMessages([
      {
        role: "assistant",
        content:
          "Hi! I am your AI Assistant. Ask me anything about Jira, Confluence, or general questions!",
      },
    ]);
  };

  // ── Loading screen ──
  if (configured === null) {
    return (
      <div className="app center">
        <div className="spinner" />
        <p>Loading...</p>
      </div>
    );
  }

  // ── Not configured — show settings form ──
  if (!configured) {
    return <SettingsForm onSave={handleSaved} existing={existingCreds} />;
  }

  // ── Main chat UI ──
  return (
    <div className="app">
      <div className="header">
        <div className="header-logo">AI</div>
        <div style={{ flex: 1 }}>
          <div className="header-title">AI Assistant</div>
          <div className="header-sub">Powered by Groq - Jira + Confluence</div>
        </div>
        <button
          className="settings-btn"
          onClick={() => setShowSettings(true)}
          title="Settings"
        >
          ⚙️
        </button>
      </div>

      {showSettings && (
        <div className="modal-backdrop" onClick={() => setShowSettings(false)}>
          <div className="modal-box" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <span>Update Credentials</span>
              <button
                className="close-btn"
                onClick={() => setShowSettings(false)}
              >
                X
              </button>
            </div>
            <SettingsForm onSave={handleSaved} existing={existingCreds} />
            <button className="clear-btn" onClick={handleClearSettings}>
              Clear and Reset All Credentials
            </button>
          </div>
        </div>
      )}

      <div className="messages">
        {messages.map((msg, i) => (
          <div key={i} className={"row " + msg.role}>
            <div className="avatar">{msg.role === "user" ? "U" : "AI"}</div>
            <div className="bubble">
              <div className="bubble-name">
                {msg.role === "user" ? "You" : "Assistant"}
              </div>
              <div className="bubble-text">{msg.content}</div>
            </div>
          </div>
        ))}

        {loading && (
          <div className="row assistant">
            <div className="avatar">AI</div>
            <div className="bubble">
              <div className="bubble-name">Assistant</div>
              <div className="typing">
                <span />
                <span />
                <span />
              </div>
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      <div className="input-bar">
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKey}
          placeholder="Ask anything... Jira, Confluence, or general (Enter to send)"
          rows={2}
          disabled={loading}
        />
        <button onClick={sendMessage} disabled={loading || !input.trim()}>
          {loading ? "..." : "Send"}
        </button>
      </div>
    </div>
  );
}
