// Build the HTTP security headers sent with every web response.
export type Header = { key: string; value: string };

/**
 * Returns security headers for the configured Supabase origin.
 * Next.js emits inline bootstrap scripts, so `script-src` keeps `'unsafe-inline'`
 * until nonce-based rendering is adopted; React output encoding remains the XSS control.
 *
 * @param supabaseUrl - Public Supabase API URL the browser calls for sign-in.
 * @param development - Adds the evaluation permission the development server needs.
 * @returns Header name/value pairs for `next.config.ts`.
 */
export function securityHeaders(supabaseUrl: string | undefined, development: boolean): Header[] {
  const connect = ["'self'", originOf(supabaseUrl)].filter(Boolean).join(" ");
  const scripts = development ? "'self' 'unsafe-inline' 'unsafe-eval'" : "'self' 'unsafe-inline'";
  const policy = [
    "default-src 'self'",
    `script-src ${scripts}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data:",
    "font-src 'self'",
    `connect-src ${connect}`,
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
  ].join("; ");
  return [
    { key: "Content-Security-Policy", value: policy },
    { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" },
    { key: "X-Content-Type-Options", value: "nosniff" },
    { key: "X-Frame-Options", value: "DENY" },
    { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
    { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
    { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
  ];
}

function originOf(url: string | undefined): string {
  if (!url) return "";
  try {
    return new URL(url).origin;
  } catch {
    // An invalid URL leaves the browser limited to same-origin requests.
    return "";
  }
}
