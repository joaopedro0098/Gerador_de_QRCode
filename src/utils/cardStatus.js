/** Card ativo = passou pelo fluxo Ativar (activated_at preenchido). */
export function isCardActivated(card) {
  if (!card) return false
  return Boolean(card.activated_at)
}

/** Virgem = gerado, ainda não foi para o estoque. */
export function isCardVirgin(card) {
  if (!card) return false
  return !card.activated_at && !card.stock_at
}

/** Estoque = no estoque e ainda não ativado (desativado volta aqui com stock_at). */
export function isCardInStock(card) {
  if (!card) return false
  return Boolean(card.stock_at) && !card.activated_at
}

/** Filtros Supabase. */
export function applyVirginCardsFilter(query) {
  return query.is('activated_at', null).is('stock_at', null)
}

export function applyStockCardsFilter(query) {
  return query.not('stock_at', 'is', null)
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
