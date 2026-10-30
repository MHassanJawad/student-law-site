-- Worker-only publication functions must not be callable by browser roles, which Supabase grants by default.
revoke all on function public.approve_fccp_candidate(uuid, text) from anon, authenticated;
revoke all on function public.withdraw_fccp_candidate(uuid, text) from anon, authenticated;
