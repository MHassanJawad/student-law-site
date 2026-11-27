-- Retrieve citable passages for the AI research assistant: judgment chunks and published editorial entries,
-- ranked together. Security invoker, so the chunk and editorial read policies decide what a caller can see.
create or replace function public.assistant_retrieve(
  p_queries text[], p_limit integer default 8, p_per_document integer default 3
)
returns jsonb language sql stable security invoker set search_path = public
as $$
  with qs as materialized (
    select q, websearch_to_tsquery('english', q) as tsq
    from (select left(btrim(raw), 200) as q from unnest(coalesce(p_queries, '{}')) with ordinality as t(raw, n)
      where btrim(coalesce(raw, '')) <> '' order by n limit 4) given
  ), chunk_hits as (
    select c.version_id, c.ordinal, max(ts_rank_cd(c.search_vector, qs.tsq, 1)) as body_rank
    from public.document_chunks c
    join qs on c.search_vector @@ qs.tsq
    where c.chunker_version = 'chunks-v1'
    group by c.version_id, c.ordinal
  ), judgment_passages as (
    select 'judgment' as source_type, d.id as document_id, null::uuid as entry_id, d.title,
      j.case_number, j.decision_date, c.paragraph_label, c.ordinal, c.body,
      '/documents/' || d.id as path, d.canonical_url as official_url,
      h.body_rank + case when exists (select 1 from qs
        where position(lower(qs.q) in lower(d.title)) > 0
          or position(lower(qs.q) in lower(coalesce(j.case_number, ''))) > 0) then 1 else 0 end as rank
    from chunk_hits h
    join public.document_chunks c on c.version_id = h.version_id and c.chunker_version = 'chunks-v1'
      and c.ordinal = h.ordinal
    join public.legal_documents d on d.id = c.document_id and d.current_version_id = c.version_id
      and d.publication_status = 'published'
    join public.document_versions v on v.id = c.version_id and v.review_status = 'approved'
    join public.source_registry s on s.id = d.source_id and s.access_status in ('approved', 'fixture_only')
    left join public.judgment_metadata j on j.document_id = d.id
  ), capped as (
    select *, row_number() over (partition by document_id order by rank desc, ordinal) as nth
    from judgment_passages
  ), editorial_passages as (
    select 'editorial' as source_type, null::uuid as document_id, e.id as entry_id, e.title,
      null::text as case_number, null::date as decision_date, null::text as paragraph_label,
      null::integer as ordinal, left(e.body, 2000) as body,
      '/learn/' || case e.kind when 'maxim' then 'maxims' when 'article' then 'articles' else 'dictionary' end
        || '/' || e.slug as path, e.source_url as official_url,
      max(ts_rank_cd(to_tsvector('english', e.title || ' ' || e.summary || ' ' || e.body), qs.tsq, 1))
        + case when bool_or(position(lower(qs.q) in lower(e.title)) > 0) then 1 else 0 end as rank
    from public.editorial_entries e
    join qs on to_tsvector('english', e.title || ' ' || e.summary || ' ' || e.body) @@ qs.tsq
    where e.status = 'published'
    group by e.id
  ), ranked as (
    select source_type, document_id, entry_id, title, case_number, decision_date, paragraph_label, ordinal,
      body, path, official_url, rank
    from capped where nth <= greatest(coalesce(p_per_document, 3), 1)
    union all
    select * from editorial_passages
  ), related as (
    -- Published documents named by a query that have no passages (scanned or metadata-only).
    select d.id as document_id, d.title, d.kind, '/documents/' || d.id as path
    from public.legal_documents d
    join public.document_versions v on v.id = d.current_version_id and v.review_status = 'approved'
    join public.source_registry s on s.id = d.source_id and s.access_status in ('approved', 'fixture_only')
    left join public.judgment_metadata j on j.document_id = d.id
    where d.publication_status = 'published'
      and exists (select 1 from qs where position(lower(qs.q) in lower(d.title)) > 0
        or position(lower(qs.q) in lower(coalesce(j.case_number, ''))) > 0)
      and not exists (select 1 from public.document_chunks c
        where c.version_id = d.current_version_id and c.chunker_version = 'chunks-v1')
    order by d.title, d.id
    limit 5
  )
  select jsonb_build_object(
    'passages', coalesce((select jsonb_agg(to_jsonb(top) order by top.rank desc, top.path, top.ordinal)
      from (select * from ranked order by rank desc, path, ordinal
        limit least(greatest(coalesce(p_limit, 8), 1), 20)) top), '[]'::jsonb),
    'related', coalesce((select jsonb_agg(to_jsonb(related) order by related.title, related.document_id)
      from related), '[]'::jsonb)
  );
$$;

revoke all on function public.assistant_retrieve(text[], integer, integer) from public;
grant execute on function public.assistant_retrieve(text[], integer, integer) to anon, authenticated;
