// Server-only: holds the model API key. Never import from a client component.
export type AssistantConfig = {
  apiKey: string; apiUrl: string; model: string;
  userDailyLimit: number; globalDailyLimit: number; timeoutMs: number;
};

const DEFAULT_URL = "https://api.groq.com/openai/v1/chat/completions";

function positiveInt(value: string | undefined, fallback: number): number {
  const n = Number(value?.trim());
  return Number.isInteger(n) && n > 0 ? n : fallback;
}

function validUrl(value: string): boolean {
  try {
    const u = new URL(value);
    return u.protocol === "https:" || (u.protocol === "http:" && (u.hostname === "localhost" || u.hostname === "127.0.0.1"));
  } catch {
    return false;
  }
}

export function getAssistantConfig(env: Record<string, string | undefined> = process.env): AssistantConfig | null {
  if (!["true", "1", "on"].includes(env.ASSISTANT_ENABLED?.trim().toLowerCase() ?? "")) return null;
  const apiKey = env.ASSISTANT_API_KEY?.trim();
  if (!apiKey || apiKey.startsWith("replace-with-")) return null;
  const apiUrl = env.ASSISTANT_API_URL?.trim() || DEFAULT_URL;
  if (!validUrl(apiUrl)) return null;
  return {
    apiKey, apiUrl, model: env.ASSISTANT_MODEL?.trim() || "openai/gpt-oss-120b",
    userDailyLimit: positiveInt(env.ASSISTANT_USER_DAILY_LIMIT, 30),
    globalDailyLimit: positiveInt(env.ASSISTANT_GLOBAL_DAILY_LIMIT, 500),
    timeoutMs: positiveInt(env.ASSISTANT_TIMEOUT_MS, 20000),
  };
}
