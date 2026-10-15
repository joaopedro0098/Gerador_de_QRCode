export const PLACE_ID_FINDER_URL =
  'https://developers.google.com/maps/documentation/javascript/examples/places-placeid-finder'

const GOOGLE_WRITE_REVIEW_BASE = 'https://search.google.com/local/writereview'

/** Link de avaliação no Google Maps a partir do Place ID. */
export function buildLinkFromPlaceId(placeIdRaw) {
  const id = String(placeIdRaw ?? '').trim()
  if (!id) return null
  const url = new URL(GOOGLE_WRITE_REVIEW_BASE)
  url.searchParams.set('placeid', id)
  return url.toString()
}
