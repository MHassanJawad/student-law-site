-- Record complete listing evidence and support reviewed withdrawal.
alter table public.ingestion_runs
  add column pages_fetched integer not null default 0 check (pages_fetched >= 0),
  add column snapshot_complete boolean not null default false,
  add column missing_count integer not null default 0 check (missing_count >= 0);

alter table public.ingestion_candidates add column quarantined_at timestamptz;

create or replace function public.withdraw_fccp_candidate(p_candidate_id uuid, p_review_note text)
returns uuid
language plpgsql security definer set search_path = public
as $$
declare
  candidate public.ingestion_candidates%rowtype;
  v_document_id uuid;
begin
  if length(trim(coalesce(p_review_note, ''))) < 10 then
    raise exception 'A review note of at least 10 characters is required';
  end if;
  select * into candidate from public.ingestion_candidates where id = p_candidate_id for update;
  if not found then raise exception 'Candidate not found'; end if;
  if not exists (select 1 from public.source_registry where id = candidate.source_id and code = 'FCCP_OFFICIAL') then
    raise exception 'Candidate is not from FCCP';
  end if;
  if candidate.review_status not in ('approved', 'quarantined') then
    raise exception 'Only approved or quarantined candidates may be withdrawn';
  end if;
  update public.legal_documents
    set publication_status = 'withdrawn', updated_at = now()
    where source_id = candidate.source_id and source_item_id = candidate.identity_hash
    returning id into v_document_id;
  if v_document_id is null then raise exception 'Published document not found'; end if;
  update public.ingestion_candidates
    set review_status = 'rejected', review_note = p_review_note, reviewed_at = now(), proposed_metadata = null
    where id = p_candidate_id;
  return v_document_id;
end;
$$;

revoke all on function public.withdraw_fccp_candidate(uuid, text) from public;
grant execute on function public.withdraw_fccp_candidate(uuid, text) to service_role;
