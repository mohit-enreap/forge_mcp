import React, { useState } from "react";
import ChatWindow from "./components/ChatWindow";
import InputBar from "./components/InputBar";
import { invokeBackend } from "./forgeBridge";

export default function App() {
  const [messages, setMessages] = useState([]);
  const [isLoading, setIsLoading] = useState(false);

  const sendMessage = async (text) => {
    setMessages((prev) => [
      ...prev,
      {
        id: Date.now(),
        role: "user",
        content: text,
      },
    ]);
    setIsLoading(true);

    try {
      const response = await invokeBackend("chat", {
        message: text,
        history: messages.slice(-10),
      });

      setMessages((prev) => [
        ...prev,
        {
          id: Date.now() + 1,
          role: "assistant",
          content: response.text,
        },
      ]);
    } catch (err) {
      console.error("Error:", err);
      setMessages((prev) => [
        ...prev,
        {
          id: Date.now() + 1,
          role: "assistant",
          content: "Sorry, something went wrong. Please try again.",
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100%",
        minHeight: "600px", // ← add this line
        backgroundColor: "#F4F5F7",
        overflow: "hidden",
      }}
    >
      {/* Header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "12px",
          padding: "0 20px",
          height: "56px",
          minHeight: "56px",
          backgroundColor: "#0052CC",
          flexShrink: 0,
        }}
      >
        <div
          style={{
            width: "32px",
            height: "32px",
            backgroundColor: "white",
            borderRadius: "4px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontWeight: "bold",
            fontSize: "14px",
            color: "#0052CC",
          }}
        >
          AI
        </div>

        <div>
          <div
            style={{
              color: "white",
              fontWeight: "600",
              fontSize: "15px",
            }}
          >
            AI Assistant
          </div>
          <div style={{ color: "#B3D4FF", fontSize: "11px" }}>
            Powered by Gemini 2.5
          </div>
        </div>

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
          <span style={{ color: "#DEEBFF", fontSize: "12px" }}>Online</span>
        </div>
      </div>

      {/* Chat area */}
      <div
        style={{
          flex: "1 1 0",
          minHeight: 0,
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
        }}
      >
        <ChatWindow messages={messages} isLoading={isLoading} />
      </div>

      {/* Input */}
      <InputBar onSend={sendMessage} isLoading={isLoading} />
    </div>
  );
}
