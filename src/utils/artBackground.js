import { ART_PDF_EXPORT_SCALE } from '../lib/config.js'
import { fetchArtFileBytes } from './artSessionApi.js'
import { renderPdfPageToPngBytes } from './artPdfRender.js'

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = reject
    img.src = src
  })
}

async function rasterizeImage(img) {
  const canvas = document.createElement('canvas')
  canvas.width = img.naturalWidth || img.width
  canvas.height = img.naturalHeight || img.height
  canvas.getContext('2d').drawImage(img, 0, 0)
  const blob = await new Promise((resolve, reject) => {
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Falha ao rasterizar imagem'))), 'image/png')
  })
  return new Uint8Array(await blob.arrayBuffer())
}

/** PNG da arte (fundo) para composição PDF/SVG. */
export async function getBackgroundPngBytes(session) {
  const bytes = await fetchArtFileBytes(session.file_path)
  if (session.file_mime === 'application/pdf') {
    return renderPdfPageToPngBytes(bytes.buffer, ART_PDF_EXPORT_SCALE)
  }
  if (session.file_mime === 'image/png') {
    return bytes
  }
  if (session.file_mime === 'image/jpeg') {
    const url = URL.createObjectURL(new Blob([bytes], { type: 'image/jpeg' }))
    try {
      const img = await loadImage(url)
      return rasterizeImage(img)
    } finally {
      URL.revokeObjectURL(url)
    }
  }
  if (session.file_mime === 'image/svg+xml') {
    const text = new TextDecoder().decode(bytes)
    const url = URL.createObjectURL(new Blob([text], { type: 'image/svg+xml' }))
    try {
      const img = await loadImage(url)
      return rasterizeImage(img)
    } finally {
      URL.revokeObjectURL(url)
    }
  }
  throw new Error('Formato de arte não suportado.')
}

export function pngBytesToBase64(pngBytes) {
  let binary = ''
  const chunk = 0x8000
  for (let i = 0; i < pngBytes.length; i += chunk) {
    binary += String.fromCharCode.apply(null, pngBytes.subarray(i, i + chunk))
  }
  return btoa(binary)
}
