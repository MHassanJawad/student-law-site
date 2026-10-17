# Phase 5 accounts and learning content

Date: 2026-10-17. The personal library now supports notes, folders, local filtering, removal confirmation, and JSON export. Sign-in has a password-recovery request; the recovery page accepts a valid Supabase recovery session. Account settings provide permanent self-deletion after a fresh password check and typed confirmation. Saved-citation routes verify the bearer session and row ownership; database row-level security remains the final boundary.

Maxims, Articles, and Dictionary have public list, search, and detail pages. The `editorial_entries` table starts empty. Only a `profiles.role = 'operator'` account can create or edit entries; entries are drafts until an operator explicitly reviews and publishes them. The database records editor, reviewer, review time, publication time, and an audit row. Public clients can read published entries only. Original explanations must record author and provenance; a source URL is optional when the work is original. The operator workspace is `/editorial-studio`.

The local integration check creates temporary accounts, verifies another student cannot read a saved citation or modify editorial content, verifies drafts are hidden, publishes a test entry, then deletes the operator account and confirms saved citations disappear while published editorial content survives. It verifies wrong-password deletion is rejected. With `PHASE5_WEB_URL=http://localhost:3000`, the same check exercises the saved list, edit, export, and deletion HTTP routes. The test cleans up its temporary entry and users. Run `npm.cmd run test:phase5-local` while local Supabase is running. Migrations 012–016 were applied locally without resetting the existing FCCP pilot.

## Account lifecycle and privacy

- The signed-in account holder can export saved citations as JSON. Export reads owner-scoped rows and includes citation snapshot, note, folder, and timestamps. The browser download should be stored by the user privately.
- Account deletion requires the current password in both the route and the database RPC, so a direct RPC call cannot bypass verification. It removes the Supabase Auth account, profile, and saved citations. The browser signs out on success. It cannot be undone. This check uses the local Supabase Auth password hash format; revalidate it when upgrading Auth or adding sign-in providers.
- Reviewed public editorial work remains published when an operator deletes their login. The byline and provenance note remain part of the public entry; editor/reviewer account IDs are nulled. An operator should use a publication name and avoid private details in those fields.
- Password recovery relies on Supabase email delivery and an allowed `/reset-password` redirect. The current minimal local stack has no SMTP test container, so its recovery request returns an email-delivery error. A full email click-through and hosted SMTP delivery still need verification before launch.

## Remaining Phase 5 gate

The owner must identify the content operator and supply or approve original Maxims, Articles, and Dictionary entries before these pages contain public material. There is no assumed corpus or copied learning content. Promote only the chosen account to `operator` using a service-role/admin workflow; normal clients cannot change their own role. A second-device sign-in and recovery email click-through remain manual browser checks. The public release should not claim reviewed learning coverage until entries are published.
