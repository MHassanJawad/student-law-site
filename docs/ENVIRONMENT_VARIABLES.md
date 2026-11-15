# Environment variables

| Name | Used by | Required | Purpose |
| --- | --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Web browser and API | Yes | Local/hosted Supabase API URL. Public. Compiled into the browser bundle and the Content-Security-Policy at build time, so a change needs a rebuild. |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Web browser and API | Yes | Anon/publishable key; RLS still controls data. Public. Compiled in at build time. |
| `NEXT_PUBLIC_SUPPORT_EMAIL` | About and privacy pages | Before launch | Contact address shown for privacy, account, and correction requests. Compiled in at build time. Without it the pages say no address is published yet. |
| `MAINTENANCE_MODE` | Web runtime | No | Set to `on` to return 503 for every page and API path except `/api/v1/health`. Read at runtime; restart the web process to apply. |
| `TRUSTED_PROXY_HOPS` | Web runtime | No | Number of trusted proxies in front of the app (default `1`). Rate limiting reads the client address that many entries from the right of `X-Forwarded-For`. Set `2` behind a CDN plus a load balancer. |
| `APP_VERSION` | Web runtime | No | Release identifier reported by `/api/v1/health`. The container build sets it from the `APP_VERSION` build argument. |
| `NEXT_OUTPUT` | Web build | No | `standalone` produces the self-contained server used by the [Dockerfile](../Dockerfile). Leave unset for `next start`. |
| `SUPABASE_URL` | Worker | Yes, worker | Local API URL for fixture import. |
| `SUPABASE_SERVICE_ROLE_KEY` | Worker only | Yes, worker | Privileged import key. Secret; never add `NEXT_PUBLIC_`, commit it, or send it to the browser. |
| `TARGET_SUPABASE_URL` | Corpus sync only | For `sync:corpus` | Hosted Supabase API URL that receives reviewed corpus records. Must be HTTPS. |
| `TARGET_SUPABASE_SERVICE_ROLE_KEY` | Corpus sync only | For `sync:corpus` | Hosted service-role key. Secret; keep it only in `apps/worker/.env` on the operator machine. |
| `SUMMARY_API_KEY` | Summary drafting only | For `summarize:judgments` | API key for the summary model. Secret; keep it only in `apps/worker/.env`. A free Groq key works with the defaults. |
| `SUMMARY_API_URL` | Summary drafting only | No | OpenAI-compatible chat completions URL. Default `https://api.groq.com/openai/v1/chat/completions`. Must be HTTPS. |
| `SUMMARY_MODEL` | Summary drafting only | No | Model name sent to that API. Default `openai/gpt-oss-120b` (Groq retired `llama-3.3-70b-versatile` in 2026). It is shown on the site next to each summary. |
| `SUMMARY_MAX_INPUT_CHARS` | Summary drafting only | No | Judgment characters sent per request (default `12000`, about 3,000 tokens). Groq's free tier allows 8,000 tokens per minute, and the worker reads the provider's rate-limit headers and waits for the allowance. |
| `SUMMARY_PAUSE_MS` | Summary drafting only | No | Pause between requests (default `2000`). The worker also waits for the token allowance, so this only spaces requests slightly. |

The root `.env.example` contains only public web settings; copy it to `.env.local`. The worker's separate `apps/worker/.env.example` includes its privileged key; copy it to `apps/worker/.env`. `.gitignore` excludes both local files. Hosted public values go in `apps/web/.env.production.local`, which `next build` and `next start` read in preference to `.env.local`; `next dev` ignores it. The sample importer refuses a remote URL. Production secrets require a hosting secrets manager and a distinct worker deployment. The web app holds no secret: its only keys are public and rely on RLS.
