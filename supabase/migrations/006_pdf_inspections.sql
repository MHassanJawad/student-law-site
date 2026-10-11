-- Keep sampled PDF extraction private until quality and editorial review.
create table public.pdf_inspections (
  id uuid primary key default gen_random_uuid(),
  candidate_id uuid not null references public.ingestion_candidates(id),
  document_id uuid not null references public.legal_documents(id),
  source_url text not null,
  pdf_sha256 text not null check (length(pdf_sha256) = 64),
  pdf_bytes integer not null check (pdf_bytes > 0 and pdf_bytes <= 15728640),
  page_count integer not null check (page_count between 1 and 100),
  extracted_text text check (extracted_text is null or length(extracted_text) <= 2000000),
  text_chars integer not null check (text_chars >= 0),
  quality text not null check (quality in ('extractable', 'low_text', 'scanned_or_empty')),
  parser_version text not null,
  review_status text not null default 'pending' check (review_status in ('pending', 'reviewed', 'rejected')),
  review_note text,
  checked_at timestamptz not null default now(),
  unique (candidate_id, pdf_sha256)
);

create index pdf_inspections_review_idx on public.pdf_inspections (review_status, checked_at desc);
alter table public.pdf_inspections enable row level security;
-- No public policies: the worker and human reviewers handle this private material.
