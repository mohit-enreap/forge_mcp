import Resolver from "@forge/resolver";
import { kvs } from "@forge/kvs";
import { getCredentials, registerSettingsResolvers } from "./credentials.js";
import { executeTool } from "./tools/executor.js";
import { callGroq } from "./groq.js";
import {
  needsTools,
  selectRelevantTools,
  toGroqFormat,
  formatToolResult,
  buildMessages,
  parseToolCallFromText,
} from "./utils.js";

const resolver = new Resolver();

// Register settings resolvers
registerSettingsResolvers(resolver);

// ── Chat History: List all chats ──
resolver.define("listChats", async () => {
  try {
    const index = (await kvs.get("chats_index")) || [];
    // Sort by most recent first
    const sorted = index.sort((a, b) => b.createdAt - a.createdAt);
    return { success: true, chats: sorted };
  } catch (err) {
    console.error("listChats error:", err.message);
    return { success: false, chats: [] };
  }
});

// ── Chat History: Load one full chat ──
resolver.define("loadChat", async (req) => {
  const { chatId } = req.payload;
  try {
    const chat = await kvs.get(`chat_${chatId}`);
    if (!chat) return { success: false, chat: null };
    return { success: true, chat };
  } catch (err) {
    console.error("loadChat error:", err.message);
    return { success: false, chat: null };
  }
});

// ── Chat History: Save or update a chat ──
resolver.define("saveChat", async (req) => {
  const { chatId, title, messages } = req.payload;
  try {
    const now = Date.now();

    // Save full chat
    const existing = await kvs.get(`chat_${chatId}`);
    const chat = {
      id: chatId,
      title: title || "New Chat",
      messages: messages || [],
      createdAt: existing?.createdAt || now,
      updatedAt: now,
    };
    await kvs.set(`chat_${chatId}`, chat);

    // Update index
    let index = (await kvs.get("chats_index")) || [];
    const existingIndex = index.findIndex((c) => c.id === chatId);

    if (existingIndex >= 0) {
      index[existingIndex] = {
        id: chatId,
        title: chat.title,
        createdAt: chat.createdAt,
        updatedAt: now,
      };
    } else {
      index.unshift({
        id: chatId,
        title: chat.title,
        createdAt: now,
        updatedAt: now,
      });
    }

    // Keep max 100 chats
    if (index.length > 100) index = index.slice(0, 100);
    await kvs.set("chats_index", index);

    return { success: true };
  } catch (err) {
    console.error("saveChat error:", err.message);
    return { success: false, error: err.message };
  }
});

// ── Chat History: Delete a chat ──
resolver.define("deleteChat", async (req) => {
  const { chatId } = req.payload;
  try {
    // Delete full chat
    await kvs.delete(`chat_${chatId}`);

    // Remove from index
    const index = (await kvs.get("chats_index")) || [];
    const updated = index.filter((c) => c.id !== chatId);
    await kvs.set("chats_index", updated);

    return { success: true };
  } catch (err) {
    console.error("deleteChat error:", err.message);
    return { success: false, error: err.message };
  }
});

// ── Chat History: Clear all chats ──
resolver.define("clearAllChats", async () => {
  try {
    const index = (await kvs.get("chats_index")) || [];
    for (const chat of index) {
      await kvs.delete(`chat_${chat.id}`);
    }
    await kvs.set("chats_index", []);
    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

// ── Main chat resolver ──
resolver.define("chat", async (req) => {
  const { message, history } = req.payload;
  const apiKey = process.env.GROQ_API_KEY;

  console.log("Chat request:", message);
  if (!apiKey) return { error: true, text: "Groq API key not configured." };

  const creds = await getCredentials();
  if (!creds.baseUrl || !creds.email || !creds.token) {
    return {
      error: true,
      text: "Please configure your Atlassian credentials first.",
    };
  }

  try {
    const requiresTools = needsTools(message);
    const relevantTools = requiresTools ? selectRelevantTools(message) : [];
    const groqTools = toGroqFormat(relevantTools);
    const messages = buildMessages(history || [], message);
    const forceTools = requiresTools && groqTools.length > 0;

    console.log(
      "Requires tools:",
      requiresTools,
      "| Tool count:",
      groqTools.length,
    );

    const groqResponse = await callGroq(
      messages,
      apiKey,
      groqTools,
      forceTools,
    );
    const choice = groqResponse.choices?.[0];
    const responseMessage = choice?.message;
    const finishReason = choice?.finish_reason;

    console.log("Finish reason:", finishReason);

    if (finishReason === "tool_calls" && responseMessage?.tool_calls) {
      const toolCall = responseMessage.tool_calls[0];
      const toolName = toolCall.function.name;
      const toolArgs = JSON.parse(toolCall.function.arguments || "{}");
      const toolResult = await executeTool(toolName, toolArgs, creds);
      const resultText = toolResult?.content?.[0]?.text || "No result";
      return { error: false, text: formatToolResult(toolName, resultText) };
    }

    const rawText = responseMessage?.content || "";

    if (rawText.includes("<function") && groqTools.length > 0) {
      const parsed = parseToolCallFromText(rawText);
      if (parsed) {
        const toolResult = await executeTool(parsed.name, parsed.args, creds);
        const resultText = toolResult?.content?.[0]?.text || "No result";
        return {
          error: false,
          text: formatToolResult(parsed.name, resultText),
        };
      }
    }

    if (rawText) return { error: false, text: rawText };
    return { error: true, text: "Empty response received." };
  } catch (err) {
    console.error("Chat error:", err.message);
    if (err.message === "RATE_LIMITED") {
      return {
        error: true,
        text: "Rate limit reached. Please wait 30 seconds and try again.",
      };
    }
    return { error: true, text: `Error: ${err.message}` };
  }
});

export const handler = resolver.getDefinitions();
