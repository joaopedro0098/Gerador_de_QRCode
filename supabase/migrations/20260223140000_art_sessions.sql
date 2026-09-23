create table public.art_sessions (
  id uuid primary key default gen_random_uuid(),
  file_path text,
  file_mime text,
  card_width_cm numeric,
  card_height_cm numeric,
  qr_x_cm numeric,
  qr_y_cm numeric,
  qr_size_cm numeric,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index art_sessions_created_at_idx on public.art_sessions (created_at asc);

alter table public.art_sessions enable row level security;

create policy "Authenticated full access on art_sessions"
  on public.art_sessions
  for all
  to authenticated
  using (true)
  with check (true);

grant select, insert, update, delete on table public.art_sessions to authenticated;
grant all on table public.art_sessions to service_role;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'card-art',
  'card-art',
  false,
  52428800,
  array['image/jpeg', 'image/png', 'image/svg+xml', 'application/pdf']
)
on conflict (id) do nothing;

create policy "Authenticated insert card-art"
  on storage.objects
  for insert
  to authenticated
  with check (bucket_id = 'card-art');

create policy "Authenticated select card-art"
  on storage.objects
  for select
  to authenticated
  using (bucket_id = 'card-art');

create policy "Authenticated update card-art"
  on storage.objects
  for update
  to authenticated
  using (bucket_id = 'card-art');

create policy "Authenticated delete card-art"
  on storage.objects
  for delete
  to authenticated
  using (bucket_id = 'card-art');
