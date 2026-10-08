alter table public.art_sessions
  add column if not exists art_x_cm numeric,
  add column if not exists art_y_cm numeric,
  add column if not exists art_width_cm numeric,
  add column if not exists art_height_cm numeric;

update public.art_sessions
set
  art_x_cm = 0,
  art_y_cm = 0,
  art_width_cm = card_width_cm,
  art_height_cm = card_height_cm
where
  file_path is not null
  and card_width_cm is not null
  and card_height_cm is not null
  and art_width_cm is null;
