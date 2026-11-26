-- Search the words inside judgments, not only their titles.
-- Each version indexes its reviewed summary (weight B) and its extracted text (weight C); titles stay weight A,
-- so a title match still outranks a passing mention in the body.
alter table public.document_versions
  add column search_vector tsvector generated always as (
    setweight(to_tsvector('english', coalesce(summary, '')), 'B')
    -- tsvector values are capped at 1 MB; the first 300,000 characters cover any judgment published so far.
    || setweight(to_tsvector('english', left(coalesce(extracted_text, ''), 300000)), 'C')
  ) stored;

create index document_versions_search_idx on public.document_versions using gin (search_vector);

-- Same contract as migration 020. Changes: matches title, summary, and full text; web-style query syntax
-- ("exact phrase", or, -exclude); relevance weighs where the words were found and damps very long texts.
create or replace function public.search_research(
  p_mode text default 'case-law', p_query text default '', p_author text default '',
  p_from date default null, p_to date default null, p_jurisdiction text default '',
  p_year integer default null, p_instrument_type text default '', p_legal_status text default '',
  p_sort text default 'relevance', p_limit integer default 20, p_offset integer default 0
)
returns jsonb language sql stable security invoker set search_path = public
as $$
  with q as (
    select websearch_to_tsquery('english', coalesce(p_query, '')) as tsq
  ), filtered as materialized (
    select d.id, d.kind, d.title, d.canonical_url as source_url, v.checked_at,
      s.code as source_code, s.owner as source_name, v.id as version_id,
      case when v.extracted_text is null then null
        else left(regexp_replace(v.extracted_text, '\s+', ' ', 'g'), 260) end as excerpt,
      v.summary, v.summary_model,
      j.issuing_court, j.case_number, j.decision_date, j.author_judge,
      j.raw_citation, l.jurisdiction, l.instrument_type, l.enactment_year,
      l.legal_status, l.official_citation,
      case when trim(p_query) = '' then 0::real
        else ts_rank(setweight(d.search_vector, 'A') || coalesce(v.search_vector, ''::tsvector), q.tsq, 1)
          -- A query that is a case number or title fragment should still lead the list.
          + case when position(lower(trim(p_query)) in lower(d.title)) > 0 then 1 else 0 end end as rank
    from public.legal_documents d
    cross join q
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
        or (p_mode <> 'citation' and (d.search_vector @@ q.tsq
          or v.search_vector @@ q.tsq
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
