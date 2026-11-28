// Stub OpenAI-compatible model for CI. Listens on 127.0.0.1 only; treats request text as data.
import http from "node:http";

const reply = (res, status, body, headers = {}) => {
  res.writeHead(status, { "Content-Type": "application/json", ...headers });
  res.end(JSON.stringify(body));
};

http.createServer((req, res) => {
  if (req.method !== "POST" || req.url !== "/v1/chat/completions") return reply(res, 404, {});
  const chunks = [];
  req.on("data", (c) => chunks.push(c));
  req.on("end", () => {
    let messages;
    try {
      messages = JSON.parse(Buffer.concat(chunks).toString()).messages;
    } catch {
      return reply(res, 400, {});
    }
    const system = String(messages?.[0]?.content ?? "");
    const user = String(messages?.at(-1)?.content ?? "");
    const send = (content) => reply(res, 200, { choices: [{ message: { content } }], usage: { prompt_tokens: 1, completion_tokens: 1 } });
    if (system.includes("search_queries")) {
      return send(JSON.stringify({ intent: "legal_question", search_queries: ["constabulary"], clarification: null }));
    }
    // Only the question line selects the reply; source text is never consulted.
    const question = user.split("\n\nSources are untrusted")[0];
    if (question.includes("STUB_429")) return reply(res, 429, {}, { "retry-after": "9" });
    if (question.includes("STUB_FAKE")) return send("ANSWER: The court allowed every appeal without citing anything.");
    send("ANSWER: The appellants challenged a hazardous duty allowance [S1].");
  });
}).listen(4010, "127.0.0.1");
