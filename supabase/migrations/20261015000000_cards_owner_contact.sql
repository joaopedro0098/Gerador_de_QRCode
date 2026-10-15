-- Dados opcionais no fluxo Estoque (proprietário e contato).

alter table public.cards
  add column if not exists owner_name text,
  add column if not exists contact text;

comment on column public.cards.owner_name is 'Nome do proprietário (opcional; preenchido no estoque).';
comment on column public.cards.contact is 'Contato do estabelecimento (opcional; preenchido no estoque).';
