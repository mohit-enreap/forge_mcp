import React, { useState, useRef, useEffect } from "react";
import { invoke } from "@forge/bridge";
import "./App.css";

const SUGGESTIONS = [
  { label: "📋 All Issues",        text: "List all my jira issues" },
  { label: "🔓 Open Issues",       text: "Show all open jira issues" },
  { label: "✅ Done Issues",        text: "Show all completed jira issues" },
  { label: "👤 My Issues",         text: "List issues assigned to me" },
  { label: "📄 Confluence Pages",  text: "List all confluence pages" },
  { label: "🗂️ Spaces",           text: "List all confluence spaces" },
  { label: "👥 Team Members",      text: "Show all users in my workspace" },
  { label: "📁 Jira Projects",     text: "List all jira projects" },
  { label: "🚀 Create Task",       text: "Create a new task titled " },
  { label: "📝 Create Page",       text: "Create a confluence page titled " },
];

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
  const [messages, setMessages] = useState([
    {
      role: "assistant",
      content: "Hi! I'm your AI Assistant for Jira & Confluence. Ask me anything or tap a suggestion below ↓",
    },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(true);
  const bottomRef = useRef(null);
  const inputRef  = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  const sendMessage = async (text) => {
    const msgText = (text || input).trim();
    if (!msgText || loading) return;
    setInput("");
    setShowSuggestions(false);
    setMessages((prev) => [...prev, { role: "user", content: msgText }]);
    setLoading(true);
    try {
      const result = await invoke("chat", {
        message: msgText,
        history: messages.filter((m) => m.role !== "system"),
      });
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: result?.text || result?.reply || "No response." },
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

  return (
    <div className="app">

      {/* Header */}
      <div className="app-header">
        <div className="header-left">
          <div className="header-logo">✦</div>
          <div>
            <div className="header-title">AI Assistant</div>
            <div className="header-sub">Jira + Confluence · Powered by Groq</div>
          </div>
        </div>
        <div className="header-badge">
          <span className="badge-dot" />
          Online
        </div>
      </div>

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
                disabled={loading}
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
          <>
            <button
              className="toggle-suggestions"
              onClick={() => setShowSuggestions(true)}
              title="Show suggestions"
            >
              AI Assistant
            </button>
            <div style={{ color: "#B3D4FF", fontSize: "11px" }}>
              Powered by Gemini 2.5
            </div>
          </>
        )}

        <div
          style={{
            marginLeft: "auto",
            display: "flex",
            alignItems: "center",
            gap: "6px",
            backgroundColor: "rgba(255,255,255,0.15)",
            borderRadius: "12px",
            padding: "4px 10px",
          }}
        >
          <div
            style={{
              width: "7px",
              height: "7px",
              backgroundColor: "#57D9A3",
              borderRadius: "50%",
            }}
          />
          <button
            className={`send-btn ${input.trim() && !loading ? "send-active" : ""}`}
            onClick={() => sendMessage()}
            disabled={loading || !input.trim()}
          >
            {loading ? <span className="send-spinner" /> : "↑"}
          </button>
        </div>
        <div className="input-hint">Enter to send · Shift+Enter for new line</div>
      </div>

    </div>
  );
}