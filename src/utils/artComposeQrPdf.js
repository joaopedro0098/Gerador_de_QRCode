import { PDFDocument } from 'pdf-lib'
import { cmToPt } from './artUnits.js'
import { qrPngBytesForCode } from './artQrRaster.js'

/** PDF quadrado só com o QR code (~300 DPI). */
export async function composeQrOnlyPdf(code, qrSizeCm) {
  const sizeCm = Number(qrSizeCm)
  const pagePt = cmToPt(sizeCm)
  const pdfDoc = await PDFDocument.create()
  const page = pdfDoc.addPage([pagePt, pagePt])

  const qrBytes = await qrPngBytesForCode(code, sizeCm)
  const qrImage = await pdfDoc.embedPng(qrBytes)
  page.drawImage(qrImage, { x: 0, y: 0, width: pagePt, height: pagePt })

  return pdfDoc.save()
}
