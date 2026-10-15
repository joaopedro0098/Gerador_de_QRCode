import { isLojaCode, normalizeCode } from './codes.js'

function cleanScanPayload(text) {
  return String(text ?? '')
    .trim()
    .replace(/^\uFEFF/, '')
    .replace(/^["']|["']$/g, '')
}

/** Remove query/hash para bater com destination_url salvo. */
export function normalizeQrScanPayload(text) {
  const raw = cleanScanPayload(text)
  if (!raw) return raw
  try {
    const url = new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw.replace(/^\/+/, '')}`)
    return `${url.origin}${url.pathname}`.replace(/\/+$/, '') || raw
  } catch {
    return raw
  }
}

/** Extrai o ID lojaXX do texto lido no QR (URL /c/..., /r/..., id puro ou trecho lojaNN). */
export function parseCardCodeFromQrText(text) {
  const raw = cleanScanPayload(text)
  if (!raw) return null

  let urlCandidate = raw
  if (!/^https?:\/\//i.test(raw) && /[/:]/.test(raw)) {
    urlCandidate = `https://${raw.replace(/^\/+/, '')}`
  }

  try {
    const url = new URL(urlCandidate)
    const path = decodeURIComponent(url.pathname)
    const segmentPatterns = [/\/c\/([^/?#]+)/i, /\/r\/([^/?#]+)/i, /\/api\/redirect\/([^/?#]+)/i]
    for (const re of segmentPatterns) {
      const match = path.match(re)
      if (match?.[1]) {
        const code = normalizeCode(match[1])
        if (isLojaCode(code)) return code
      }
    }
  } catch {
    /* não é URL */
  }

  const embedded = raw.match(/loja[0-9]+/i)
  if (embedded) {
    const code = normalizeCode(embedded[0])
    if (isLojaCode(code)) return code
  }

  const code = normalizeCode(raw)
  return isLojaCode(code) ? code : null
}

export function parseShortLinkCodeFromQrText(text) {
  const raw = cleanScanPayload(text)
  if (!raw) return null
  try {
    const url = new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`)
    const match = decodeURIComponent(url.pathname).match(/\/r\/([^/?#]+)/i)
    if (match?.[1]) return normalizeCode(match[1])
  } catch {
    const match = raw.match(/\/r\/([^/?#\s]+)/i)
    if (match?.[1]) return normalizeCode(match[1])
  }
  return null
}
