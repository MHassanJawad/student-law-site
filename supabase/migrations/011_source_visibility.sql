-- A disabled source must hide its documents from direct public reads as well as search.
drop policy document_read on public.legal_documents;
create policy document_read on public.legal_documents for select to anon, authenticated using (
  publication_status = 'published' and exists (
    select 1 from public.source_registry s
    where s.id = source_id and s.access_status in ('fixture_only', 'approved')
  )
);
