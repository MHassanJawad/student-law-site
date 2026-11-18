-- FCCP download links are expiring tokens, so public records link to the court's own search for the case title.
-- The site moved to https://fccp.gov.pk and its /judgements page reads ?q= from the address.
create or replace function public.fccp_search_url(p_title text)
returns text language sql immutable set search_path = public
as $$
  select 'https://fccp.gov.pk/judgements?q=' || replace(replace(replace(replace(replace(trim(p_title),
    '%', '%25'), '&', '%26'), '#', '%23'), '+', '%2B'), ' ', '%20')
$$;

create or replace function public.approve_fccp_candidate(p_candidate_id uuid, p_review_note text)
returns uuid
language plpgsql security definer set search_path = public
as $$
declare
  candidate public.ingestion_candidates%rowtype;
  source_status text;
  source_code text;
  v_document_id uuid;
  v_version_id uuid;
begin
  if length(trim(coalesce(p_review_note, ''))) < 10 then
    raise exception 'A review note of at least 10 characters is required';
  end if;
  select * into candidate from public.ingestion_candidates where id = p_candidate_id for update;
  if not found then raise exception 'Candidate not found'; end if;
  if candidate.review_status <> 'pending' or candidate.source_type <> 'Judgement' then
    raise exception 'Only pending judgments may be approved';
  end if;
  select access_status, code into source_status, source_code from public.source_registry where id = candidate.source_id;
  if source_code <> 'FCCP_OFFICIAL' or source_status <> 'approved' then
    raise exception 'FCCP source access review is not approved';
  end if;

  insert into public.legal_documents
    (source_id, source_item_id, canonical_url, kind, title, publication_status)
  values
    (candidate.source_id, candidate.identity_hash, public.fccp_search_url(candidate.title), 'judgment', candidate.title, 'staged')
  on conflict (source_id, source_item_id) do update
    set canonical_url = excluded.canonical_url, title = excluded.title, updated_at = now()
  returning id into v_document_id;

  insert into public.document_versions
    (document_id, content_hash, checked_at, raw_metadata, text_kind, parser_version, review_status)
  values
    (v_document_id, candidate.metadata_hash, now(),
     jsonb_build_object('listing_url', candidate.listing_url, 'download_url', candidate.download_url,
       'source_upload_date', candidate.upload_date, 'source_type', candidate.source_type,
       'scope', 'listing_metadata_only'),
     'none', 'fccp-listing-v1', 'approved')
  on conflict (document_id, content_hash) do update set checked_at = excluded.checked_at
  returning id into v_version_id;

  insert into public.judgment_metadata (document_id, issuing_court, case_number, author_judge)
  values (v_document_id, 'FCCP', candidate.title, candidate.author_judge)
  on conflict (document_id) do update
    set case_number = excluded.case_number, author_judge = excluded.author_judge;

  update public.legal_documents
    set current_version_id = v_version_id, publication_status = 'published', updated_at = now()
    where id = v_document_id;
  update public.ingestion_candidates
    set review_status = 'approved', review_note = p_review_note, reviewed_at = now()
    where id = p_candidate_id;
  return v_document_id;
end;
$$;

update public.legal_documents d
  set canonical_url = public.fccp_search_url(d.title), updated_at = now()
  from public.source_registry s
  where s.id = d.source_id and s.code = 'FCCP_OFFICIAL' and d.kind = 'judgment';
