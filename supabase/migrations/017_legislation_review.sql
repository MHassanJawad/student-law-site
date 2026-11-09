-- Private review queue for Pakistan Code federal law listing metadata, with atomic reviewed publication.
create table public.legislation_candidates (
  id uuid primary key default gen_random_uuid(),
  source_id uuid not null references public.source_registry(id),
  identity_hash text not null check (length(identity_hash) = 64),
  metadata_hash text not null check (length(metadata_hash) = 64),
  listing_url text not null,
  detail_url text not null,
  title text not null,
  category text,
  official_number text,
  promulgation_date date,
  enactment_year integer check (enactment_year between 1800 and 2200),
  instrument_type text,
  source_review_flag text,
  review_status text not null default 'pending' check (review_status in ('pending', 'approved', 'rejected', 'quarantined')),
  review_note text,
  proposed_metadata jsonb,
  reviewed_at timestamptz,
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  unique (source_id, identity_hash)
);

create index legislation_candidates_review_idx on public.legislation_candidates (review_status, first_seen_at);
alter table public.legislation_candidates enable row level security;
-- No anon or authenticated policies: the queue is visible only to the private worker.

create or replace function public.approve_legislation_candidate(p_candidate_id uuid, p_review_note text)
returns uuid
language plpgsql security definer set search_path = public
as $$
declare
  candidate public.legislation_candidates%rowtype;
  source_status text;
  source_code text;
  v_document_id uuid;
  v_version_id uuid;
begin
  if length(trim(coalesce(p_review_note, ''))) < 10 then
    raise exception 'A review note of at least 10 characters is required';
  end if;
  select * into candidate from public.legislation_candidates where id = p_candidate_id for update;
  if not found then raise exception 'Candidate not found'; end if;
  if candidate.review_status <> 'pending' then raise exception 'Only pending candidates may be approved'; end if;
  select access_status, code into source_status, source_code from public.source_registry where id = candidate.source_id;
  if source_code <> 'PAKISTAN_CODE_OFFICIAL' or source_status <> 'approved' then
    raise exception 'Pakistan Code source access review is not approved';
  end if;

  insert into public.legal_documents
    (source_id, source_item_id, canonical_url, kind, title, publication_status)
  values
    (candidate.source_id, candidate.identity_hash, candidate.detail_url, 'legislation', candidate.title, 'staged')
  on conflict (source_id, source_item_id) do update
    set canonical_url = excluded.canonical_url, title = excluded.title, updated_at = now()
  returning id into v_document_id;

  insert into public.document_versions
    (document_id, content_hash, checked_at, raw_metadata, text_kind, parser_version, review_status)
  values
    (v_document_id, candidate.metadata_hash, now(),
     jsonb_build_object('listing_url', candidate.listing_url, 'detail_url', candidate.detail_url,
       'category', candidate.category, 'official_number', candidate.official_number,
       'promulgation_date', candidate.promulgation_date, 'source_review_flag', candidate.source_review_flag,
       'source_note', 'Pakistan Code states all laws are under review; consult the relevant Gazette notification for legal certainty',
       'scope', 'listing_metadata_only'),
     'none', 'pakistan-code-listing-v1', 'approved')
  on conflict (document_id, content_hash) do update set checked_at = excluded.checked_at
  returning id into v_version_id;

  -- Legal status stays unknown: the source itself says its laws are under review.
  insert into public.legislation_metadata (document_id, jurisdiction, instrument_type, enactment_year, legal_status, official_citation)
  values (v_document_id, 'Federal', candidate.instrument_type, candidate.enactment_year, 'unknown', candidate.official_number)
  on conflict (document_id) do update
    set instrument_type = excluded.instrument_type, enactment_year = excluded.enactment_year,
        official_citation = excluded.official_citation;

  update public.legal_documents
    set current_version_id = v_version_id, publication_status = 'published', updated_at = now()
    where id = v_document_id;
  update public.legislation_candidates
    set review_status = 'approved', review_note = p_review_note, reviewed_at = now()
    where id = p_candidate_id;
  return v_document_id;
end;
$$;

-- Supabase default privileges grant anon and authenticated directly, so revoking from public alone is not enough.
revoke all on function public.approve_legislation_candidate(uuid, text) from public, anon, authenticated;
grant execute on function public.approve_legislation_candidate(uuid, text) to service_role;
