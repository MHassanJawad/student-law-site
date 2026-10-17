-- Account FK cleanup is not an editorial edit and must not create an audit row.
drop trigger editorial_prepare on public.editorial_entries;
create trigger editorial_prepare before insert or update of
  kind, slug, title, summary, body, author, source_url, provenance_note, topic, status
on public.editorial_entries for each row execute function public.prepare_editorial_entry();

drop trigger editorial_audit_write on public.editorial_entries;
create trigger editorial_audit_write after insert or update of
  kind, slug, title, summary, body, author, source_url, provenance_note, topic, status
on public.editorial_entries for each row execute function public.audit_editorial_entry();
