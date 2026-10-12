import { ART_DEFAULT_QR_SIZE_CM, ART_DOWNLOAD_MAX } from '../lib/config.js'
import { composeQrOnlyPdf } from './artComposeQrPdf.js'
import { normalizeDownloadList } from './artDownloadLimit.js'
import { downloadQrCodesZip } from './artZipDownload.js'

const ZIP_BATCH_DELAY_MS = 350

export function resolveQrSizeCmForDownload() {
  return ART_DEFAULT_QR_SIZE_CM
}

function zipFilenameForBatch(batchIndex, batchCount) {
  if (batchCount <= 1) return 'qrcodes-pdf.zip'
  return `qrcodes-pdf-${batchIndex + 1}-de-${batchCount}.zip`
}

/** Gera um ou mais ZIPs (máx. ART_DOWNLOAD_MAX PDFs por arquivo). */
export async function downloadQrOnlyPdfZip(cards, qrSizeCm, { onProgress } = {}) {
  const size = Number(qrSizeCm)
  const effectiveSize = Number.isFinite(size) && size > 0 ? size : ART_DEFAULT_QR_SIZE_CM
  const list = normalizeDownloadList(cards)
  if (!list.length) return

  const batchCount = Math.ceil(list.length / ART_DOWNLOAD_MAX)

  for (let batch = 0; batch < batchCount; batch++) {
    const start = batch * ART_DOWNLOAD_MAX
    const chunk = list.slice(start, start + ART_DOWNLOAD_MAX)
    const entries = []

    for (let i = 0; i < chunk.length; i++) {
      const overall = start + i + 1
      onProgress?.(`Gerando QR PDF ${overall} de ${list.length}…`)
      const pdfBytes = await composeQrOnlyPdf(chunk[i].code, effectiveSize)
      entries.push({ filename: `${chunk[i].code}.pdf`, content: pdfBytes })
    }

    onProgress?.(
      batchCount > 1
        ? `Compactando ZIP ${batch + 1} de ${batchCount}…`
        : 'Compactando…',
    )
    await downloadQrCodesZip(entries, zipFilenameForBatch(batch, batchCount))

    if (batch < batchCount - 1) {
      await new Promise((resolve) => window.setTimeout(resolve, ZIP_BATCH_DELAY_MS))
    }
  }

  onProgress?.('')
}
