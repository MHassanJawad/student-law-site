-- Source-traceable FCCP pilot and owner-scoped saved citations.
create extension if not exists pg_trgm;
create extension if not exists pgcrypto;

create table public.source_registry (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  owner text not null,
  root_url text not null,
  jurisdiction text not null,
  material_kind text not null,
  access_status text not null default 'disabled' check (access_status in ('disabled', 'fixture_only', 'approved')),
  attribution text,
  reviewed_at timestamptz,
  last_checked_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.legal_documents (
  id uuid primary key default gen_random_uuid(),
  source_id uuid not null references public.source_registry(id),
  source_item_id text,
  canonical_url text not null,
  kind text not null check (kind in ('judgment', 'legislation')),
  title text not null,
  language text not null default 'en',
  publication_status text not null default 'staged' check (publication_status in ('staged', 'published', 'quarantined', 'withdrawn')),
  current_version_id uuid,
  search_vector tsvector generated always as (to_tsvector('english', coalesce(title, ''))) stored,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (source_id, source_item_id),
  unique (source_id, canonical_url)
);

create table public.document_versions (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.legal_documents(id) on delete cascade,
  content_hash text not null check (length(content_hash) = 64),
  checked_at timestamptz not null,
  raw_metadata jsonb not null default '{}'::jsonb,
  extracted_text text,
  text_kind text not null check (text_kind in ('source', 'extracted', 'ocr', 'none')),
  parser_version text not null,
  review_status text not null check (review_status in ('staged', 'approved', 'quarantined')),
  created_at timestamptz not null default now(),
  unique (document_id, content_hash)
);

alter table public.document_versions add constraint document_versions_document_id_id_unique unique (document_id, id);
alter table public.legal_documents add constraint legal_documents_current_version_fk
  foreign key (id, current_version_id) references public.document_versions(document_id, id);

create table public.judgment_metadata (
  document_id uuid primary key references public.legal_documents(id) on delete cascade,
  issuing_court text not null default 'FCCP' check (issuing_court = 'FCCP'),
  case_number text,
  decision_date date,
  author_judge text,
  bench text,
  raw_citation text,
  normalized_citation text
);

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  role text not null default 'student' check (role in ('student', 'operator')),
  created_at timestamptz not null default now()
);

create table public.saved_citations (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  document_id uuid not null references public.legal_documents(id),
  citation_snapshot text not null,
  note text,
  folder text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (owner_id, document_id)
);

create index legal_documents_search_idx on public.legal_documents using gin (search_vector);
create index legal_documents_status_kind_idx on public.legal_documents (publication_status, kind);
create index judgment_metadata_citation_idx on public.judgment_metadata using gin (normalized_citation gin_trgm_ops);
create index saved_citations_owner_created_idx on public.saved_citations (owner_id, created_at desc);

alter table public.source_registry enable row level security;
alter table public.legal_documents enable row level security;
alter table public.document_versions enable row level security;
alter table public.judgment_metadata enable row level security;
alter table public.profiles enable row level security;
alter table public.saved_citations enable row level security;

create policy source_read on public.source_registry for select to anon, authenticated using (access_status in ('fixture_only', 'approved'));
create policy document_read on public.legal_documents for select to anon, authenticated using (publication_status = 'published');
create policy version_read on public.document_versions for select to anon, authenticated using (
  review_status = 'approved' and exists (
    select 1 from public.legal_documents d where d.id = document_id and d.current_version_id = document_versions.id and d.publication_status = 'published'
  )
);
create policy judgment_read on public.judgment_metadata for select to anon, authenticated using (
  exists (select 1 from public.legal_documents d where d.id = document_id and d.publication_status = 'published')
);
create policy profile_own_read on public.profiles for select to authenticated using (id = auth.uid());
create policy saved_own_read on public.saved_citations for select to authenticated using (owner_id = auth.uid());
create policy saved_own_insert on public.saved_citations for insert to authenticated with check (
  owner_id = auth.uid() and exists (select 1 from public.legal_documents d where d.id = document_id and d.publication_status = 'published')
);
create policy saved_own_update on public.saved_citations for update to authenticated using (owner_id = auth.uid()) with check (
  owner_id = auth.uid() and exists (select 1 from public.legal_documents d where d.id = document_id and d.publication_status = 'published')
);
create policy saved_own_delete on public.saved_citations for delete to authenticated using (owner_id = auth.uid());

create or replace function public.search_judgments(p_query text, p_limit integer default 20, p_offset integer default 0)
returns table (id uuid, title text, case_number text, citation text, decision_date date, source_url text, checked_at timestamptz, total_count bigint)
language sql stable security invoker set search_path = public
as $$
  select d.id, d.title, j.case_number, j.raw_citation, j.decision_date, d.canonical_url, v.checked_at,
         count(*) over() as total_count
  from public.legal_documents d
  join public.judgment_metadata j on j.document_id = d.id
  join public.document_versions v on v.id = d.current_version_id
  where d.kind = 'judgment' and d.publication_status = 'published'
    and (d.search_vector @@ plainto_tsquery('english', p_query)
      or position(lower(p_query) in lower(coalesce(j.case_number, ''))) > 0
      or position(lower(p_query) in lower(coalesce(j.raw_citation, ''))) > 0)
  order by ts_rank(d.search_vector, plainto_tsquery('english', p_query)) desc,
           j.decision_date desc nulls last, d.id
  limit least(greatest(p_limit, 1), 100) offset greatest(p_offset, 0);
$$;

revoke all on function public.search_judgments(text, integer, integer) from public;
grant execute on function public.search_judgments(text, integer, integer) to anon, authenticated;

create or replace function public.create_profile_for_user()
returns trigger language plpgsql security definer set search_path = public
as $$
begin
  insert into public.profiles (id) values (new.id);
  return new;
end;
$$;

create trigger auth_user_profile_created after insert on auth.users
for each row execute function public.create_profile_for_user();
