import { ART_DOWNLOAD_MAX } from '../lib/config.js'

export function normalizeDownloadList(cardsToRender) {
  return Array.isArray(cardsToRender) ? cardsToRender : [cardsToRender]
}

export function assertDownloadWithinLimit(list) {
  if (list.length > ART_DOWNLOAD_MAX) {
    throw new Error(`No máximo ${ART_DOWNLOAD_MAX} downloads por vez.`)
  }
}
