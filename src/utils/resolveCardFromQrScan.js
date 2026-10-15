import { CARD_FIELDS } from './cardActivation.js'
import { formatLojaCode, isLojaCode, normalizeCode, parseLojaNumber } from './codes.js'
import {
  normalizeQrScanPayload,
  parseCardCodeFromQrText,
  parseShortLinkCodeFromQrText,
} from './parseQrScan.js'
import { isValidHttpsUrl } from './validate.js'

function pickCardFields(row) {
  if (!row || typeof row !== 'object') return null
  return row.id ? row : null
}

async function fetchByCode(supabase, code) {
  return supabase.from('cards').select(CARD_FIELDS).eq('code', code).maybeSingle()
}

/** Tenta loja10, loja010, etc. */
export async function fetchCardByLojaCodeFlexible(supabase, rawCode) {
  const normalized = normalizeCode(rawCode)
  if (!isLojaCode(normalized)) {
    return { data: null, error: null, code: null }
  }

  const first = await fetchByCode(supabase, normalized)
  if (first.error) return { ...first, code: normalized }
  if (first.data) return { ...first, code: normalized }

  const n = parseLojaNumber(normalized)
  if (n !== null) {
    try {
      const alt = formatLojaCode(n)
      if (alt !== normalized) {
        const second = await fetchByCode(supabase, alt)
        if (second.error) return { ...second, code: alt }
        if (second.data) return { ...second, code: alt }
      }
    } catch {
      /* format inválido */
    }
  }

  return { data: null, error: null, code: normalized }
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
  const variants = new Set()
  variants.add(trimmed)
  variants.add(trimmed.replace(/\/+$/, ''))
  variants.add(`${trimmed.replace(/\/+$/, '')}/`)
  variants.add(normalizeQrScanPayload(trimmed))

  for (const candidate of variants) {
    if (!candidate || !isValidHttpsUrl(candidate)) continue
    const dest = await supabase.from('cards').select(CARD_FIELDS).eq('destination_url', candidate).maybeSingle()
    if (dest.error) return dest
    if (dest.data) return dest
    const nfc = await supabase.from('cards').select(CARD_FIELDS).eq('nfc_url', candidate).maybeSingle()
    if (nfc.error) return nfc
    if (nfc.data) return nfc
  }
  return { data: null, error: null }
}

async function fetchFromParsedPayload(supabase, payload) {
  const code =
    parseCardCodeFromQrText(payload) || parseCardCodeFromQrText(normalizeQrScanPayload(payload))
  if (code) {
    const byCode = await fetchCardByLojaCodeFlexible(supabase, code)
    if (byCode.error || byCode.data) {
      return { data: byCode.data, error: byCode.error, parsedCode: byCode.code }
    }
  }

  const shortCode = parseShortLinkCodeFromQrText(payload)
  if (shortCode) {
    const byShort = await fetchByShortCode(supabase, shortCode)
    if (byShort.error || byShort.data) {
      return { data: byShort.data, error: byShort.error, parsedCode: code ?? null }
    }
  }

  if (isValidHttpsUrl(payload) || isValidHttpsUrl(normalizeQrScanPayload(payload))) {
    const urlResult = await fetchByHttpsUrl(
      supabase,
      isValidHttpsUrl(payload) ? payload : normalizeQrScanPayload(payload),
    )
    if (urlResult.error || urlResult.data) {
      return { data: urlResult.data, error: urlResult.error, parsedCode: code ?? null }
    }
  }

  return { data: null, error: null, parsedCode: code ?? null }
}

/** Busca card pelo conteúdo do QR — consulta direta + RPC no Postgres. */
export async function fetchCardByQrScanText(supabase, rawText) {
  const payload = String(rawText ?? '').trim()
  if (!payload) return { data: null, error: null, parsedCode: null }

  const direct = await fetchFromParsedPayload(supabase, payload)
  if (direct.error || direct.data) {
    return direct
  }

  const normalized = normalizeQrScanPayload(payload)
  if (normalized && normalized !== payload) {
    const again = await fetchFromParsedPayload(supabase, normalized)
    if (again.error || again.data) {
      return again
    }
  }

  const { data: rpcData, error: rpcError } = await supabase.rpc('find_card_for_qr_scan', {
    p_payload: payload,
  })

  if (!rpcError && rpcData) {
    const card = pickCardFields(rpcData)
    if (card) {
      return {
        data: card,
        error: null,
        parsedCode: parseCardCodeFromQrText(payload) ?? card.code ?? null,
      }
    }
  }

  if (rpcError && !/find_card_for_qr_scan|PGRST202|42883/i.test(rpcError.message ?? '')) {
    return { data: null, error: rpcError, parsedCode: direct.parsedCode }
  }

  if (normalized && normalized !== payload) {
    const { data: rpcNorm, error: rpcNormError } = await supabase.rpc('find_card_for_qr_scan', {
      p_payload: normalized,
    })
    if (!rpcNormError && rpcNorm) {
      const card = pickCardFields(rpcNorm)
      if (card) {
        return { data: card, error: null, parsedCode: card.code ?? direct.parsedCode }
      }
    }
  }

  return { data: null, error: null, parsedCode: direct.parsedCode }
}
