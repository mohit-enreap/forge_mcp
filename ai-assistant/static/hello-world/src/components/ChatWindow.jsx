import React, { useRef, useEffect } from "react";
import MessageBubble from "./MessageBubble";
import TypingIndicator from "./TypingIndicator";

export default function ChatWindow({ messages, isLoading }) {
  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  return (
    <div
      style={{
        flex: 1,
        overflowY: "auto",
        padding: "24px 20px",
        backgroundColor: "#F4F5F7",
        minHeight: 0,
      }}
    >
      {/* Empty state */}
      {messages.length === 0 && !isLoading && (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            minHeight: "400px", // ← change from height:'100%' to this
            textAlign: "center",
            padding: "40px 20px",
          }}
        >
          <div
            style={{
              width: "60px",
              height: "60px",
              backgroundColor: "#6554C0",
              borderRadius: "16px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "white",
              fontSize: "20px",
              fontWeight: "bold",
              marginBottom: "16px",
            }}
          >
            AI
          </div>

          <h2
            style={{
              fontSize: "20px",
              fontWeight: "600",
              color: "#172B4D",
              margin: "0 0 8px 0",
            }}
          >
            How can I help you today?
          </h2>

          <p
            style={{
              fontSize: "14px",
              color: "#6B778C",
              margin: "0 0 24px 0",
              maxWidth: "360px",
              lineHeight: "1.6",
            }}
          >
            Ask me anything or try one of these:
          </p>

          {/* Suggestion chips */}
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: "8px",
              justifyContent: "center",
              maxWidth: "480px",
            }}
          >
            {[
              "Create a Jira bug ticket",
              "Search Confluence pages",
              "Summarize a document",
              "Find open issues",
            ].map((text) => (
              <div
                key={text}
                style={{
                  padding: "6px 14px",
                  backgroundColor: "white",
                  border: "1px solid #DFE1E6",
                  borderRadius: "16px",
                  fontSize: "13px",
                  color: "#0052CC",
                  cursor: "pointer",
                  boxShadow: "0 1px 2px rgba(9,30,66,0.08)",
                }}
              >
                {text}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Messages */}
      {messages.map((msg) => (
        <MessageBubble key={msg.id} message={msg} />
      ))}

      {/* Typing indicator */}
      {isLoading && <TypingIndicator />}

      {/* Auto scroll target */}
      <div ref={bottomRef} />
    </div>
  );
}
