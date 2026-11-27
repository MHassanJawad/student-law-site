import { describe, expect, it } from "vitest";
import { getAssistantConfig } from "./config";

const base = { ASSISTANT_ENABLED: "true", ASSISTANT_API_KEY: "sk-test" };

describe("getAssistantConfig", () => {
  it("returns null unless ASSISTANT_ENABLED is on", () => {
    expect(getAssistantConfig({ ASSISTANT_API_KEY: "sk-test" })).toBeNull();
    expect(getAssistantConfig({ ...base, ASSISTANT_ENABLED: "false" })).toBeNull();
    expect(getAssistantConfig(base)).not.toBeNull();
  });

  it("returns null without a key or with a replace-with- placeholder", () => {
    expect(getAssistantConfig({ ASSISTANT_ENABLED: "true" })).toBeNull();
    expect(getAssistantConfig({ ...base, ASSISTANT_API_KEY: "replace-with-key" })).toBeNull();
  });

  it("rejects plain http except for localhost", () => {
    expect(getAssistantConfig({ ...base, ASSISTANT_API_URL: "http://127.0.0.1:9999/v1" })).not.toBeNull();
    expect(getAssistantConfig({ ...base, ASSISTANT_API_URL: "http://example.com" })).toBeNull();
    expect(getAssistantConfig({ ...base, ASSISTANT_API_URL: "not a url" })).toBeNull();
  });

  it("applies defaults and parses positive integer limits", () => {
    expect(getAssistantConfig(base)).toEqual({
      apiKey: "sk-test", apiUrl: "https://api.groq.com/openai/v1/chat/completions",
      model: "openai/gpt-oss-120b", userDailyLimit: 30, globalDailyLimit: 500, timeoutMs: 20000,
    });
    const c = getAssistantConfig({ ...base, ASSISTANT_USER_DAILY_LIMIT: "abc", ASSISTANT_GLOBAL_DAILY_LIMIT: "40", ASSISTANT_TIMEOUT_MS: "-5" });
    expect(c).toMatchObject({ userDailyLimit: 30, globalDailyLimit: 40, timeoutMs: 20000 });
  });
});
