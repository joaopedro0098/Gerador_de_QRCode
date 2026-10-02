function triggerDownload(blob, filename) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

export async function downloadQrCodesZip(entries, zipFilename = 'QR codes.zip') {
  const JSZip = (await import('jszip')).default
  const zip = new JSZip()
  for (const { filename, content } of entries) {
    zip.file(filename, content)
  }
  const blob = await zip.generateAsync({ type: 'blob' })
  triggerDownload(blob, zipFilename)
}

/** Um arquivo direto; vários → ZIP. */
export async function downloadArtEntries(entries, { zipFilename, mimeType }) {
  if (!entries.length) return
  if (entries.length === 1) {
    const { filename, content } = entries[0]
    triggerDownload(new Blob([content], { type: mimeType }), filename)
    return
  }
  await downloadQrCodesZip(entries, zipFilename)
}
