# Local development and frontend testing

Requires Node.js 22, npm, Docker Desktop, and free disk space. Work from the repository root. These instructions use Windows PowerShell; use `npm` and `npx` in a shell where those commands work. The local Supabase stack is for development and should remain on localhost.

## First setup

1. Start Docker Desktop. Run `npm.cmd ci --legacy-peer-deps`.
2. Run `npx.cmd supabase start`. If this is a fresh local database, run `npx.cmd supabase db reset --local` to apply migrations and load two labeled metadata samples. **Reset deletes existing local database data.**
3. Run `npx.cmd supabase status` to read the local API URL and anon/publishable key. Copy `.env.example` to `apps/web/.env.local` and fill in `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`. The web app never needs the service-role key.
4. Run `npm.cmd run dev` and open `http://localhost:3000`.

If this workspace already has a local database, preserve its reviewed FCCP pilot data: run `npx.cmd supabase migration up --local` to apply new migrations. To add the local legislation sample without resetting, run `Get-Content -Raw supabase/seed.sql | docker exec -i supabase_db_student-law-site psql -U postgres -d postgres -v ON_ERROR_STOP=1`. The seed uses fixed IDs and can be rerun.

For worker commands, copy `apps/worker/.env.example` to `apps/worker/.env` and set the local service-role key from `npx.cmd supabase status`. Keep this file private. Worker setup is unnecessary for browsing the seeded front end.

## What to click

1. Open `http://localhost:3000/search?mode=case-law`. The clean seed has one **LOCAL SAMPLE** judgment. This existing workspace also has one separately reviewed FCCP judgment, so it currently shows two. Search `1275` to find the reviewed FCCP item, or `1285-K` for the sample.
2. Open **Courtwise** and browse FCCP records. Open **Advanced**, enter `Najafi` as author judge, and search. Decision-date filters intentionally omit records whose decision date is unverified.
3. Open **Citation**. Enter a reporter citation or all three structured fields. The current sample records have no verified reporter citations, so a zero-result explanation is expected. Use Case Law for case identifiers.
4. Open **Statutes**, search `Contract`, or filter by Federal / Act / 1872 / Unknown. Open the Contract Act record and follow its official Pakistan Code link. Its page is marked **LOCAL SAMPLE** and its legal status is unknown.
5. Open a judgment detail. Check source attribution, checked date, version reference, and the official source link. The current metadata-only records have no public document text or sections.
6. Optionally visit **Sign in**, create a local account, save a citation on a document, and reopen it under **Saved Citations**. Local Supabase Auth must be running.

## When something is empty

- `Search is temporarily unavailable`: check Docker Desktop, `npx.cmd supabase status`, and the two public values in `apps/web/.env.local`. Restart `npm.cmd run dev` after editing the environment file.
- No FCCP result: a fresh reset has only the sample. The separately reviewed FCCP item exists only in the current local database until the review process is repeated elsewhere.
- No legislation result: apply migrations 009 and 010, then load the local seed as described above.
- Port 3000 occupied: stop the earlier `npm.cmd run dev` or `npm.cmd run start` process, then restart.
- `There is not enough space on the disk`: check free space on C: as well as D:. Windows and Docker still use C: for temporary files even when the project and Docker image are on D:. Free at least 1 GB on C: before installing dependencies or opening new browser tooling.

See [search semantics](product/search-semantics.md) and the [FCCP runbook](operations/fccp-ingestion.md). The local sample does not assert current law; the Pakistan Code portal itself says its content is under review. Consult the official source and relevant Gazette notification for legal certainty.
