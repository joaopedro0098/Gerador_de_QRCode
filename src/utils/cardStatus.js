/** Card ativo = passou pelo fluxo Ativar (activated_at preenchido). */
export function isCardActivated(card) {
  if (!card) return false
  return Boolean(card.activated_at)
}

/** Filtros Supabase (virgem = ainda não ativado). */
export function applyVirginCardsFilter(query) {
  return query.is('activated_at', null)
}

export function applyActivatedCardsFilter(query) {
  return query.not('activated_at', 'is', null)
}

/** Loja ativa que já tem bairro e o usuário escolheu outro. */
export function isActiveCardBairroChange(card, newBairroId) {
  if (!isCardActivated(card)) return false
  const current = card.location_bairro_id
  if (!current || !newBairroId) return false
  return current !== newBairroId
}
