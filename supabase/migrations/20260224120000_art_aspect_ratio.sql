alter table public.art_sessions
  add column if not exists art_aspect_ratio numeric;
