import QRCode from 'qrcode'
import { qrEncodeUrlForCard } from './qr.js'

/** Resolução de exportação alinhada a ~300 DPI no tamanho físico do QR. */
export const QR_EXPORT_DPI = 300

export async function qrPngBytesForCode(code, qrSizeCm, dpi = QR_EXPORT_DPI, destinationUrl) {
  const sizeCm = Number(qrSizeCm)
  const px = Math.max(128, Math.round((sizeCm / 2.54) * dpi))
  const payload = qrEncodeUrlForCard({ code, destinationUrl })
  const dataUrl = await QRCode.toDataURL(payload, {
    errorCorrectionLevel: 'M',
    margin: 1,
    width: px,
  })
  const res = await fetch(dataUrl)
  return new Uint8Array(await res.arrayBuffer())
}
