create table public.cards (
  id uuid primary key default gen_random_uuid(),
  code text not null,
  destination_url text,
  activated_at timestamptz,
  created_at timestamptz not null default now(),
  batch_label text,
  notes text,
  scan_count integer not null default 0,
  constraint cards_code_unique unique (code),
  constraint cards_code_lowercase check (code = lower(code)),
  constraint cards_destination_https check (
    destination_url is null or destination_url ~* '^https://'
  )
);

create index cards_created_at_idx on public.cards (created_at desc);

create index cards_virgin_created_at_idx on public.cards (created_at desc)
  where destination_url is null;

alter table public.cards enable row level security;

create policy "Authenticated full access on cards"
  on public.cards
  for all
  to authenticated
  using (true)
  with check (true);

create or replace function public.lookup_card_redirect(p_code text)
returns json
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_url text;
begin
  select destination_url into v_url
  from public.cards
  where code = lower(trim(p_code));

  if not found then
    return json_build_object('status', 'not_found');
  end if;

  if v_url is null then
    return json_build_object('status', 'not_activated');
  end if;

  return json_build_object('status', 'ok', 'destination_url', v_url);
end;
$$;

grant execute on function public.lookup_card_redirect(text) to anon;
grant execute on function public.lookup_card_redirect(text) to authenticated;
