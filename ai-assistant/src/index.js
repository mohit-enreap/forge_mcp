import Resolver from "@forge/resolver";
// import { executeTool } from "./tools/executor.js";
import { executeTool } from "./services/toolExecutor.service.js";
// import { callGroq } from "./groq.js";
import { callGroq } from "./clients/groq.client.js";
import {
  needsTools,
  selectRelevantTools,
  toGroqFormat,
  formatToolResult,
  buildMessages,
  parseToolCallFromText,
} from "./utils/utils.js";

const resolver = new Resolver();

resolver.define("chat", async (req) => {
  const { message, history } = req.payload;

  const accountId = req.context?.accountId;
  const cloudId   = req.context?.cloudId;

  console.log("🚀 accountId:", accountId);
  console.log("🚀 cloudId:",   cloudId);
  console.log("Chat request:", message);

  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) return { error: true, text: "Groq API key not configured." };

  try {
    const requiresTools  = needsTools(message);
    const relevantTools  = requiresTools ? selectRelevantTools(message) : [];
    const groqTools      = toGroqFormat(relevantTools);
    const messages       = buildMessages(history || [], message);
    const forceTools     = requiresTools && groqTools.length > 0;

    console.log("Requires tools:------->", requiresTools, "| Tool count:------>", groqTools.length);

    const groqResponse    = await callGroq(messages, apiKey, groqTools, forceTools);
    const choice          = groqResponse.choices?.[0];
    const responseMessage = choice?.message;
    const finishReason    = choice?.finish_reason;

    console.log("Finish reason:+++++++++", finishReason);

    // Case 1: Proper tool call
    if (finishReason === "tool_calls" && responseMessage?.tool_calls) {
      const toolCall   = responseMessage.tool_calls[0];
      const toolName   = toolCall.function.name;
      const toolArgs   = JSON.parse(toolCall.function.arguments || "{}");
      const toolResult = await executeTool(toolName, toolArgs);
      const resultText = toolResult?.content?.[0]?.text || "No result";
      return { error: false, text: formatToolResult(toolName, resultText) };
    }

      if (finishReason === "tool_calls" && responseMessage?.tool_calls) {
        const toolCall = responseMessage.tool_calls[0];
        const toolName = toolCall.function.name;
        const toolArgs = JSON.parse(toolCall.function.arguments || "{}");
      }

    // Case 2: Tool call leaked as text (fallback)
    if (rawText.includes("<function") && groqTools.length > 0) {
      const parsed = parseToolCallFromText(rawText);
      if (parsed) {
        const toolResult = await executeTool(parsed.name, parsed.args);
        const resultText = toolResult?.content?.[0]?.text || "No result";
        return { error: false, text: formatToolResult(parsed.name, resultText) };
      }

      const text = responseMessage?.content;
      if (text) {
        console.log("Final answer received");
        return { error: false, text };
      }

      return { error: true, text: "Empty response received." };
    }

    return {
      error: true,
      text: "Could not complete the request. Please try again.",
    };
  } catch (err) {
    console.error("Chat error:", err.message);
    if (err.message === "RATE_LIMITED") {
      return { error: true, text: "Rate limit reached. Please wait 30 seconds and try again." };
    }
    return { error: true, text: `Error: ${err.message}` };
  }

});


export const handler = resolver.getDefinitions();
