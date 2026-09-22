import { getNfcUserMessage, isNfcSupported, normalizeUid, scanAndWriteNfcUrl } from './nfc.js'
import { isValidHttpsUrl } from './validate.js'

const CARD_FIELDS =
  'id, code, destination_url, activated_at, notes, nfc_url, nfc_uid, batch_label, created_at'

export async function fetchCardById(supabase, id) {
  return supabase.from('cards').select(CARD_FIELDS).eq('id', id).single()
}

export async function lookupCardByNfcUid(supabase, uid) {
  const normalized = normalizeUid(uid)
  if (!normalized) return { data: null, error: null }
  return supabase
    .from('cards')
    .select('id, code, notes')
    .eq('nfc_uid', normalized)
    .maybeSingle()
}

export async function confirmNfcUidReuse(otherCard, currentCardId) {
  if (!otherCard || otherCard.id === currentCardId) {
    return true
  }
  const label = otherCard.notes?.trim() || otherCard.code
  return window.confirm(
    `Esta tag já está em uso: ${label}. Sobrescrever e associar a este card?`,
  )
}

export async function clearNfcFromCard(supabase, cardId) {
  return supabase
    .from('cards')
    .update({ nfc_uid: null, nfc_url: null })
    .eq('id', cardId)
}

/** Salva apenas destination_url (+ activated_at). */
export async function activateQr(supabase, cardId, destinationUrl) {
  const url = destinationUrl.trim()
  if (!isValidHttpsUrl(url)) {
    return { data: null, error: { message: 'O link do QR deve ser uma URL HTTPS válida.' } }
  }

  return supabase
    .from('cards')
    .update({
      destination_url: url,
      activated_at: new Date().toISOString(),
    })
    .eq('id', cardId)
    .select(CARD_FIELDS)
    .single()
}

/** Grava tag NFC e persiste nfc_url + nfc_uid. */
export async function activateNfc(supabase, cardId, nfcUrl) {
  const url = nfcUrl.trim()
  if (!isValidHttpsUrl(url)) {
    return { data: null, error: { message: 'O link NFC deve ser uma URL HTTPS válida.' }, cancelled: false }
  }

  if (!isNfcSupported()) {
    return {
      data: null,
      error: { message: getNfcUserMessage(new Error('UNSUPPORTED')) },
      cancelled: false,
      skipped: true,
    }
  }

  let uid
  try {
    uid = await scanAndWriteNfcUrl(url)
  } catch (err) {
    return { data: null, error: { message: getNfcUserMessage(err) }, cancelled: false }
  }

  const { data: other, error: lookupError } = await lookupCardByNfcUid(supabase, uid)
  if (lookupError) {
    return { data: null, error: lookupError, cancelled: false }
  }

  const ok = await confirmNfcUidReuse(other, cardId)
  if (!ok) {
    return { data: null, error: null, cancelled: true }
  }

  if (other && other.id !== cardId) {
    const { error: clearError } = await clearNfcFromCard(supabase, other.id)
    if (clearError) {
      return { data: null, error: clearError, cancelled: false }
    }
  }

  const result = await supabase
    .from('cards')
    .update({
      nfc_url: url,
      nfc_uid: normalizeUid(uid),
    })
    .eq('id', cardId)
    .select(CARD_FIELDS)
    .single()

  return { ...result, cancelled: false }
}

/** QR + notes no banco; NFC se link preenchido. */
export async function activateComplete(supabase, cardId, { destinationUrl, nfcUrl, notes }) {
  const qrResult = await activateQr(supabase, cardId, destinationUrl)
  if (qrResult.error) {
    return { data: null, error: qrResult.error, step: 'qr' }
  }

  let card = qrResult.data

  if (notes !== undefined) {
    const notesResult = await supabase
      .from('cards')
      .update({ notes: notes.trim() || null })
      .eq('id', cardId)
      .select(CARD_FIELDS)
      .single()
    if (notesResult.error) {
      return { data: card, error: notesResult.error, step: 'notes' }
    }
    card = notesResult.data
  }

  const nfcTrimmed = nfcUrl.trim()
  if (!nfcTrimmed) {
    return { data: card, error: null, nfcSkipped: true }
  }

  const nfcResult = await activateNfc(supabase, cardId, nfcTrimmed)
  if (nfcResult.cancelled) {
    return { data: card, error: null, nfcCancelled: true }
  }
  if (nfcResult.error) {
    return { data: card, error: nfcResult.error, step: 'nfc' }
  }

  return { data: nfcResult.data, error: null }
}
