import { qrSvgForCode } from './qr.js'
import { resolveArtRectCm } from './artUnits.js'
import { getBackgroundPngBytes, pngBytesToBase64 } from './artBackground.js'

function stripSvgOuter(svg) {
  const match = svg.match(/<svg[^>]*>([\s\S]*)<\/svg>/i)
  return match ? match[1].trim() : svg
}

function qrViewBox(svg) {
  const match = svg.match(/viewBox="([^"]+)"/i)
  return match ? match[1] : '0 0 256 256'
}

/** SVG com arte da sessão + QR do card (mesma posição do PDF). */
export async function composeVirginCardSvg(session, code, { pdfRenderScale } = {}) {
  const w = Number(session.card_width_cm)
  const h = Number(session.card_height_cm)
  const qrX = Number(session.qr_x_cm)
  const qrY = Number(session.qr_y_cm)
  const qrS = Number(session.qr_size_cm)

  const art = resolveArtRectCm(session)
  const pngBytes = await getBackgroundPngBytes(session, pdfRenderScale)
  const b64 = pngBytesToBase64(pngBytes)
  const qrSvg = await qrSvgForCode(code)
  const qrInner = stripSvgOuter(qrSvg)
  const viewBox = qrViewBox(qrSvg)

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${w}cm" height="${h}cm" viewBox="0 0 ${w} ${h}">
  <rect x="0" y="0" width="${w}" height="${h}" fill="#ffffff"/>
  <image xlink:href="data:image/png;base64,${b64}" href="data:image/png;base64,${b64}" x="${art.art_x_cm}" y="${art.art_y_cm}" width="${art.art_width_cm}" height="${art.art_height_cm}" preserveAspectRatio="none"/>
  <svg x="${qrX}" y="${qrY}" width="${qrS}" height="${qrS}" viewBox="${viewBox}" preserveAspectRatio="xMidYMid meet">
    ${qrInner}
  </svg>
</svg>`
}
