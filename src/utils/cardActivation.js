import { getNfcUserMessage, isNfcSupported, normalizeUid, scanAndWriteNfcUrl } from './nfc.js'
import { isCardActivated } from './cardStatus.js'
import { isValidHttpsUrl } from './validate.js'

export const CARD_FIELDS =
  'id, code, destination_url, activated_at, notes, nfc_url, nfc_uid, created_at, location_bairro_id, paused, annotation'

export { isCardActivated }

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

function resolveBairroId({ locationBairroId, existingBairroId }) {
  return locationBairroId ?? existingBairroId ?? null
}

function activationPatch({ wasActivated, bairroId, existingBairroId, locationBairroId }) {
  const patch = {}
  const effectiveBairro = resolveBairroId({ locationBairroId, existingBairroId: bairroId ?? existingBairroId })
  if (!wasActivated) {
    if (!effectiveBairro) {
      return { error: { message: 'Selecione ou crie um bairro antes de ativar.' } }
    }
    patch.activated_at = new Date().toISOString()
    patch.location_bairro_id = locationBairroId ?? effectiveBairro
  } else if (locationBairroId) {
    patch.location_bairro_id = locationBairroId
  }
  return { patch }
}

/** Salva link do QR (ativa se ainda virgem). */
export async function activateQr(
  supabase,
  cardId,
  destinationUrl,
  { locationBairroId, wasActivated, existingBairroId } = {},
) {
  const url = destinationUrl.trim()
  if (!url) {
    return { data: null, error: { message: 'Informe o link do QR.' } }
  }
  if (!isValidHttpsUrl(url)) {
    return { data: null, error: { message: 'O link do QR deve ser uma URL HTTPS válida.' } }
  }

  const { patch, error } = activationPatch({
    wasActivated,
    bairroId: existingBairroId,
    existingBairroId,
    locationBairroId,
  })
  if (error) return { data: null, error }

  return supabase
    .from('cards')
    .update({ destination_url: url, ...patch })
    .eq('id', cardId)
    .select(CARD_FIELDS)
    .single()
}

/** Salva link NFC no banco (sem gravar tag). Ativa se ainda virgem. */
export async function saveNfcUrlOnly(
  supabase,
  cardId,
  nfcUrl,
  { locationBairroId, wasActivated, existingBairroId } = {},
) {
  const url = nfcUrl.trim()
  if (!url) {
    return { data: null, error: { message: 'Informe o link NFC.' } }
  }
  if (!isValidHttpsUrl(url)) {
    return { data: null, error: { message: 'O link NFC deve ser uma URL HTTPS válida.' } }
  }

  const { patch, error } = activationPatch({
    wasActivated,
    bairroId: existingBairroId,
    existingBairroId,
    locationBairroId,
  })
  if (error) return { data: null, error }

  return supabase
    .from('cards')
    .update({ nfc_url: url, ...patch })
    .eq('id', cardId)
    .select(CARD_FIELDS)
    .single()
}

/** Grava tag NFC e persiste nfc_url + nfc_uid. Ativa se ainda virgem. */
export async function activateNfc(
  supabase,
  cardId,
  nfcUrl,
  { locationBairroId, wasActivated, existingBairroId } = {},
) {
  const url = nfcUrl.trim()
  if (!isValidHttpsUrl(url)) {
    return { data: null, error: { message: 'O link NFC deve ser uma URL HTTPS válida.' }, cancelled: false }
  }

  if (!isNfcSupported()) {
    return saveNfcUrlOnly(supabase, cardId, url, {
      locationBairroId,
      wasActivated,
      existingBairroId,
    }).then((result) => ({ ...result, cancelled: false, savedUrlOnly: true }))
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

  const { patch, error } = activationPatch({
    wasActivated,
    bairroId: existingBairroId,
    existingBairroId,
    locationBairroId,
  })
  if (error) return { data: null, error, cancelled: false }

  const result = await supabase
    .from('cards')
    .update({
      nfc_url: url,
      nfc_uid: normalizeUid(uid),
      ...patch,
    })
    .eq('id', cardId)
    .select(CARD_FIELDS)
    .single()

  return { ...result, cancelled: false }
}

/** Ativa/atualiza com QR e/ou NFC (pelo menos um link ao ativar pela 1ª vez). */
export async function activateComplete(
  supabase,
  cardId,
  { destinationUrl, nfcUrl, notes, locationBairroId, wasActivated, existingBairroId },
) {
  const qrTrimmed = destinationUrl.trim()
  const nfcTrimmed = nfcUrl.trim()

  if (!wasActivated && !qrTrimmed && !nfcTrimmed) {
    return {
      data: null,
      error: { message: 'Informe o link do QR e/ou o link NFC para ativar.' },
      step: 'validation',
    }
  }

  let card = null

  if (qrTrimmed) {
    const qrResult = await activateQr(supabase, cardId, qrTrimmed, {
      locationBairroId,
      wasActivated,
      existingBairroId,
    })
    if (qrResult.error) {
      return { data: null, error: qrResult.error, step: 'qr' }
    }
    card = qrResult.data
    wasActivated = isCardActivated(card)
  }

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

  if (!nfcTrimmed) {
    if (!card) {
      const { data, error } = await fetchCardById(supabase, cardId)
      if (error) return { data: null, error, step: 'load' }
      card = data
    }
    return { data: card, error: null, nfcSkipped: true }
  }

  const nfcResult = await activateNfc(supabase, cardId, nfcTrimmed, {
    locationBairroId,
    wasActivated,
    existingBairroId: card?.location_bairro_id ?? existingBairroId,
  })
  if (nfcResult.cancelled) {
    return { data: card ?? nfcResult.data, error: null, nfcCancelled: true }
  }
  if (nfcResult.error) {
    return { data: card, error: nfcResult.error, step: 'nfc' }
  }

  return { data: nfcResult.data, error: null, nfcSavedUrlOnly: Boolean(nfcResult.savedUrlOnly) }
}
