import { VIRGIN_POOL_MAX } from '../lib/config.js'

export { VIRGIN_POOL_MAX }

export async function fetchVirginPoolCount(supabase) {
  const { count, error } = await supabase
    .from('cards')
    .select('id', { count: 'exact', head: true })
    .is('activated_at', null)
    .is('stock_at', null)

  if (error) {
    return { count: null, error }
  }
  return { count: count ?? 0, error: null }
}

export function virginSlotsAvailable(currentVirginCount) {
  const current = Number(currentVirginCount)
  if (!Number.isFinite(current)) return 0
  return Math.max(0, VIRGIN_POOL_MAX - current)
}
