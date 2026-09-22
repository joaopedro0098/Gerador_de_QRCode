-- Renomeia códigos existentes para loja1, loja2, … (ordem de criação)
update public.cards
set code = 'tmp_' || id::text
where code !~ '^tmp_';

with ordered as (
  select id, row_number() over (order by created_at asc, code asc) as rn
  from public.cards
)
update public.cards c
set code = 'loja' || o.rn::text
from ordered o
where c.id = o.id;

alter table public.cards
  drop constraint if exists cards_code_lowercase;

alter table public.cards
  add constraint cards_code_max_length check (char_length(code) <= 15);

alter table public.cards
  add constraint cards_code_loja_format check (code ~ '^loja[0-9]+$');
