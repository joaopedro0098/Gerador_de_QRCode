import { PDFDocument } from 'pdf-lib'
import QRCode from 'qrcode'
import { ART_PDF_EXPORT_SCALE } from '../lib/config.js'
import { cardPublicUrl } from './qr.js'
import { cmToPt } from './artUnits.js'
import { fetchArtFileBytes } from './artSessionApi.js'
import { renderPdfPageToPngBytes } from './artPdfRender.js'

async function embedBackground(pdfDoc, session, pageW, pageH) {
  const bytes = await fetchArtFileBytes(session.file_path)
  let image
  if (session.file_mime === 'application/pdf') {
    const png = await renderPdfPageToPngBytes(bytes.buffer, ART_PDF_EXPORT_SCALE)
    image = await pdfDoc.embedPng(png)
  } else if (session.file_mime === 'image/jpeg') {
    image = await pdfDoc.embedJpg(bytes)
  } else if (session.file_mime === 'image/png') {
    image = await pdfDoc.embedPng(bytes)
  } else if (session.file_mime === 'image/svg+xml') {
    const text = new TextDecoder().decode(bytes)
    const blob = new Blob([text], { type: 'image/svg+xml' })
    const url = URL.createObjectURL(blob)
    try {
      const img = await loadImage(url)
      const png = await rasterizeImage(img)
      image = await pdfDoc.embedPng(png)
    } finally {
      URL.revokeObjectURL(url)
    }
  } else {
    throw new Error('Formato de arte não suportado.')
  }
  return image
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = reject
    img.src = src
  })
}

function rasterizeImage(img) {
  const canvas = document.createElement('canvas')
  canvas.width = img.naturalWidth || img.width
  canvas.height = img.naturalHeight || img.height
  canvas.getContext('2d').drawImage(img, 0, 0)
  return new Promise((resolve, reject) => {
    canvas.toBlob(async (blob) => {
      if (!blob) reject(new Error('Falha ao rasterizar imagem'))
      else resolve(new Uint8Array(await blob.arrayBuffer()))
    }, 'image/png')
  })
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

  const bgImage = await embedBackground(pdfDoc, session, pageW, pageH)
  page.drawImage(bgImage, { x: 0, y: 0, width: pageW, height: pageH })

  const qrBytes = await qrPngBytes(cardPublicUrl(code))
  const qrImage = await pdfDoc.embedPng(qrBytes)
  const qrSize = cmToPt(session.qr_size_cm)
  const qrX = cmToPt(session.qr_x_cm)
  const qrY = pageH - cmToPt(session.qr_y_cm) - qrSize

  page.drawImage(qrImage, { x: qrX, y: qrY, width: qrSize, height: qrSize })

  return pdfDoc.save()
}
