import QRCode from 'qrcode'
import { cardPublicUrl } from './qr.js'

/** Resolução de exportação alinhada a ~300 DPI no tamanho físico do QR. */
export const QR_EXPORT_DPI = 300

export async function qrPngBytesForCode(code, qrSizeCm, dpi = QR_EXPORT_DPI) {
  const sizeCm = Number(qrSizeCm)
  const px = Math.max(128, Math.round((sizeCm / 2.54) * dpi))
  const dataUrl = await QRCode.toDataURL(cardPublicUrl(code), {
    errorCorrectionLevel: 'M',
    margin: 1,
    width: px,
  })
  const res = await fetch(dataUrl)
  return new Uint8Array(await res.arrayBuffer())
}
