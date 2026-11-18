// Prompt, input trimming, and output checks for short AI judgment summaries.

export const SUMMARY_PROMPT_VERSION = "summary-v2";
export const DEFAULT_SUMMARY_API_URL = "https://api.groq.com/openai/v1/chat/completions";
export const DEFAULT_SUMMARY_MODEL = "openai/gpt-oss-120b";
/** About 3,000 tokens: Groq's free tier allows 8,000 tokens per minute, so this fits two requests a minute. */
export const DEFAULT_MAX_INPUT_CHARS = 12_000;

export const SYSTEM_PROMPT = `You write the short blurb shown under a Pakistani court judgment in a legal research site.
A law student reads it to decide whether the judgment is worth opening, so say what the judgment is ABOUT and what it decides.
Use only the judgment text you are given; never add facts, names, citations, or outcomes it does not state.
Write one plain paragraph of 2 to 4 sentences and at most 90 words that covers:
1. the subject matter in concrete terms (for example: promotion of a civil servant, a land-acquisition dispute, a tax assessment, a bail order);
2. the legal question or questions the court decides, naming the statute, rule, or constitutional provision it turns on when the text names one;
3. what the court decides and the main reason, so the reader knows what rule or principle to expect.
Do not start with the court's name, the judges, or "This is a petition". Do not list parties or lawyers unless a party is central to the legal point.
No headings, lists, or preamble.
If the text is too incomplete to tell what the judgment is about, reply with exactly: INSUFFICIENT`;

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
