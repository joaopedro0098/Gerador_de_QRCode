-- Contagens agregadas para o explorer Ativados (evita baixar uma linha por card no cliente).

create or replace function public.active_card_counts_by_bairro()
returns table (location_bairro_id uuid, card_count bigint)
language sql
stable
security definer
set search_path = public
as $$
  select c.location_bairro_id, count(*)::bigint
  from public.cards c
  where c.activated_at is not null
    and c.location_bairro_id is not null
  group by c.location_bairro_id;
$$;

grant execute on function public.active_card_counts_by_bairro() to authenticated;
