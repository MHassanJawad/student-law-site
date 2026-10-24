// Measure the tiny seeded corpus on the disposable Linux CI stack.
import assert from "node:assert/strict";
import { performance } from "node:perf_hooks";

const origin = process.env.LOCAL_WEB_URL;
assert.equal(process.env.GITHUB_ACTIONS, "true", "CI latency measurement runs only in CI.");
assert.ok(origin && ["localhost", "127.0.0.1"].includes(new URL(origin).hostname));

const scenarios = [
  ["case_law_hit", "/api/v1/search/research?mode=case-law&q=1285-K"],
  ["statutes_hit", "/api/v1/search/research?mode=statutes&q=Contract&jurisdiction=Federal&year=1872"],
  ["citation_empty", "/api/v1/search/research?mode=citation&q=PLD"],
  ["document_detail", "/api/v1/documents/22222222-2222-4222-8222-222222222222"],
];
const percentile = (sorted, p) => Math.round(sorted[Math.ceil((p / 100) * sorted.length) - 1]);
const results = [];
for (const [name, path] of scenarios) {
  const samples = [];
  for (let i = 0; i < 20; i += 1) {
    const start = performance.now();
    const response = await fetch(new URL(path, origin), { signal: AbortSignal.timeout(10_000) });
    const body = await response.json();
    const elapsed = performance.now() - start;
    assert.equal(response.status, 200, `${name}: ${JSON.stringify(body)}`);
    if (name === "case_law_hit" || name === "statutes_hit") assert.equal(body.total, 1);
    if (name === "citation_empty") assert.equal(body.total, 0);
    if (i >= 3) samples.push(elapsed);
  }
  samples.sort((a, b) => a - b);
  results.push({ scenario: name, samples: samples.length,
    p50_ms: percentile(samples, 50), p95_ms: percentile(samples, 95) });
}
process.stdout.write(`CI seeded-corpus latency: ${JSON.stringify(results)}\n`);
