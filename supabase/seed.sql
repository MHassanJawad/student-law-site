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

-- Local metadata-only legislation sample from the Ministry of Law and Justice Pakistan Code.
-- The portal says its text is under review; no current-law status or copied text is asserted.
insert into public.source_registry (id, code, owner, root_url, jurisdiction, material_kind, access_status, attribution, reviewed_at, last_checked_at)
values ('44444444-4444-4444-8444-444444444444', 'PAKISTAN_CODE_SAMPLE', 'Ministry of Law and Justice, Pakistan', 'https://www.pakistancode.gov.pk/', 'Federal', 'legislation', 'fixture_only', 'Pakistan Code, Ministry of Law and Justice', now(), now())
on conflict (code) do nothing;

insert into public.legal_documents (id, source_id, source_item_id, canonical_url, kind, title, publication_status)
values ('55555555-5555-4555-8555-555555555555', '44444444-4444-4444-8444-444444444444', 'contract-act-1872-sample', 'https://www.pakistancode.gov.pk/english/UY2FqaJw2-apaUY2Fqa-a50%3D-sg-jjjjjjjjjjjjj-con-51', 'legislation', 'Contract Act, 1872', 'staged')
on conflict (id) do nothing;

insert into public.document_versions (id, document_id, content_hash, checked_at, raw_metadata, text_kind, parser_version, review_status)
values ('66666666-6666-4666-8666-666666666666', '55555555-5555-4555-8555-555555555555', encode(digest('Pakistan Code:Contract Act, 1872:metadata-only-local-sample', 'sha256'), 'hex'), now(), '{"fixture":"official_title_metadata_only","source_note":"Pakistan Code text under review; consult the relevant Gazette notification for legal certainty"}'::jsonb, 'none', 'manual-legislation-fixture-v1', 'approved')
on conflict (id) do nothing;

insert into public.legislation_metadata (document_id, jurisdiction, instrument_type, enactment_year, legal_status)
values ('55555555-5555-4555-8555-555555555555', 'Federal', 'Act', 1872, 'unknown')
on conflict (document_id) do nothing;

update public.legal_documents set current_version_id = '66666666-6666-4666-8666-666666666666', publication_status = 'published'
where id = '55555555-5555-4555-8555-555555555555';
