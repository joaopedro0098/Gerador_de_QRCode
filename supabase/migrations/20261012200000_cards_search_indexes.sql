-- Índices para busca por prefixo (ID / estabelecimento) e paginação por loja_num
-- nas abas Virgens, Estoque e Ativados.

-- Índices antigos usavam destination_url como proxy de "ativo"
drop index if exists public.cards_location_bairro_id_idx;
drop index if exists public.cards_activated_notes_trgm_idx;

-- Prefixo no code (ILIKE 'loja123%'; coluna já é lowercase)
create index if not exists cards_code_prefix_idx
  on public.cards (code text_pattern_ops);

-- Paginação ordenada por loja_num em cada segmento
create index if not exists cards_activated_loja_idx
  on public.cards (loja_num asc nulls last)
  where activated_at is not null;

create index if not exists cards_in_stock_loja_idx
  on public.cards (loja_num asc nulls last)
  where stock_at is not null;

-- QR ativos por bairro (explorer Ativados)
create index if not exists cards_active_bairro_loja_idx
  on public.cards (location_bairro_id, loja_num asc nulls last)
  where activated_at is not null and location_bairro_id is not null;

-- Estabelecimento: prefixo case-insensitive por segmento
create index if not exists cards_virgin_notes_prefix_idx
  on public.cards (lower(notes) text_pattern_ops)
  where activated_at is null
    and stock_at is null
    and notes is not null
    and btrim(notes) <> '';

create index if not exists cards_stock_notes_prefix_idx
  on public.cards (lower(notes) text_pattern_ops)
  where stock_at is not null
    and notes is not null
    and btrim(notes) <> '';

create index if not exists cards_activated_notes_prefix_idx
  on public.cards (lower(notes) text_pattern_ops)
  where activated_at is not null
    and notes is not null
    and btrim(notes) <> '';

-- ILIKE em notes (PostgREST notes.ilike) — trigram por segmento
create index if not exists cards_virgin_notes_trgm_idx
  on public.cards using gin (lower(notes) gin_trgm_ops)
  where activated_at is null and stock_at is null and notes is not null;

create index if not exists cards_stock_notes_trgm_idx
  on public.cards using gin (lower(notes) gin_trgm_ops)
  where stock_at is not null and notes is not null;

create index if not exists cards_activated_notes_trgm_idx
  on public.cards using gin (lower(notes) gin_trgm_ops)
  where activated_at is not null and notes is not null;

create index if not exists cards_location_bairro_active_idx
  on public.cards (location_bairro_id)
  where activated_at is not null and location_bairro_id is not null;

-- Busca Ativados (RPC): localização sem EXISTS recursivo por card
create or replace function public.search_activated_cards(p_search text, p_limit int default 500)
returns table (
  id uuid,
  code text,
  destination_url text,
  activated_at timestamptz,
  created_at timestamptz,
  notes text,
  nfc_url text,
  nfc_uid text,
  location_bairro_id uuid,
  paused boolean,
  annotation text,
  location_path text
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_term text := lower(trim(coalesce(p_search, '')));
  v_prefix text;
begin
  if v_term = '' then
    return;
  end if;

  v_prefix := replace(replace(replace(v_term, '\', '\\'), '%', '\%'), '_', '\_') || '%';

  return query
  with location_bairros as (
    select distinct bid as bairro_id
    from public.location_nodes ln
    cross join lateral public.location_bairro_ids_in_subtree(ln.id) bid
    where lower(trim(ln.name)) like v_prefix escape '\'
  )
  select
    c.id,
    c.code,
    c.destination_url,
    c.activated_at,
    c.created_at,
    c.notes,
    c.nfc_url,
    c.nfc_uid,
    c.location_bairro_id,
    c.paused,
    c.annotation,
    public.location_path_labels(c.location_bairro_id) as location_path
  from public.cards c
  where c.activated_at is not null
    and (
      c.code like v_prefix escape '\'
      or lower(coalesce(c.notes, '')) like v_prefix escape '\'
      or c.location_bairro_id in (select bairro_id from location_bairros)
    )
  order by c.loja_num asc nulls last, c.code asc
  limit greatest(1, least(p_limit, 500));
end;
$$;

grant execute on function public.search_activated_cards(text, int) to authenticated;
