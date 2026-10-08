alter table public.cards drop constraint if exists cards_activated_requires_bairro;

alter table public.cards
  add constraint cards_active_requires_bairro check (
    (destination_url is null and nfc_url is null)
    or location_bairro_id is not null
  );

create or replace function public.card_is_active(p_destination_url text, p_nfc_url text)
returns boolean
language sql
immutable
as $$
  select coalesce(nullif(trim(p_destination_url), ''), null) is not null
    or coalesce(nullif(trim(p_nfc_url), ''), null) is not null;
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
    where public.card_is_active(c.destination_url, c.nfc_url)
      and c.location_bairro_id in (select public.location_bairro_ids_in_subtree(p_node_id))
  );
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
  where public.card_is_active(c.destination_url, c.nfc_url)
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
