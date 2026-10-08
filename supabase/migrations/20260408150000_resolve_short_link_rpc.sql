create or replace function public.resolve_short_link(p_code text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  dest text;
begin
  update public.short_links
  set clicks = clicks + 1
  where code = trim(p_code)
  returning target_url into dest;

  return dest;
end;
$$;

revoke all on function public.resolve_short_link(text) from public;
grant execute on function public.resolve_short_link(text) to anon, authenticated, service_role;
