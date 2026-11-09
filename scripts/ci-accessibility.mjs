// Automated public and signed-in accessibility smoke check on GitHub's Linux runner.
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { AxeBuilder } from "@axe-core/playwright";
import { chromium } from "playwright-core";
import { createClient } from "@supabase/supabase-js";

const origin = process.env.LOCAL_WEB_URL;
assert.equal(process.env.GITHUB_ACTIONS, "true", "Browser check runs only in CI.");
assert.ok(origin && ["localhost", "127.0.0.1"].includes(new URL(origin).hostname));
assert.ok(process.env.CHROME_BIN, "A Chrome executable is required on the CI runner.");
assert.ok(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY,
  "A disposable Supabase service connection is required.");

const admin = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } });
const marker = randomUUID();
const email = `a11y-${marker}@example.test`;
const password = `Accessibility!${marker}`;
const { data: created, error: createError } = await admin.auth.admin.createUser({
  email, password, email_confirm: true,
});
assert.ifError(createError);
const userId = created.user?.id;
assert.ok(userId);
const { error: roleError } = await admin.from("profiles").update({ role: "operator" }).eq("id", userId);
assert.ifError(roleError);
const { error: saveError } = await admin.from("saved_citations").insert({
  owner_id: userId,
  document_id: "22222222-2222-4222-8222-222222222222",
  citation_snapshot: "Accessibility check citation",
  note: "Accessibility check note",
  folder: "Accessibility",
});
assert.ifError(saveError);

const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROME_BIN });
const problems = [];
const cspViolations = [];
async function audit(page, name, width) {
  const result = await new AxeBuilder({ page }).analyze();
  const violations = result.violations.map((item) => ({
    id: item.id, impact: item.impact, nodes: item.nodes.map((node) => node.target).slice(0, 5),
  }));
  process.stdout.write(`axe ${name} ${width}px: ${JSON.stringify(violations)}\n`);
  problems.push(...violations.filter((item) => ["critical", "serious"].includes(item.impact)));
}
try {
  for (const width of [390, 1280]) {
    const context = await browser.newContext({ viewport: { width, height: 850 } });
    const page = await context.newPage();
    const pageErrors = [];
    const networkIssues = [];
    page.on("pageerror", (error) => pageErrors.push(error.message));
    page.on("console", (message) => {
      if (message.type() === "error" && /Content Security Policy/i.test(message.text())) cspViolations.push(message.text());
    });
    page.on("requestfailed", (request) => networkIssues.push(`${request.url()}: ${request.failure()?.errorText}`));
    page.on("response", (response) => {
      if (response.status() >= 400) networkIssues.push(`${response.status()} ${response.url()}`);
    });
    for (const [name, path, ready] of [
      ["home", "/", "h1"],
      ["search", "/search?mode=case-law", "#research-query"],
      ["sign_in", "/sign-in", "#email"],
      ["document", "/documents/22222222-2222-4222-8222-222222222222", "h1#overview"],
      ["about", "/about", "h1"],
      ["privacy", "/privacy", "h1"],
    ]) {
      const response = await page.goto(new URL(path, origin).toString(), { waitUntil: "domcontentloaded" });
      assert.equal(response?.status(), 200, `${name} should load`);
      try {
        await page.locator(ready).waitFor({ timeout: 12_000 });
      } catch (error) {
        const visible = (await page.locator("body").innerText()).slice(0, 1500);
        throw new Error(`${name} did not render ${ready}. Visible text: ${visible}. Browser errors: ${JSON.stringify(pageErrors)}. Network issues: ${JSON.stringify(networkIssues.slice(-20))}`, { cause: error });
      }
      await audit(page, name, width);
    }
    await page.goto(new URL("/sign-in", origin).toString());
    await page.locator("#email").fill(email);
    await page.locator("#password").fill(password);
    await page.getByRole("button", { name: "Sign in", exact: true }).click();
    await page.waitForURL("**/saved", { timeout: 12_000 });
    await page.getByRole("heading", { name: "Accessibility check citation" }).waitFor();
    await audit(page, "saved_library", width);
    await page.getByRole("button", { name: "Edit", exact: true }).click();
    await page.getByRole("textbox", { name: "Research note" }).waitFor();
    await audit(page, "saved_edit", width);
    await page.goto(new URL("/account", origin).toString());
    await page.getByText(`Signed in as ${email}.`).waitFor();
    await audit(page, "account", width);
    await page.goto(new URL("/editorial-studio", origin).toString());
    await page.getByRole("textbox", { name: "Provenance and rights note" }).waitFor();
    await audit(page, "editorial_studio", width);
    await page.goto(origin);
    await page.keyboard.press("Tab");
    assert.equal(await page.locator(":focus").getAttribute("href"), "#main",
      `Skip link should be first keyboard target at ${width}px.`);
    await context.close();
  }
} finally {
  await browser.close();
  const { error } = await admin.auth.admin.deleteUser(userId);
  assert.ifError(error);
}
assert.deepEqual(problems, [], "Serious or critical accessibility issues were found.");
assert.deepEqual(cspViolations, [], "The content security policy blocked a page resource.");
