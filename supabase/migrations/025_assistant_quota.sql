-- Durable daily quotas for the AI research assistant: one counter per user and one site-wide.
-- Days roll over at midnight Pakistan time. RLS is on with no policies: only the functions below touch the tables.
create table public.assistant_usage (
  user_id uuid not null references auth.users on delete cascade,
  day date not null,
  questions int not null default 0,
  primary key (user_id, day)
);

create table public.assistant_daily_total (
  day date primary key,
  questions int not null default 0
);

alter table public.assistant_usage enable row level security;
alter table public.assistant_daily_total enable row level security;

create function public.consume_assistant_quota(p_user_limit int, p_global_limit int)
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
begin
  if v_uid is null then
    raise exception 'not signed in';
  end if;

  -- Single-statement conditional upserts: concurrent callers cannot both pass the limit.
  insert into public.assistant_daily_total as t (day, questions)
  select v_day, 1 where p_global_limit > 0
  on conflict (day) do update set questions = t.questions + 1
    where t.questions < p_global_limit
  returning t.questions into v_global;

  if v_global is null then
    return jsonb_build_object('allowed', false, 'reason', 'global', 'remaining', 0);
  end if;

  insert into public.assistant_usage as u (user_id, day, questions)
  select v_uid, v_day, 1 where p_user_limit > 0
  on conflict (user_id, day) do update set questions = u.questions + 1
    where u.questions < p_user_limit
  returning u.questions into v_user;

  if v_user is null then
    update public.assistant_daily_total set questions = questions - 1 where day = v_day;
    return jsonb_build_object('allowed', false, 'reason', 'user', 'remaining', 0);
  end if;

  return jsonb_build_object('allowed', true, 'reason', null, 'remaining', p_user_limit - v_user);
end;
$$;

create function public.refund_assistant_quota()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_day date := (now() at time zone 'Asia/Karachi')::date;
begin
  if v_uid is null then
    raise exception 'not signed in';
  end if;

  -- Only refund when the user has a charge today, so the site-wide count stays in step with the user's.
  update public.assistant_usage set questions = questions - 1
  where user_id = v_uid and day = v_day and questions > 0;
  if found then
    update public.assistant_daily_total set questions = questions - 1
    where day = v_day and questions > 0;
  end if;
end;
$$;

revoke all on function public.consume_assistant_quota(int, int) from public, anon;
revoke all on function public.refund_assistant_quota() from public, anon;
grant execute on function public.consume_assistant_quota(int, int) to authenticated;
grant execute on function public.refund_assistant_quota() to authenticated;
