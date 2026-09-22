alter table public.cards
  add column if not exists nfc_url text,
  add column if not exists nfc_uid text;

alter table public.cards
  add constraint cards_nfc_url_https check (
    nfc_url is null or nfc_url ~* '^https://'
  );

create unique index if not exists cards_nfc_uid_unique_idx
  on public.cards (nfc_uid)
  where nfc_uid is not null;
