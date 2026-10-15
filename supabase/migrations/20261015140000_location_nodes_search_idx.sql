-- Consultas por nível + pai + prefixo em name (ilike 'term%')
create index if not exists location_nodes_level_parent_name_idx
  on public.location_nodes (level, parent_id, lower(name) text_pattern_ops);
