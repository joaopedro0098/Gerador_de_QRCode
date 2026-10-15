import { isLojaCode, normalizeCode } from './codes.js'

/** Extrai o ID lojaXX do texto lido no QR (URL /c/... ou texto puro). */
export function parseCardCodeFromQrText(text) {
  const raw = String(text ?? '').trim()
  if (!raw) return null

  try {
    const url = new URL(raw)
    const path = url.pathname.replace(/\/+$/, '')
    const match = path.match(/\/c\/([^/]+)$/i) || path.match(/\/c\/([^/]+)/i)
    if (match) {
      const code = normalizeCode(match[1])
      if (isLojaCode(code)) return code
    }
  } catch {
    /* não é URL */
  }

  const code = normalizeCode(raw)
  return isLojaCode(code) ? code : null
}
