// Check security headers, health reporting, input handling, and API rate limits on the built app.
import assert from "node:assert/strict";

const origin = process.env.LOCAL_WEB_URL;
assert.ok(origin && ["localhost", "127.0.0.1"].includes(new URL(origin).hostname), "Use the local CI web server.");

const home = await fetch(new URL("/", origin));
assert.equal(home.status, 200);
const policy = home.headers.get("content-security-policy") ?? "";
for (const directive of ["default-src 'self'", "frame-ancestors 'none'", "object-src 'none'"]) {
  assert.ok(policy.includes(directive), `CSP should include ${directive}`);
}
assert.ok(!policy.includes("unsafe-eval"), "Production CSP should not allow eval.");
assert.match(home.headers.get("strict-transport-security") ?? "", /max-age=\d+/);
assert.equal(home.headers.get("x-content-type-options"), "nosniff");
assert.equal(home.headers.get("x-frame-options"), "DENY");

const health = await fetch(new URL("/api/v1/health", origin));
const healthBody = await health.json();
assert.equal(health.status, 200, `Health should pass: ${JSON.stringify(healthBody)}`);
assert.deepEqual(healthBody.checks, { configuration: "ok", database: "ok" });

// SEC-001: a quoted SQL payload is bound as data and never surfaces a database error.
const injection = new URLSearchParams({ mode: "case-law", q: "'; DROP TABLE public.legal_documents;--" });
const injected = await fetch(new URL(`/api/v1/search/research?${injection}`, origin));
const injectedText = await injected.text();
assert.ok([200, 400].includes(injected.status), `Injection payload returned ${injected.status}`);
assert.doesNotMatch(injectedText, /syntax error|postgres|relation "/i);
const stillSearchable = await fetch(new URL("/api/v1/search/research?mode=case-law&q=1285-K", origin));
assert.equal(stillSearchable.status, 200);
assert.ok((await stillSearchable.json()).total >= 1, "Corpus should be intact after the payload.");

// SEC-004: account routes reject a missing session.
const anonymous = await fetch(new URL("/api/v1/me/saved-citations", origin));
assert.equal(anonymous.status, 401);

// SEC-006: the public read bucket allows 240 requests per minute per client.
let limited = null;
for (let attempt = 0; attempt < 260 && !limited; attempt += 1) {
  const response = await fetch(new URL("/api/v1/coverage", origin));
  if (response.status === 429) limited = response;
  else await response.arrayBuffer();
}
assert.ok(limited, "Repeated requests should be rate limited.");
assert.ok(Number(limited.headers.get("retry-after")) > 0, "A limited response should include Retry-After.");
const limitedBody = await limited.json();
assert.equal(limitedBody.error.code, "RATE_LIMITED");
assert.ok(limitedBody.error.requestId);
const healthDuringLimit = await fetch(new URL("/api/v1/health", origin));
assert.equal(healthDuringLimit.status, 200, "Health checks should not be rate limited.");

process.stdout.write("Security headers, health, injection handling, auth denial, and rate limiting passed.\n");
