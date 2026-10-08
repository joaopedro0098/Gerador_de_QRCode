import { qrPngBytesForCode } from './artQrRaster.js'

/** PNG do QR code em alta resolução (~300 DPI no tamanho da sessão). */
export async function composeQrOnlyPng(code, qrSizeCm) {
  return qrPngBytesForCode(code, qrSizeCm)
}
