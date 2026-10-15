import QRCode from 'qrcode'
import { PUBLIC_CARD_BASE_URL } from '../lib/config.js'
import { isValidHttpsUrl } from './validate.js'

export function cardPublicUrl(code) {
  return `${PUBLIC_CARD_BASE_URL}/c/${code}`
}

/** Conteúdo do QR: link final (como NFC) se houver destination_url; senão /c/id (legado e virgens). */
export function qrEncodeUrlForCard({ code, destinationUrl } = {}) {
  const dest = destinationUrl?.trim()
  if (dest && isValidHttpsUrl(dest)) {
    return dest
  }
  if (code) {
    return cardPublicUrl(code)
  }
  return ''
}

export async function qrToSvgString(text) {
  return QRCode.toString(text, {
    type: 'svg',
    margin: 1,
    errorCorrectionLevel: 'M',
  })
}

export async function qrSvgForCode(code, destinationUrl) {
  const payload = qrEncodeUrlForCard({ code, destinationUrl })
  if (!payload) return ''
  return qrToSvgString(payload)
}
