-- loja1..loja9 → loja01..loja09 (loja10+ inalterado)
update public.cards
set code = 'loja0' || substring(code from 5)
where code ~ '^loja[1-9]$';
