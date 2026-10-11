-- Report published, approved-version corpus coverage without guessed totals.
create or replace function public.corpus_coverage()
returns table (source_code text, kind text, jurisdiction text, document_count bigint, last_checked_at timestamptz)
language sql stable security invoker set search_path = public
as $$
  select s.code, d.kind, s.jurisdiction, count(*)::bigint, max(v.checked_at)
  from public.legal_documents d
  join public.source_registry s on s.id = d.source_id
  join public.document_versions v on v.id = d.current_version_id
  where d.publication_status = 'published' and v.review_status = 'approved'
  group by s.code, d.kind, s.jurisdiction
  order by s.code, d.kind;
$$;

revoke all on function public.corpus_coverage() from public;
grant execute on function public.corpus_coverage() to anon, authenticated;
