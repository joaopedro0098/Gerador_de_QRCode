/** Card ativo = tem link de QR e/ou link NFC configurado. */
export function isCardActivated(card) {
  if (!card) return false
  const qr = card.destination_url?.trim()
  const nfc = card.nfc_url?.trim()
  return Boolean(qr || nfc)
}

/** Filtros Supabase (virgem = sem QR e sem NFC). */
export function applyVirginCardsFilter(query) {
  return query.is('destination_url', null).is('nfc_url', null)
}

export function applyActivatedCardsFilter(query) {
  return query.or('destination_url.not.is.null,nfc_url.not.is.null')
}

/** Loja ativa que já tem bairro e o usuário escolheu outro. */
export function isActiveCardBairroChange(card, newBairroId) {
  if (!isCardActivated(card)) return false
  const current = card.location_bairro_id
  if (!current || !newBairroId) return false
  return current !== newBairroId
}
