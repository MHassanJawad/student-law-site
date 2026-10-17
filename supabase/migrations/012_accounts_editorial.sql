-- Phase 5: reviewed editorial content and authenticated account deletion.
create table public.editorial_entries (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('maxim', 'article', 'dictionary')),
  slug text not null check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  title text not null check (length(btrim(title)) between 2 and 180),
  summary text not null check (length(btrim(summary)) between 10 and 500),
  body text not null check (length(btrim(body)) between 20 and 20000),
  author text not null check (length(btrim(author)) between 2 and 120),
  source_url text check (source_url is null or source_url ~ '^https://'),
  provenance_note text not null check (length(btrim(provenance_note)) between 10 and 500),
  topic text,
  status text not null default 'draft' check (status in ('draft', 'published', 'archived')),
  editor_id uuid not null references auth.users(id),
  reviewer_id uuid references auth.users(id),
  reviewed_at timestamptz,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (kind, slug),
  check (status <> 'published' or (reviewer_id is not null and reviewed_at is not null and published_at is not null))
);

create index editorial_public_idx on public.editorial_entries (kind, published_at desc) where status = 'published';
create index editorial_topic_idx on public.editorial_entries (kind, topic) where status = 'published';

create table public.editorial_audit (
  id bigint generated always as identity primary key,
  entry_id uuid not null references public.editorial_entries(id) on delete cascade,
  actor_id uuid references auth.users(id),
  old_status text,
  new_status text not null,
  changed_at timestamptz not null default now()
);

create or replace function public.is_content_operator()
returns boolean language sql stable security definer set search_path = public
as $$ select exists (select 1 from public.profiles where id = auth.uid() and role = 'operator'); $$;
revoke all on function public.is_content_operator() from public;
grant execute on function public.is_content_operator() to authenticated;

create or replace function public.prepare_editorial_entry()
returns trigger language plpgsql security definer set search_path = public
as $$
begin
  if not public.is_content_operator() then raise exception 'Operator role required'; end if;
  if tg_op = 'INSERT' then
    new.editor_id := auth.uid();
  else
    new.editor_id := old.editor_id;
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

create trigger editorial_prepare before insert or update on public.editorial_entries
for each row execute function public.prepare_editorial_entry();

create or replace function public.audit_editorial_entry()
returns trigger language plpgsql security definer set search_path = public
as $$
begin
  insert into public.editorial_audit (entry_id, actor_id, old_status, new_status)
  values (new.id, auth.uid(), case when tg_op = 'UPDATE' then old.status else null end, new.status);
  return new;
end;
$$;

create trigger editorial_audit_write after insert or update on public.editorial_entries
for each row execute function public.audit_editorial_entry();

alter table public.editorial_entries enable row level security;
alter table public.editorial_audit enable row level security;

create policy editorial_public_read on public.editorial_entries for select to anon, authenticated
using (status = 'published');
create policy editorial_operator_read on public.editorial_entries for select to authenticated
using (public.is_content_operator());
create policy editorial_operator_insert on public.editorial_entries for insert to authenticated
with check (public.is_content_operator() and editor_id = auth.uid());
create policy editorial_operator_update on public.editorial_entries for update to authenticated
using (public.is_content_operator()) with check (public.is_content_operator());
create policy editorial_audit_operator_read on public.editorial_audit for select to authenticated
using (public.is_content_operator());

create or replace function public.delete_my_account()
returns void language plpgsql security definer set search_path = auth, public
as $$
declare account_id uuid := auth.uid();
begin
  if account_id is null then raise exception 'Authentication required'; end if;
  delete from auth.users where id = account_id;
  if not found then raise exception 'Account not found'; end if;
end;
$$;
revoke all on function public.delete_my_account() from public;
grant execute on function public.delete_my_account() to authenticated;
