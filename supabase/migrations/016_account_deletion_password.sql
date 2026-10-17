-- Require the current password at the database boundary, including direct RPC calls.
drop function public.delete_my_account();

create function public.delete_my_account(p_password text)
returns void language plpgsql security definer set search_path = auth, public, extensions
as $$
declare
  account_id uuid := auth.uid();
  stored_hash text;
begin
  if account_id is null then raise exception 'Authentication required'; end if;
  select encrypted_password into stored_hash from auth.users where id = account_id;
  if stored_hash is null or p_password is null or crypt(p_password, stored_hash) is distinct from stored_hash then
    raise exception 'Current password is incorrect';
  end if;
  delete from auth.users where id = account_id;
  if not found then raise exception 'Account not found'; end if;
end;
$$;
revoke all on function public.delete_my_account(text) from public;
grant execute on function public.delete_my_account(text) to authenticated;
