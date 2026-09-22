-- Busca por prefixo no estabelecimento (coluna notes), ex.: ILIKE 'mar%'
create index if not exists cards_notes_prefix_search_idx
  on public.cards (notes text_pattern_ops)
  where notes is not null and btrim(notes) <> '';

-- Ordenação + filtros de status já usam created_at e índices parciais existentes
