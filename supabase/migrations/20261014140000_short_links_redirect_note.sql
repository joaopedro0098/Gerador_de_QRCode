-- Redirect /r/:code → resolve_short_link usa PK (code) em short_links; escala bem por toque.
comment on function public.resolve_short_link(text) is
  'Incrementa clicks e devolve target_url; lookup por PK short_links.code.';
