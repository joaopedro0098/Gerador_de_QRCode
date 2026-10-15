import { CARD_FIELDS } from './cardActivation.js'
import { parseCardCodeFromQrText, parseShortLinkCodeFromQrText } from './parseQrScan.js'
import { isValidHttpsUrl } from './validate.js'

function pickCardFields(row) {
  if (!row || typeof row !== 'object') return null
  const fields = CARD_FIELDS.split(',').map((f) => f.trim())
  const out = {}
  for (const key of fields) {
    if (key in row) out[key] = row[key]
  }
  return out.id ? out : row
}

async function fetchByCode(supabase, code) {
  return supabase.from('cards').select(CARD_FIELDS).eq('code', code).maybeSingle()
}

async function fetchByShortCode(supabase, shortCode) {
  const { data: link, error: linkError } = await supabase
    .from('short_links')
    .select('card_id')
    .eq('code', shortCode)
    .maybeSingle()
  if (linkError) return { data: null, error: linkError }
  if (!link?.card_id) return { data: null, error: null }
  return supabase.from('cards').select(CARD_FIELDS).eq('id', link.card_id).maybeSingle()
}

async function fetchByHttpsUrl(supabase, url) {
  const trimmed = url.trim()
  const variants = [trimmed, trimmed.replace(/\/+$/, ''), `${trimmed.replace(/\/+$/, '')}/`]
  const seen = new Set()
  for (const candidate of variants) {
    if (!candidate || seen.has(candidate)) continue
    seen.add(candidate)
    const dest = await supabase.from('cards').select(CARD_FIELDS).eq('destination_url', candidate).maybeSingle()
    if (dest.error) return dest
    if (dest.data) return dest
    const nfc = await supabase.from('cards').select(CARD_FIELDS).eq('nfc_url', candidate).maybeSingle()
    if (nfc.error) return nfc
    if (nfc.data) return nfc
  }
  return { data: null, error: null }
}

/** Fallback no cliente se a RPC ainda não existir no projeto remoto. */
async function fetchCardByQrScanTextFallback(supabase, rawText) {
  const trimmed = String(rawText ?? '').trim()
  const code = parseCardCodeFromQrText(trimmed)
  if (code) {
    const byCode = await fetchByCode(supabase, code)
    if (byCode.error || byCode.data) return byCode
  }

  const shortCode = parseShortLinkCodeFromQrText(trimmed)
  if (shortCode) {
    const byShort = await fetchByShortCode(supabase, shortCode)
    if (byShort.error || byShort.data) return byShort
  }

  if (isValidHttpsUrl(trimmed)) {
    return fetchByHttpsUrl(supabase, trimmed)
  }

  return { data: null, error: null }
}

/** Busca card pelo conteúdo do QR — RPC no Postgres + fallback. */
export async function fetchCardByQrScanText(supabase, rawText) {
  const payload = String(rawText ?? '').trim()
  if (!payload) return { data: null, error: null }

  const { data: rpcData, error: rpcError } = await supabase.rpc('find_card_for_qr_scan', {
    p_payload: payload,
  })

  if (!rpcError && rpcData) {
    return { data: pickCardFields(rpcData), error: null }
  }

  if (rpcError && !/find_card_for_qr_scan|PGRST202|42883/i.test(rpcError.message ?? '')) {
    return { data: null, error: rpcError }
  }

  return fetchCardByQrScanTextFallback(supabase, payload)
}
