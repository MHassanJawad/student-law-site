-- Preserve reviewed content and audit history when an editor deletes their account.
alter table public.editorial_entries alter column editor_id drop not null;
alter table public.editorial_entries drop constraint editorial_entries_editor_id_fkey;
alter table public.editorial_entries add constraint editorial_entries_editor_id_fkey
  foreign key (editor_id) references auth.users(id) on delete set null;
alter table public.editorial_entries drop constraint editorial_entries_reviewer_id_fkey;
alter table public.editorial_entries add constraint editorial_entries_reviewer_id_fkey
  foreign key (reviewer_id) references auth.users(id) on delete set null;
alter table public.editorial_entries drop constraint editorial_entries_check;
alter table public.editorial_entries add constraint editorial_entries_check
  check (status <> 'published' or (reviewed_at is not null and published_at is not null));
alter table public.editorial_audit drop constraint editorial_audit_actor_id_fkey;
alter table public.editorial_audit add constraint editorial_audit_actor_id_fkey
  foreign key (actor_id) references auth.users(id) on delete set null;

create or replace function public.prepare_editorial_entry()
returns trigger language plpgsql security definer set search_path = public
as $$
begin
  if not public.is_content_operator() then raise exception 'Operator role required'; end if;
  if tg_op = 'INSERT' then
    new.editor_id := auth.uid();
  else
    new.editor_id := coalesce(old.editor_id, auth.uid());
    new.created_at := old.created_at;
  end if;
  new.updated_at := now();
  if new.status = 'published' then
    if tg_op = 'INSERT' or old.status <> 'published' or row(new.title, new.summary, new.body, new.author, new.source_url, new.provenance_note, new.topic)
      is distinct from row(old.title, old.summary, old.body, old.author, old.source_url, old.provenance_note, old.topic) then
      new.reviewer_id := auth.uid();
      new.reviewed_at := now();
      new.published_at := coalesce(new.published_at, now());
    else
      new.reviewer_id := old.reviewer_id;
      new.reviewed_at := old.reviewed_at;
      new.published_at := old.published_at;
    end if;
  else
    new.reviewer_id := null;
    new.reviewed_at := null;
    new.published_at := null;
  end if;
  return new;
end;
$$;
