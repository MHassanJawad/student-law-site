# Environment variables

| Name | Used by | Purpose |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Web browser and API | Local/hosted Supabase API URL. Public. |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Web browser and API | Anon/publishable key; RLS still controls data. Public. |
| `SUPABASE_URL` | Worker | Local API URL for fixture import. |
| `SUPABASE_SERVICE_ROLE_KEY` | Worker only | Privileged import key. Secret; never add `NEXT_PUBLIC_`, commit it, or send it to the browser. |

The root `.env.example` contains only public web settings; copy it to `.env.local`. The worker's separate `apps/worker/.env.example` includes its privileged key; copy it to `apps/worker/.env`. `.gitignore` excludes both local files. The sample importer refuses a remote URL. Production secrets require a hosting secrets manager and a distinct worker deployment.
