-- Estoque: virgens enviados ou cards desativados; Ativados = só leitura na UI.

alter table public.cards
  add column if not exists stock_at timestamptz;

comment on column public.cards.stock_at is
  'Preenchido ao enviar virgem para estoque ou ao desativar; card configurável na aba Estoque.';

-- Cards já ativados entram no estoque lógico (gestão na aba Estoque).
update public.cards
set stock_at = coalesce(activated_at, created_at)
where stock_at is null
  and activated_at is not null;

create index if not exists cards_stock_at_idx
  on public.cards (stock_at desc nulls last)
  where stock_at is not null and activated_at is null;

create index if not exists cards_virgin_loja_idx
  on public.cards (loja_num asc nulls last)
  where activated_at is null and stock_at is null;
