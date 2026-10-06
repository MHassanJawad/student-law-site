-- Source-linked metadata fixture from the FCCP listing, checked 2026-09-27; no judgment text is copied.
insert into public.source_registry (id, code, owner, root_url, jurisdiction, material_kind, access_status, attribution, reviewed_at, last_checked_at)
values ('11111111-1111-4111-8111-111111111111', 'FCCP_SAMPLE', 'Federal Constitutional Court of Pakistan', 'https://www.fccp.gov.pk/judgements', 'Federal', 'judgment', 'fixture_only', 'Federal Constitutional Court of Pakistan', now(), now())
on conflict (code) do nothing;

insert into public.legal_documents (id, source_id, source_item_id, canonical_url, kind, title, publication_status)
values ('22222222-2222-4222-8222-222222222222', '11111111-1111-4111-8111-111111111111', 'C.P.L.A. No.1285-K of 2023', 'https://www.fccp.gov.pk/judgements', 'judgment', 'C.P.L.A. No.1285-K of 2023', 'staged')
on conflict (id) do nothing;

insert into public.document_versions (id, document_id, content_hash, checked_at, raw_metadata, text_kind, parser_version, review_status)
values ('33333333-3333-4333-8333-333333333333', '22222222-2222-4222-8222-222222222222', encode(digest('FCCP listing:C.P.L.A. No.1285-K of 2023:2026-09-25', 'sha256'), 'hex'), now(), '{"source_type":"Judgement","source_upload_date":"2026-09-25","fixture":"listing_metadata_only"}'::jsonb, 'none', 'manual-fixture-v1', 'approved')
on conflict (id) do nothing;

insert into public.judgment_metadata (document_id, case_number, author_judge)
values ('22222222-2222-4222-8222-222222222222', 'C.P.L.A. No.1285-K of 2023', 'Mr. Justice Muhammad Karim Khan Agha')
on conflict (document_id) do nothing;

update public.legal_documents set current_version_id = '33333333-3333-4333-8333-333333333333', publication_status = 'published'
where id = '22222222-2222-4222-8222-222222222222';
