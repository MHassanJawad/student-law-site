// Automated public-page accessibility smoke check on GitHub's Linux runner.
import assert from "node:assert/strict";
import { AxeBuilder } from "@axe-core/playwright";
import { chromium } from "playwright-core";

const origin = process.env.LOCAL_WEB_URL;
assert.equal(process.env.GITHUB_ACTIONS, "true", "Browser check runs only in CI.");
assert.ok(origin && ["localhost", "127.0.0.1"].includes(new URL(origin).hostname));
assert.ok(process.env.CHROME_BIN, "A Chrome executable is required on the CI runner.");

const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROME_BIN });
const problems = [];
try {
  for (const width of [390, 1280]) {
    const context = await browser.newContext({ viewport: { width, height: 850 } });
    const page = await context.newPage();
    for (const [name, path, ready] of [
      ["home", "/", "h1"],
      ["search", "/search?mode=case-law", "#research-query"],
      ["sign_in", "/sign-in", "#email"],
      ["document", "/documents/22222222-2222-4222-8222-222222222222", "h1#overview"],
    ]) {
      const response = await page.goto(new URL(path, origin).toString(), { waitUntil: "domcontentloaded" });
      assert.equal(response?.status(), 200, `${name} should load`);
      await page.locator(ready).waitFor();
      const result = await new AxeBuilder({ page }).analyze();
      const violations = result.violations.map((item) => ({
        id: item.id, impact: item.impact, nodes: item.nodes.map((node) => node.target).slice(0, 5),
      }));
      process.stdout.write(`axe ${name} ${width}px: ${JSON.stringify(violations)}\n`);
      problems.push(...violations.filter((item) => ["critical", "serious"].includes(item.impact)));
    }
    await page.goto(origin);
    await page.keyboard.press("Tab");
    assert.equal(await page.locator(":focus").getAttribute("href"), "#main",
      `Skip link should be first keyboard target at ${width}px.`);
    await context.close();
  }
} finally {
  await browser.close();
}
assert.deepEqual(problems, [], "Serious or critical accessibility issues were found.");
