import { getPdfPageSizeCm } from './artPdfRender.js'

export async function detectArtAspectRatio(file) {
  if (file.type === 'application/pdf') {
    const buf = await file.arrayBuffer()
    const size = await getPdfPageSizeCm(buf)
    return size.widthCm / size.heightCm
  }

  if (file.type === 'image/svg+xml') {
    const text = await file.text()
    const wMatch = text.match(/width="([\d.]+)/)
    const hMatch = text.match(/height="([\d.]+)/)
    if (wMatch && hMatch) {
      return Number(wMatch[1]) / Number(hMatch[1])
    }
    const viewBox = text.match(/viewBox="[\d.\s]+([\d.]+)\s+([\d.]+)"/)
    if (viewBox) {
      return Number(viewBox[1]) / Number(viewBox[2])
    }
  }

  const url = URL.createObjectURL(file)
  try {
    const img = await loadImage(url)
    const w = img.naturalWidth || img.width
    const h = img.naturalHeight || img.height
    if (!w || !h) return null
    return w / h
  } finally {
    URL.revokeObjectURL(url)
  }
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = reject
    img.src = src
  })
}

export function heightCmFromWidth(widthCm, aspectRatio) {
  if (!aspectRatio || !widthCm) return null
  return Number(widthCm) / Number(aspectRatio)
}

export function widthCmFromHeight(heightCm, aspectRatio) {
  if (!aspectRatio || !heightCm) return null
  return Number(heightCm) * Number(aspectRatio)
}
