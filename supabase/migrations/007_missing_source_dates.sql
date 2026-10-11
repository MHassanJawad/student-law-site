-- A blank source upload date is unknown metadata, not a malformed judgment.
alter table public.ingestion_candidates alter column upload_date drop not null;
alter table public.ingestion_runs
  add column missing_upload_date_count integer not null default 0 check (missing_upload_date_count >= 0);
