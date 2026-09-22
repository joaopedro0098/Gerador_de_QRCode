function triggerDownload(blob, filename) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

export function downloadTextFile(content, filename, mime = 'text/plain;charset=utf-8') {
  triggerDownload(new Blob([content], { type: mime }), filename)
}

export function downloadSvgString(svg, filename) {
  triggerDownload(new Blob([svg], { type: 'image/svg+xml' }), filename)
}

export async function downloadSvgZip(entries, zipFilename) {
  const JSZip = (await import('jszip')).default
  const zip = new JSZip()

  for (const { filename, content } of entries) {
    zip.file(filename, content)
  }

  const blob = await zip.generateAsync({ type: 'blob' })
  triggerDownload(blob, zipFilename)
}
