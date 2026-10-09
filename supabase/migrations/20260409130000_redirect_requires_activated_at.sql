-- Redirecionamento público e contagens só para cards com activated_at (pós botão Ativar).

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
  v_activated_at timestamptz;
begin
  select destination_url, paused, activated_at
  into v_url, v_paused, v_activated_at
  from public.cards
  where code = lower(trim(p_code));

  if not found then
    return json_build_object('status', 'not_found');
  end if;

  if v_activated_at is null or v_url is null then
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
  v_activated_at timestamptz;
  v_norm text := lower(trim(coalesce(p_uid, '')));
begin
  if v_norm = '' then
    return json_build_object('status', 'not_found');
  end if;

  select nfc_url, paused, activated_at
  into v_url, v_paused, v_activated_at
  from public.cards
  where nfc_uid = v_norm;

  if not found then
    return json_build_object('status', 'not_found');
  end if;

  if v_activated_at is null or v_url is null then
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
  where c.activated_at is not null
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
    where c.activated_at is not null
      and c.location_bairro_id in (select public.location_bairro_ids_in_subtree(p_node_id))
  );
$$;
