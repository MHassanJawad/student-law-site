-- Record which official PDF a version's text came from, so the site can show the original page layout.
-- FCCP serves each PDF at a permanent address named by its SHA-256; older listing links were expiring tokens.
alter table public.document_versions
  add column source_pdf_sha256 text check (source_pdf_sha256 is null or source_pdf_sha256 ~ '^[0-9a-f]{64}$');

-- Backfill from the private inspections that produced each published text (only present on the review database).
update public.document_versions v
  set source_pdf_sha256 = i.pdf_sha256
  from (
    select distinct on (document_id) document_id, pdf_sha256
    from public.pdf_inspections
    where quality = 'extractable'
    order by document_id, checked_at desc
  ) i, public.legal_documents d
  where d.id = i.document_id and v.id = d.current_version_id and v.text_kind = 'extracted';
