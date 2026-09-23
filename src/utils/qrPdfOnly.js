import { PDFDocument } from 'pdf-lib'
import QRCode from 'qrcode'
import { ART_ACTIVE_QR_PDF_SIZE_CM } from '../lib/config.js'
import { cardPublicUrl } from './qr.js'
import { cmToPt } from './artUnits.js'

function triggerDownload(bytes, filename) {
  const blob = new Blob([bytes], { type: 'application/pdf' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

export async function downloadActiveQrPdf(code) {
  const sizePt = cmToPt(ART_ACTIVE_QR_PDF_SIZE_CM)
  const pdfDoc = await PDFDocument.create()
  const page = pdfDoc.addPage([sizePt, sizePt])

  const dataUrl = await QRCode.toDataURL(cardPublicUrl(code), {
    errorCorrectionLevel: 'M',
    margin: 1,
    width: 800,
  })
  const pngBytes = new Uint8Array(await (await fetch(dataUrl)).arrayBuffer())
  const qrImage = await pdfDoc.embedPng(pngBytes)
  const padding = sizePt * 0.08
  const drawSize = sizePt - padding * 2
  page.drawImage(qrImage, {
    x: padding,
    y: padding,
    width: drawSize,
    height: drawSize,
  })

  const bytes = await pdfDoc.save()
  triggerDownload(bytes, `${code}-qr.pdf`)
}
