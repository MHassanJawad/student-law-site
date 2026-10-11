-- Private review queue and audit trail for bounded source adapters.
create table public.ingestion_runs (
  id uuid primary key default gen_random_uuid(),
  source_id uuid not null references public.source_registry(id),
  listing_url text not null,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  status text not null default 'running' check (status in ('running', 'completed', 'partial', 'failed')),
  http_status integer,
  listing_hash text check (listing_hash is null or length(listing_hash) = 64),
  observed_count integer not null default 0 check (observed_count >= 0),
  source_total integer check (source_total is null or source_total >= 0),
  staged_count integer not null default 0 check (staged_count >= 0),
  unchanged_count integer not null default 0 check (unchanged_count >= 0),
  quarantined_count integer not null default 0 check (quarantined_count >= 0),
  rejected_count integer not null default 0 check (rejected_count >= 0),
  error_summary jsonb not null default '[]'::jsonb
);

create table public.ingestion_candidates (
  id uuid primary key default gen_random_uuid(),
  source_id uuid not null references public.source_registry(id),
  identity_hash text not null check (length(identity_hash) = 64),
  metadata_hash text not null check (length(metadata_hash) = 64),
  listing_url text not null,
  download_url text not null,
  title text not null,
  author_judge text not null,
  source_type text not null check (source_type in ('Judgement', 'Order')),
  upload_date date not null,
  review_status text not null default 'pending' check (review_status in ('pending', 'approved', 'rejected', 'quarantined')),
  review_note text,
  proposed_metadata jsonb,
  reviewed_at timestamptz,
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  unique (source_id, identity_hash)
);

create index ingestion_runs_source_started_idx on public.ingestion_runs (source_id, started_at desc);
create index ingestion_candidates_review_idx on public.ingestion_candidates (review_status, first_seen_at);

alter table public.ingestion_runs enable row level security;
alter table public.ingestion_candidates enable row level security;
-- No anon or authenticated policies: ingestion data is visible only to the private worker.
