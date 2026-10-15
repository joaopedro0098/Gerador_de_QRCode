-- Busca de card pelo conteúdo lido no QR (scanner Estoque) + índices para URL exata.

create index if not exists cards_destination_url_eq_idx
  on public.cards (destination_url)
  where destination_url is not null;

create index if not exists cards_nfc_url_eq_idx
  on public.cards (nfc_url)
  where nfc_url is not null;

create or replace function public.find_card_for_qr_scan(p_payload text)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_raw text := btrim(coalesce(p_payload, ''));
  v_code text;
  v_short text;
  v_row public.cards%rowtype;
begin
  if v_raw = '' then
    return null;
  end if;

  v_code := (regexp_match(v_raw, '/c/([^/?#]+)', 'i'))[1];
  if v_code is not null then
    v_code := lower(btrim(v_code));
    if v_code ~ '^loja[0-9]+$' and char_length(v_code) <= 15 then
      select * into v_row from public.cards where code = v_code;
      if found then
        return to_jsonb(v_row);
      end if;
    end if;
  end if;

  v_short := (regexp_match(v_raw, '/r/([^/?#]+)', 'i'))[1];
  if v_short is not null then
    v_short := lower(btrim(v_short));
    select c.* into v_row
    from public.short_links sl
    inner join public.cards c on c.id = sl.card_id
    where sl.code = v_short
    limit 1;
    if found then
      return to_jsonb(v_row);
    end if;
  end if;

  v_code := (regexp_match(v_raw, '(loja[0-9]+)', 'i'))[1];
  if v_code is not null then
    v_code := lower(v_code);
    if v_code ~ '^loja[0-9]+$' and char_length(v_code) <= 15 then
      select * into v_row from public.cards where code = v_code;
      if found then
        return to_jsonb(v_row);
      end if;
    end if;
  end if;

  v_code := lower(v_raw);
  if v_code ~ '^loja[0-9]+$' and char_length(v_code) <= 15 then
    select * into v_row from public.cards where code = v_code;
    if found then
      return to_jsonb(v_row);
    end if;
  end if;

  if v_raw ~* '^https://' then
    select * into v_row from public.cards where destination_url = v_raw limit 1;
    if found then
      return to_jsonb(v_row);
    end if;

    select * into v_row from public.cards where destination_url = rtrim(v_raw, '/') limit 1;
    if found then
      return to_jsonb(v_row);
    end if;

    select * into v_row from public.cards where nfc_url = v_raw limit 1;
    if found then
      return to_jsonb(v_row);
    end if;
  end if;

  return null;
end;
$$;

grant execute on function public.find_card_for_qr_scan(text) to authenticated;
