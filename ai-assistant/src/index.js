import Resolver from "@forge/resolver";
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

// Register settings resolvers (save/get/clear credentials)
registerSettingsResolvers(resolver);

// Main chat resolver
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

    // Case 1: Proper tool call
    if (finishReason === "tool_calls" && responseMessage?.tool_calls) {
      const toolCall = responseMessage.tool_calls[0];
      const toolName = toolCall.function.name;
      const toolArgs = JSON.parse(toolCall.function.arguments || "{}");
      const toolResult = await executeTool(toolName, toolArgs, creds);
      const resultText = toolResult?.content?.[0]?.text || "No result";
      return { error: false, text: formatToolResult(toolName, resultText) };
    }

    const rawText = responseMessage?.content || "";

    // Case 2: Tool call as text (fallback)
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

    // Case 3: Normal text response
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
