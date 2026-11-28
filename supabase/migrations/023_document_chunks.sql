-- Citable passages of each judgment's extracted text, for the AI research assistant.
-- Built by the worker (build:chunks) and copied to the hosted database by sync:corpus.
create table public.document_chunks (
  version_id uuid not null references public.document_versions(id) on delete cascade,
  chunker_version text not null,
  ordinal integer not null check (ordinal >= 0),
  document_id uuid not null references public.legal_documents(id) on delete cascade,
  body text not null check (length(body) between 1 and 4000),
  char_start integer not null,
  char_end integer not null,
  paragraph_label text,
  search_vector tsvector generated always as (to_tsvector('english', body)) stored,
  primary key (version_id, chunker_version, ordinal),
  check (char_end > char_start)
);

create index document_chunks_search_idx on public.document_chunks using gin (search_vector);
create index document_chunks_document_idx on public.document_chunks (document_id);

alter table public.document_chunks enable row level security;
create policy chunk_read on public.document_chunks for select to anon, authenticated using (
  exists (
    select 1 from public.document_versions v
    join public.legal_documents d on d.id = v.document_id
    where v.id = document_chunks.version_id and v.review_status = 'approved'
      and d.current_version_id = v.id and d.publication_status = 'published'
  )
);
