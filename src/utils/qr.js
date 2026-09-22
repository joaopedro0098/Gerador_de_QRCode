import QRCode from 'qrcode'
import { PUBLIC_CARD_BASE_URL } from '../lib/config.js'

export function cardPublicUrl(code) {
  return `${PUBLIC_CARD_BASE_URL}/c/${code}`
}

export async function qrToSvgString(text) {
  return QRCode.toString(text, {
    type: 'svg',
    margin: 1,
    errorCorrectionLevel: 'M',
  })
}

export async function qrSvgForCode(code) {
  return qrToSvgString(cardPublicUrl(code))
}
