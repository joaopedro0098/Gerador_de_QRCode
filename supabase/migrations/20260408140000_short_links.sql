create table public.short_links (
  code text primary key,
  target_url text not null,
  card_id uuid not null references public.cards (id) on delete cascade,
  clicks int not null default 0,
  created_at timestamptz not null default now(),
  constraint short_links_target_url_trim check (char_length(trim(target_url)) > 0),
  constraint short_links_clicks_nonneg check (clicks >= 0)
);

create unique index short_links_card_id_unique on public.short_links (card_id);

alter table public.cards
  add column if not exists short_code text;

alter table public.cards
  add constraint cards_short_code_fkey
  foreign key (short_code) references public.short_links (code) on delete set null;

create unique index cards_short_code_unique on public.cards (short_code)
  where short_code is not null;

alter table public.short_links enable row level security;

create policy "Authenticated full access on short_links"
  on public.short_links
  for all
  to authenticated
  using (true)
  with check (true);

grant select, insert, update, delete on table public.short_links to authenticated;
grant all on table public.short_links to service_role;
