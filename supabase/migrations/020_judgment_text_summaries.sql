-- Judgment text and reviewed AI summaries.
-- Extracted text is published on the approved version. Generated summaries stay in a private
-- drafts table until an operator approves one; only then is it copied onto the public version.
alter table public.document_versions
  add column summary text check (summary is null or length(summary) between 40 and 2000),
  add column summary_model text check (summary_model is null or length(summary_model) <= 200),
  add column summary_reviewed_at timestamptz,
  add constraint document_versions_summary_complete
    check ((summary is null) = (summary_model is null) and (summary is null) = (summary_reviewed_at is null));

create table public.summary_drafts (
  id uuid primary key default gen_random_uuid(),
  version_id uuid not null references public.document_versions(id) on delete cascade,
  model text not null check (length(model) between 1 and 200),
  prompt_version text not null,
  input_chars integer not null check (input_chars > 0),
  summary text not null check (length(summary) between 40 and 2000),
  review_status text not null default 'pending' check (review_status in ('pending', 'approved', 'rejected')),
  review_note text,
  created_at timestamptz not null default now(),
  reviewed_at timestamptz
);
create index summary_drafts_review_idx on public.summary_drafts (review_status, created_at);
create unique index summary_drafts_one_open_per_version on public.summary_drafts (version_id)
  where review_status in ('pending', 'approved');
alter table public.summary_drafts enable row level security;
-- No policies: drafts are private to the worker until approved.

-- Search results carry the approved summary so it can be shown under each result.
create or replace function public.search_research(
  p_mode text default 'case-law', p_query text default '', p_author text default '',
  p_from date default null, p_to date default null, p_jurisdiction text default '',
  p_year integer default null, p_instrument_type text default '', p_legal_status text default '',
  p_sort text default 'relevance', p_limit integer default 20, p_offset integer default 0
)
returns jsonb language sql stable security invoker set search_path = public
as $$
  with filtered as materialized (
    select d.id, d.kind, d.title, d.canonical_url as source_url, v.checked_at,
      s.code as source_code, s.owner as source_name, v.id as version_id,
      case when v.extracted_text is null then null
        else left(regexp_replace(v.extracted_text, '\s+', ' ', 'g'), 260) end as excerpt,
      v.summary, v.summary_model,
      j.issuing_court, j.case_number, j.decision_date, j.author_judge,
      j.raw_citation, l.jurisdiction, l.instrument_type, l.enactment_year,
      l.legal_status, l.official_citation,
      case when trim(p_query) = '' then 0::real
        else ts_rank(d.search_vector, plainto_tsquery('english', p_query)) end as rank
    from public.legal_documents d
    join public.document_versions v on v.id = d.current_version_id and v.review_status = 'approved'
    join public.source_registry s on s.id = d.source_id and s.access_status in ('approved', 'fixture_only')
    left join public.judgment_metadata j on j.document_id = d.id
    left join public.legislation_metadata l on l.document_id = d.id
    where d.publication_status = 'published'
      and ((p_mode = 'statutes' and d.kind = 'legislation' and l.document_id is not null)
        or (p_mode in ('case-law', 'courtwise', 'citation', 'advanced') and d.kind = 'judgment' and j.document_id is not null))
      and (p_mode <> 'citation' or j.raw_citation is not null)
      and (trim(p_query) = '' or
        (p_mode = 'citation' and (
          position(regexp_replace(lower(trim(p_query)), '[^a-z0-9]', '', 'g')
            in regexp_replace(lower(coalesce(j.raw_citation, '')), '[^a-z0-9]', '', 'g')) > 0
          or position(regexp_replace(lower(trim(p_query)), '[^a-z0-9]', '', 'g')
            in regexp_replace(lower(coalesce(j.normalized_citation, '')), '[^a-z0-9]', '', 'g')) > 0))
        or (p_mode <> 'citation' and (d.search_vector @@ plainto_tsquery('english', p_query)
          or position(lower(trim(p_query)) in lower(d.title)) > 0
          or position(lower(trim(p_query)) in lower(coalesce(j.case_number, ''))) > 0
          or position(lower(trim(p_query)) in lower(coalesce(l.official_citation, ''))) > 0)))
      and (trim(p_author) = '' or position(lower(trim(p_author)) in lower(coalesce(j.author_judge, ''))) > 0)
      and (p_from is null or j.decision_date >= p_from)
      and (p_to is null or j.decision_date <= p_to)
      and (trim(p_jurisdiction) = '' or l.jurisdiction = p_jurisdiction)
      and (p_year is null or l.enactment_year = p_year)
      and (trim(p_instrument_type) = '' or lower(l.instrument_type) = lower(trim(p_instrument_type)))
      and (trim(p_legal_status) = '' or l.legal_status = p_legal_status)
  ), numbered as (
    select *, row_number() over (order by
      case when p_sort = 'relevance' then rank end desc nulls last,
      case when p_sort = 'decision-newest' then decision_date end desc nulls last,
      case when p_sort = 'decision-oldest' then decision_date end asc nulls last,
      case when p_sort = 'title' then title end asc,
      checked_at desc, id) as row_number
    from filtered
  )
  select jsonb_build_object(
    'total', (select count(*) from filtered),
    'items', coalesce((select jsonb_agg(to_jsonb(page) - 'row_number' - 'rank' order by page.row_number)
      from (select * from numbered order by row_number
        limit least(greatest(p_limit, 1), 100) offset greatest(p_offset, 0)) page), '[]'::jsonb)
  );
$$;

