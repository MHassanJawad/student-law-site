# Data privacy and legal compliance

Updated 2026-10-25. This records what the system stores and the compliance position. It is not legal advice; items marked **review** need a qualified reviewer before public launch. The public notice is [/privacy](../apps/web/src/app/privacy/page.tsx); terms of use and the disclaimer are at [/about](../apps/web/src/app/about/page.tsx).

## Data inventory

| Data | Where | Purpose | Retention |
| --- | --- | --- | --- |
| Email, password hash, sign-in timestamps | Supabase `auth.users` | Account sign-in and recovery | Until account deletion |
| Sign-in audit events, including IP address | Supabase `auth.audit_log_entries` | Account security | Supabase-managed; **hosting**: confirm and record the retention period |
| Role, creation time | `public.profiles` | Operator permissions | Until account deletion |
| Saved citation, note, folder, timestamps | `public.saved_citations` | Personal library | Until the user removes it or deletes the account |
| Session token | Browser local storage | Keep the user signed in | Until sign-out or expiry |
| Editorial byline and provenance note | `public.editorial_entries` | Attribution of published learning content | Kept after operator deletion; account IDs are nulled |
| Request counts per address | Web process memory | Rate limiting | At most 15 minutes; never written to disk |

The app stores no search terms, analytics, advertising identifiers, or tracking cookies. Hosting providers may keep request logs; record their retention when a host is chosen.

## User rights in the product

- **Access and portability:** account settings export saved citations as JSON.
- **Rectification:** users edit notes and folders. There is no self-service email change yet; the owner can change an address in Supabase Auth on request.
- **Erasure:** account settings permanently delete the Auth account, profile, and saved citations after a password check. Backups age out on the provider's schedule; a deleted account is never restored from a backup into the live service. If a whole-database restore is ever needed, re-apply deletions made after the backup was taken.

## Processors

| Processor | Data | Status |
| --- | --- | --- |
| Supabase (database and Auth) | All account data above | Chosen for the stack; **hosting**: select region, plan, backups, and accept its data processing terms |
| Web host | Request logs | Not chosen |
| Email delivery (SMTP) | Email address, recovery messages | Not chosen; Supabase's built-in sender is for testing only |

## Legal position — review

- **Pakistan.** The Prevention of Electronic Crimes Act, 2016 governs unauthorised access and data misuse. A comprehensive personal data protection law has been proposed in draft form; its status at launch is not confirmed in this repository. **Review** the current law before launch and update this section.
- **EU/UK GDPR** applies only if the site targets or monitors people there. The site does not target them, uses no tracking, and minimises data, so it is probably out of scope. Note this as an assumption, not a conclusion.
- **Children.** The audience is university law students. Do not knowingly accept accounts from children; **review** whether a minimum-age statement is needed in the terms.
- **Cookies.** No cookie banner is needed while the site uses only essential session storage and no analytics or advertising.
- **Source material.** Reuse of judgments and Gazette legislation relies on the [Copyright Ordinance, 1962, section 57(1)(q)](https://pakistancode.gov.pk/pdffiles/administrator5d255d1f44b50b65d6a3e87a2e0d3fee.pdf), subject to prohibitions by the issuing authority; see the [source register](product/source-register.md). Learning content must be original or licensed.
- **Open-source licences.** See the [licence inventory](THIRD_PARTY_LICENSES.md). The `@img/sharp-libvips-*` packages (LGPL-3.0) are optional, dynamically loaded image binaries used by Next.js; LGPL permits this use without releasing project source. The MPL-2.0 `axe-core` packages are development-only test tools and are not shipped.

The `/privacy` and `/about` text was written from this inventory. Have both reviewed before public launch, and update their "last updated" dates whenever the data collected changes.
