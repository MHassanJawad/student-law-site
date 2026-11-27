-- Durable daily quotas for the AI research assistant: one counter per user and one site-wide.
-- Days roll over at midnight Pakistan time. RLS is on with no policies: only the functions below touch the tables.
create table if not exists public.assistant_usage (
  user_id uuid not null references auth.users on delete cascade,
  day date not null,
  questions int not null default 0,
  primary key (user_id, day)
);

create table if not exists public.assistant_daily_total (
  day date primary key,
  questions int not null default 0
);

-- Server-held maxima: callers may ask for lower limits but never higher ones.
create table if not exists public.assistant_settings (
  id boolean primary key default true check (id),
  user_max int not null default 30 check (user_max > 0),
  global_max int not null default 500 check (global_max > 0)
);
insert into public.assistant_settings (id) values (true) on conflict do nothing;

-- One row per allowed question: a refund must present its token, so a user cannot refund at will. No question text.
create table if not exists public.assistant_charge (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  day date not null,
  created_at timestamptz not null default now()
);

alter table public.assistant_settings enable row level security;
alter table public.assistant_charge enable row level security;
alter table public.assistant_usage enable row level security;
alter table public.assistant_daily_total enable row level security;

create or replace function public.consume_assistant_quota(p_user_limit int, p_global_limit int)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_day date := (now() at time zone 'Asia/Karachi')::date;
  v_global int;
  v_user int;
  v_user_limit int;
  v_global_limit int;
  v_charge uuid;
begin
  if v_uid is null then
    raise exception 'not signed in';
  end if;

  select least(p_user_limit, user_max), least(p_global_limit, global_max)
    into v_user_limit, v_global_limit from public.assistant_settings;

  -- Null or non-positive inputs fall through the `> 0` guards and are refused.
  -- Single-statement conditional upserts: concurrent callers cannot both pass the limit.
  insert into public.assistant_daily_total as t (day, questions)
  select v_day, 1 where p_global_limit > 0
  on conflict (day) do update set questions = t.questions + 1
    where t.questions < v_global_limit
  returning t.questions into v_global;

  if v_global is null then
    return jsonb_build_object('allowed', false, 'reason', 'global', 'remaining', 0, 'charge_id', null);
  end if;

  insert into public.assistant_usage as u (user_id, day, questions)
  select v_uid, v_day, 1 where p_user_limit > 0
  on conflict (user_id, day) do update set questions = u.questions + 1
    where u.questions < v_user_limit
  returning u.questions into v_user;

  if v_user is null then
    update public.assistant_daily_total set questions = questions - 1 where day = v_day;
    return jsonb_build_object('allowed', false, 'reason', 'user', 'remaining', 0, 'charge_id', null);
  end if;

  insert into public.assistant_charge (user_id, day) values (v_uid, v_day) returning id into v_charge;
  return jsonb_build_object('allowed', true, 'reason', null, 'remaining', v_user_limit - v_user, 'charge_id', v_charge);
end;
$$;

drop function if exists public.refund_assistant_quota();

create or replace function public.refund_assistant_quota(p_charge_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_day date;
begin
  if v_uid is null then
    raise exception 'not signed in';
  end if;

  -- The token is single-use and owned by the caller; unknown or spent tokens do nothing.
  delete from public.assistant_charge where id = p_charge_id and user_id = v_uid returning day into v_day;
  if v_day is null then
    return;
  end if;

  update public.assistant_usage set questions = questions - 1
  where user_id = v_uid and day = v_day and questions > 0;
  update public.assistant_daily_total set questions = questions - 1
  where day = v_day and questions > 0;
end;
$$;

revoke all on function public.consume_assistant_quota(int, int) from public, anon;
revoke all on function public.refund_assistant_quota(uuid) from public, anon;
grant execute on function public.consume_assistant_quota(int, int) to authenticated;
grant execute on function public.refund_assistant_quota(uuid) to authenticated;
