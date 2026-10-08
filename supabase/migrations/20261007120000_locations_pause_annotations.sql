create extension if not exists pg_trgm;

create type public.location_level as enum ('estado', 'cidade', 'distrito', 'bairro');

create table public.location_nodes (
  id uuid primary key default gen_random_uuid(),
  parent_id uuid references public.location_nodes (id) on delete restrict,
  level public.location_level not null,
  name text not null,
  created_at timestamptz not null default now(),
  constraint location_nodes_parent_level check (
    (level = 'estado' and parent_id is null)
    or (level <> 'estado' and parent_id is not null)
  ),
  constraint location_nodes_name_trim check (char_length(trim(name)) > 0)
);

create unique index location_nodes_estado_name_unique on public.location_nodes (lower(trim(name)))
  where level = 'estado';

create unique index location_nodes_sibling_name_unique on public.location_nodes (parent_id, lower(trim(name)))
  where parent_id is not null;

create index location_nodes_parent_id_idx on public.location_nodes (parent_id);
create index location_nodes_level_idx on public.location_nodes (level);
create index location_nodes_name_lower_idx on public.location_nodes (lower(name) text_pattern_ops);
create index location_nodes_name_trgm_idx on public.location_nodes using gin (name gin_trgm_ops);

alter table public.cards
  add column location_bairro_id uuid references public.location_nodes (id) on delete restrict,
  add column paused boolean not null default false,
  add column annotation text;

create index cards_location_bairro_id_idx on public.cards (location_bairro_id)
  where destination_url is not null;

create index cards_activated_notes_trgm_idx on public.cards using gin (notes gin_trgm_ops)
  where destination_url is not null;

alter table public.location_nodes enable row level security;
alter table public.cards
  add constraint cards_activated_requires_bairro check (
    destination_url is null or location_bairro_id is not null
  );

create policy "Authenticated full access on location_nodes"
  on public.location_nodes
  for all
  to authenticated
  using (true)
  with check (true);

grant select, insert, update, delete on table public.location_nodes to authenticated;
grant all on table public.location_nodes to service_role;

create or replace function public.location_child_level(p_level public.location_level)
returns public.location_level
language sql
immutable
as $$
  select case p_level
    when 'estado' then 'cidade'::public.location_level
    when 'cidade' then 'distrito'::public.location_level
    when 'distrito' then 'bairro'::public.location_level
    else null::public.location_level
  end;
$$;

create or replace function public.location_bairro_ids_in_subtree(p_node_id uuid)
returns setof uuid
language sql
stable
security definer
set search_path = public
as $$
  with recursive tree as (
    select id, level from location_nodes where id = p_node_id
    union all
    select n.id, n.level
    from location_nodes n
    inner join tree t on n.parent_id = t.id
  )
  select id from tree where level = 'bairro';
$$;

create or replace function public.location_has_active_cards(p_node_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.cards c
    where c.destination_url is not null
      and c.location_bairro_id in (select public.location_bairro_ids_in_subtree(p_node_id))
  );
$$;

create or replace function public.location_path_labels(p_bairro_id uuid)
returns text
language sql
stable
security definer
set search_path = public
as $$
  with recursive ancestors as (
    select id, parent_id, level, trim(name) as name, 1 as depth
    from location_nodes
    where id = p_bairro_id
    union all
    select n.id, n.parent_id, n.level, trim(n.name), a.depth + 1
    from location_nodes n
    inner join ancestors a on n.id = a.parent_id
  )
  select string_agg(name, ' > ' order by depth desc)
  from ancestors;
$$;

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

  v_prefix := replace(replace(v_term, '%', ''), '_', '') || '%';

  return query
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
  where c.destination_url is not null
    and (
      lower(c.code) like v_prefix
      or lower(coalesce(c.notes, '')) like v_prefix
      or exists (
        with recursive chain as (
          select ln.id, ln.parent_id, ln.level, lower(trim(ln.name)) as lname
          from location_nodes ln
          where ln.id = c.location_bairro_id
          union all
          select p.id, p.parent_id, p.level, lower(trim(p.name))
          from location_nodes p
          inner join chain ch on p.id = ch.parent_id
        )
        select 1 from chain where lname like v_prefix
      )
    )
  order by c.loja_num asc nulls last, c.code asc
  limit greatest(1, least(p_limit, 500));
end;
$$;

grant execute on function public.search_activated_cards(text, int) to authenticated;
grant execute on function public.location_path_labels(uuid) to authenticated;
grant execute on function public.location_has_active_cards(uuid) to authenticated;
grant execute on function public.location_bairro_ids_in_subtree(uuid) to authenticated;

create or replace function public.lookup_card_redirect(p_code text)
returns json
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_url text;
  v_paused boolean;
begin
  select destination_url, paused into v_url, v_paused
  from public.cards
  where code = lower(trim(p_code));

  if not found then
    return json_build_object('status', 'not_found');
  end if;

  if v_url is null then
    return json_build_object('status', 'not_activated');
  end if;

  if v_paused then
    return json_build_object(
      'status', 'paused',
      'message', 'Serviço temporariamente pausado. Acione a empresa responsável.'
    );
  end if;

  return json_build_object('status', 'ok', 'destination_url', v_url);
end;
$$;

create or replace function public.lookup_nfc_redirect(p_uid text)
returns json
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_url text;
  v_paused boolean;
  v_norm text := lower(trim(coalesce(p_uid, '')));
begin
  if v_norm = '' then
    return json_build_object('status', 'not_found');
  end if;

  select nfc_url, paused into v_url, v_paused
  from public.cards
  where nfc_uid = v_norm;

  if not found then
    return json_build_object('status', 'not_found');
  end if;

  if v_url is null then
    return json_build_object('status', 'not_activated');
  end if;

  if v_paused then
    return json_build_object(
      'status', 'paused',
      'message', 'Serviço temporariamente pausado. Acione a empresa responsável.'
    );
  end if;

  return json_build_object('status', 'ok', 'destination_url', v_url);
end;
$$;

grant execute on function public.lookup_nfc_redirect(text) to anon;
grant execute on function public.lookup_nfc_redirect(text) to authenticated;
