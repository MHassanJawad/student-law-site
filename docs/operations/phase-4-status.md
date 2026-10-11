# Phase 4 search and document experience

Date: 2026-10-11. The anonymous research interface now has Case Law, Courtwise, Citation, Advanced, and Statutes modes, bounded filters, sorting, pagination, and clear empty/error states. Document detail shows source ownership, checked date, version reference, available metadata, public text status, and navigation for approved sections. A local-only Pakistan Code Contract Act metadata sample enables the legislation journey without asserting current legal effect.

The local database at implementation time has two published judgment records (one original seed, one reviewed FCCP pilot item) and one published legislation metadata sample. The FCCP full listing has 110 private candidate records; they are not search results until reviewed and published. The sample law is marked `LOCAL SAMPLE`. No verified reporter citation, public extracted PDF text, or approved section body exists yet.

The new SQL function enforces published document, approved current version, and visible source gates before filtering. The public API validates query mode, dates, citation parts, pagination, year, jurisdiction, and status. Search terms are not saved in an analytics table. The legacy judgment endpoint remains available for the existing saved-citation journey.

Local API checks returned one FCCP match for `1275`, one author match for `Najafi`, one Contract Act result for Federal / Act / 1872 / unknown, and zero reporter-citation matches. Supabase migration lint reported no schema errors. In 15 sequential local requests per endpoint, observed p95 was 383 ms for the judgment search and 69 ms for the document detail. This small local measurement is below the two-second pilot target; it does not predict hosted performance with a larger corpus.

The functional Phase 4 gate is met for the available pilot corpus: representative judgment and legislation metadata queries, filters, source links, and version references can be exercised locally. Citation's zero-result state is expected until a verified reporter citation is entered in the corpus. Full legislation coverage, current-law status verification, textual excerpts, and section navigation with content depend on later source review and publication. Manual visual and keyboard review on desktop and mobile remains open because the browser connection failed while the C: drive was full. The user's local frontend click path is documented for that review.

Setup and browser click path: [local setup](../SETUP.md). Search rules and limits: [search semantics](../product/search-semantics.md).
