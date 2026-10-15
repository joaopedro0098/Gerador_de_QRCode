import { CARD_FIELDS } from './cardActivation.js'
import { parseCardCodeFromQrText } from './parseQrScan.js'
import { isValidHttpsUrl } from './validate.js'

/** Busca card pelo conteúdo do QR (/c/id, id puro ou destination_url). */
export async function fetchCardByQrScanText(supabase, rawText) {
  const code = parseCardCodeFromQrText(rawText)
  if (code) {
    return supabase.from('cards').select(CARD_FIELDS).eq('code', code).maybeSingle()
  }

  const trimmed = String(rawText ?? '').trim()
  if (isValidHttpsUrl(trimmed)) {
    return supabase.from('cards').select(CARD_FIELDS).eq('destination_url', trimmed).maybeSingle()
  }

  return { data: null, error: null }
}
