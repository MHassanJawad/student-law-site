# Local development setup

Phase 2 requires Node.js 22, npm, and a running Docker-compatible engine. No cloud account or paid service is required for local development. The Supabase local stack is for development only and must not be exposed publicly. On Windows PowerShell with script execution disabled, use `npm.cmd`/`npx.cmd` rather than `npm.ps1`/`npx.ps1`.

1. Run `npm install --legacy-peer-deps` in the repository root.
2. Run `npx supabase start` (or `npx.cmd supabase start` on Windows). This creates local Postgres, Auth, and Studio. Keep it bound to localhost.
3. Run `npx supabase status` to obtain the local API URL, publishable/anon key, and service-role key.
4. Copy root `.env.example` to `apps/web/.env.local` and fill its public URL/key. Copy `apps/worker/.env.example` to `apps/worker/.env` and fill the local URL/service-role key. Never place the service-role key in the web environment or expose it in client code.
5. Run `npx supabase db reset --local` to apply `supabase/migrations/` and `supabase/seed.sql`. The seed includes one FCCP listing metadata record, with no copied judgment text.
6. Run `npm run dev` and open `http://localhost:3000`. Search for `C.P.L.A. No.1285-K`, open the result, create an account, save it, sign out and back in, and reopen Saved Citations.
7. Optional: `npm run import:sample` reruns the fixture importer using `apps/worker/.env` and should leave one document version. The worker refuses non-local Supabase URLs.
8. Run `npm run test:local` while the web app is running. It exercises search, detail, two temporary accounts, saved citations, direct row-level access checks, and removal. It deletes its temporary accounts afterward.

The local database and Auth live in Docker. Do not run test reset commands against a hosted database. Before public hosting, choose a provider/region, backups, email delivery, incident response, and privacy policy; those are not satisfied by this local setup.

If Docker is unavailable, `npm run lint`, `npm run typecheck`, `npm test`, and `npm run build` still verify the code. API routes return a setup error until Supabase settings are supplied.
