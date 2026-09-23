function triggerDownload(blob, filename) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

export async function downloadQrCodesZip(entries) {
  const JSZip = (await import('jszip')).default
  const zip = new JSZip()
  for (const { filename, content } of entries) {
    zip.file(filename, content)
  }
  const blob = await zip.generateAsync({ type: 'blob' })
  triggerDownload(blob, 'QR codes.zip')
}
