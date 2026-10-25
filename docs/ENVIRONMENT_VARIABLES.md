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

The root `.env.example` contains only public web settings; copy it to `.env.local`. The worker's separate `apps/worker/.env.example` includes its privileged key; copy it to `apps/worker/.env`. `.gitignore` excludes both local files. The sample importer refuses a remote URL. Production secrets require a hosting secrets manager and a distinct worker deployment. The web app holds no secret: its only keys are public and rely on RLS.
