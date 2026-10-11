-- Search published, approved documents across the research collections.
create table public.legislation_metadata (
  document_id uuid primary key references public.legal_documents(id) on delete cascade,
  jurisdiction text not null,
  instrument_type text,
  enactment_year integer check (enactment_year between 1800 and 2200),
  legal_status text not null default 'unknown' check (legal_status in ('in_force', 'repealed', 'partly_in_force', 'unknown')),
  official_citation text
);

alter table public.legislation_metadata enable row level security;
create policy legislation_read on public.legislation_metadata for select to anon, authenticated using (
  exists (select 1 from public.legal_documents d
    where d.id = document_id and d.publication_status = 'published' and d.kind = 'legislation')
);

create index legislation_jurisdiction_year_idx on public.legislation_metadata (jurisdiction, enactment_year);
create index judgment_author_idx on public.judgment_metadata using gin (author_judge gin_trgm_ops);

create table public.document_sections (
  id uuid primary key default gen_random_uuid(),
  version_id uuid not null references public.document_versions(id) on delete cascade,
  section_key text not null check (section_key ~ '^[a-z0-9-]{1,80}$'),
  heading text not null,
  body text not null,
  display_order integer not null check (display_order >= 0),
  review_status text not null default 'staged' check (review_status in ('staged', 'approved')),
  unique (version_id, section_key), unique (version_id, display_order)
);
create index document_sections_version_order_idx on public.document_sections (version_id, display_order);
alter table public.document_sections enable row level security;
create policy section_read on public.document_sections for select to anon, authenticated using (
  review_status = 'approved' and exists (select 1 from public.legal_documents d
    join public.document_versions v on v.id = d.current_version_id
    where v.id = version_id and d.publication_status = 'published' and v.review_status = 'approved')
);

create or replace function public.search_research(
  p_mode text default 'case-law', p_query text default '', p_author text default '',
  p_from date default null, p_to date default null, p_jurisdiction text default '',
  p_year integer default null, p_sort text default 'relevance',
  p_limit integer default 20, p_offset integer default 0
)
returns jsonb language sql stable security invoker set search_path = public
as $$
  with filtered as materialized (
    select d.id, d.kind, d.title, d.canonical_url as source_url, v.checked_at,
      s.code as source_code, s.owner as source_name,
      v.id as version_id, j.issuing_court, j.case_number, j.decision_date,
      j.author_judge, j.raw_citation, l.jurisdiction, l.instrument_type,
      l.enactment_year, l.legal_status, l.official_citation,
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
        (p_mode = 'citation' and (position(lower(trim(p_query)) in lower(coalesce(j.raw_citation, ''))) > 0
          or position(lower(trim(p_query)) in lower(coalesce(j.normalized_citation, ''))) > 0))
        or (p_mode <> 'citation' and (d.search_vector @@ plainto_tsquery('english', p_query)
          or position(lower(trim(p_query)) in lower(d.title)) > 0
          or position(lower(trim(p_query)) in lower(coalesce(j.case_number, ''))) > 0
          or position(lower(trim(p_query)) in lower(coalesce(l.official_citation, ''))) > 0)))
      and (trim(p_author) = '' or position(lower(trim(p_author)) in lower(coalesce(j.author_judge, ''))) > 0)
      and (p_from is null or j.decision_date >= p_from)
      and (p_to is null or j.decision_date <= p_to)
      and (trim(p_jurisdiction) = '' or l.jurisdiction = p_jurisdiction)
      and (p_year is null or l.enactment_year = p_year)
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

revoke all on function public.search_research(text,text,text,date,date,text,integer,text,integer,integer) from public;
grant execute on function public.search_research(text,text,text,date,date,text,integer,text,integer,integer) to anon, authenticated;
