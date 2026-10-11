-- Distinguish rows shown by the portal from unique staged judgments.
alter table public.ingestion_runs
  add column duplicate_count integer not null default 0 check (duplicate_count >= 0);
