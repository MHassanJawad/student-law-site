-- RLS checks operator membership; the trigger only stamps review metadata.
create or replace function public.prepare_editorial_entry()
returns trigger language plpgsql security definer set search_path = public
as $$
begin
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
