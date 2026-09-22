alter table public.cards
  add column if not exists loja_num integer generated always as (
    (regexp_replace(code, '^loja', ''))::integer
  ) stored;

create index if not exists cards_loja_num_idx on public.cards (loja_num);
