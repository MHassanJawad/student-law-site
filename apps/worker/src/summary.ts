// Prompt, input trimming, and output checks for short AI judgment summaries.

export const SUMMARY_PROMPT_VERSION = "summary-v1";
export const DEFAULT_SUMMARY_API_URL = "https://api.groq.com/openai/v1/chat/completions";
export const DEFAULT_SUMMARY_MODEL = "openai/gpt-oss-120b";
/** About 6,000 tokens, which fits free-tier per-minute token limits. */
export const DEFAULT_MAX_INPUT_CHARS = 24_000;

export const SYSTEM_PROMPT = `You write short summaries of Pakistani court judgments for law students.
Use only the judgment text you are given; never add facts, names, citations, or outcomes it does not state.
Write one plain paragraph of 3 to 5 sentences and at most 120 words covering: what kind of case it is and who the parties are,
the main legal question, what the court decided, and the key reason. No headings, lists, or preamble.
If the text is too incomplete to tell what was decided, reply with exactly: INSUFFICIENT`;

/**
 * Keep the start (parties, issue) and the end (decision) of a long judgment.
 *
 * @param text - Full extracted judgment text.
 * @param maxChars - Character budget for the model input.
 */
export function summaryInput(text: string, maxChars = DEFAULT_MAX_INPUT_CHARS): string {
  const clean = text.trim();
  if (clean.length <= maxChars) return clean;
  const head = Math.floor(maxChars * 0.65);
  return `${clean.slice(0, head)}\n\n[... middle of the judgment omitted ...]\n\n${clean.slice(clean.length - (maxChars - head))}`;
}

/**
 * Validate model output before it is stored for review.
 *
 * @returns The cleaned summary, or null when the model declined or the output is unusable.
 */
export function cleanSummary(output: string): string | null {
  const text = output.replace(/^\s*(summary|here is[^:]*):\s*/i, "").replace(/\s+/g, " ").trim();
  if (/^INSUFFICIENT\b/i.test(text) || text.length < 40 || text.length > 2000) return null;
  return text;
}
