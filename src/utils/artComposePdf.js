import { PDFDocument } from 'pdf-lib'
import QRCode from 'qrcode'
import { cardPublicUrl } from './qr.js'
import { cmToPt } from './artUnits.js'
import { getBackgroundPngBytes } from './artBackground.js'

async function embedBackground(pdfDoc, session) {
  const png = await getBackgroundPngBytes(session)
  return pdfDoc.embedPng(png)
}

async function qrPngBytes(text) {
  const dataUrl = await QRCode.toDataURL(text, {
    errorCorrectionLevel: 'M',
    margin: 0,
    width: 512,
  })
  const res = await fetch(dataUrl)
  return new Uint8Array(await res.arrayBuffer())
}

/** PDF com arte da sessão + QR do card. */
export async function composeVirginCardPdf(session, code) {
  const pageW = cmToPt(session.card_width_cm)
  const pageH = cmToPt(session.card_height_cm)
  const pdfDoc = await PDFDocument.create()
  const page = pdfDoc.addPage([pageW, pageH])

  const bgImage = await embedBackground(pdfDoc, session)
  page.drawImage(bgImage, { x: 0, y: 0, width: pageW, height: pageH })

  const qrBytes = await qrPngBytes(cardPublicUrl(code))
  const qrImage = await pdfDoc.embedPng(qrBytes)
  const qrSize = cmToPt(session.qr_size_cm)
  const qrX = cmToPt(session.qr_x_cm)
  const qrY = pageH - cmToPt(session.qr_y_cm) - qrSize

  page.drawImage(qrImage, { x: qrX, y: qrY, width: qrSize, height: qrSize })

  return pdfDoc.save()
}
