import { kvs } from "@forge/kvs";
import Resolver from "@forge/resolver";

const resolver = new Resolver();

export async function getCredentials() {
  const baseUrl = await kvs.get("atlassian_base_url");
  const email = await kvs.get("atlassian_email");
  const token = await kvs.get("atlassian_api_token");
  return { baseUrl, email, token };
}

export function buildHeaders(email, token) {
  const base64 = Buffer.from(`${email}:${token}`).toString("base64");
  return {
    Authorization: `Basic ${base64}`,
    Accept: "application/json",
    "Content-Type": "application/json",
  };
}

export function registerSettingsResolvers(resolver) {
  resolver.define("saveSettings", async (req) => {
    const { baseUrl, email, token } = req.payload;
    try {
      await kvs.set("atlassian_base_url", baseUrl.trim());
      await kvs.set("atlassian_email", email.trim());
      await kvs.set("atlassian_api_token", token.trim());
      return { success: true };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  resolver.define("getSettings", async () => {
    try {
      const { baseUrl, email, token } = await getCredentials();
      return {
        configured: !!(baseUrl && email && token),
        baseUrl: baseUrl || "",
        email: email || "",
      };
    } catch (err) {
      return { configured: false, baseUrl: "", email: "" };
    }
  });

  resolver.define("clearSettings", async () => {
    try {
      await kvs.delete("atlassian_base_url");
      await kvs.delete("atlassian_email");
      await kvs.delete("atlassian_api_token");
      return { success: true };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });
}
