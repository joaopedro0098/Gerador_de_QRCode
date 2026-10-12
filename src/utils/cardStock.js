import { CARD_FIELDS } from './cardActivation.js'

/** Envia virgens para o estoque (stock_at). */
export async function sendVirginCardsToStock(supabase, cardIds) {
  if (!cardIds?.length) {
    return { data: [], error: { message: 'Nenhum ID selecionado.' } }
  }

  const now = new Date().toISOString()
  return supabase
    .from('cards')
    .update({ stock_at: now })
    .in('id', cardIds)
    .is('activated_at', null)
    .is('stock_at', null)
    .select(CARD_FIELDS)
}

/** Todos os virgens (opcional: mesmo filtro de busca da lista). */
export async function sendAllVirginCardsToStock(supabase, { searchOr = null } = {}) {
  const now = new Date().toISOString()

  let query = supabase
    .from('cards')
    .update({ stock_at: now })
    .is('activated_at', null)
    .is('stock_at', null)
    .select(CARD_FIELDS)

  if (searchOr) {
    query = query.or(searchOr)
  }

  return query
}
