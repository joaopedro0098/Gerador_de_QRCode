import { getNfcUserMessage, isNfcSupported, normalizeUid } from './nfc.js'
import { isCardActivated } from './cardStatus.js'
import { ensureShortLinkForCard } from './shortLinks.js'
import { isValidHttpsUrl } from './validate.js'

export const CARD_FIELDS =
  'id, code, destination_url, activated_at, notes, nfc_url, nfc_uid, short_code, created_at, location_bairro_id, paused, annotation'

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
  { locationBairroId, wasActivated, existingBairroId, storedShortCode = null } = {},
) {
  const url = nfcUrl.trim()
  if (!url) {
    return { data: null, error: { message: 'Informe o link NFC.' } }
  }
  if (!isValidHttpsUrl(url)) {
    return { data: null, error: { message: 'O link NFC deve ser uma URL HTTPS válida.' } }
  }

  const short = await ensureShortLinkForCard(supabase, cardId, url, storedShortCode)
  if (short.error) {
    return { data: null, error: short.error }
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
    .update({ nfc_url: url, short_code: short.code, ...patch })
    .eq('id', cardId)
    .select(CARD_FIELDS)
    .single()
}

/** Tag física só precisa ser gravada se ainda não há UID (destino muda via short_links). */
export function isNfcTagWriteRequired(storedCard, nfcUrl) {
  const url = nfcUrl.trim()
  if (!url || !isValidHttpsUrl(url)) return false
  if (!isNfcSupported()) return false
  return !storedCard?.nfc_uid?.trim()
}

/** Grava tag NFC e persiste nfc_url + nfc_uid. Ativa se ainda virgem. */
export async function activateNfc(
  supabase,
  cardId,
  nfcUrl,
  {
    locationBairroId,
    wasActivated,
    existingBairroId,
    nfcWriteSession = null,
    shortUrlPromise = null,
    storedNfcUrl = null,
    storedNfcUid = null,
    storedShortCode = null,
  } = {},
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
      storedShortCode,
    }).then((result) => ({ ...result, cancelled: false, savedUrlOnly: true }))
  }

  const storedCard = { nfc_url: storedNfcUrl, nfc_uid: storedNfcUid }
  if (!isNfcTagWriteRequired(storedCard, url)) {
    nfcWriteSession?.abort()
    return saveNfcUrlOnly(supabase, cardId, url, {
      locationBairroId,
      wasActivated,
      existingBairroId,
      storedShortCode,
    }).then((result) => ({ ...result, cancelled: false, hardwareSkipped: true }))
  }

  let shortCode = storedShortCode?.trim() || null

  let uid
  try {
    if (!nfcWriteSession) {
      return {
        data: null,
        error: {
          message:
            'Toque Salvar no NFC de novo e encoste a tag quando aparecer «Aproxime a tag…».',
        },
        cancelled: false,
      }
    }
    if (shortUrlPromise) {
      await shortUrlPromise
      if (!shortCode) {
        const { data: row } = await supabase
          .from('cards')
          .select('short_code')
          .eq('id', cardId)
          .single()
        shortCode = row?.short_code?.trim() || null
      }
    }
    uid = await nfcWriteSession.waitForWrite()
  } catch (err) {
    nfcWriteSession?.abort()
    return {
      data: null,
      error: { message: getNfcUserMessage(err) },
      cancelled: false,
    }
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

  if (!shortCode) {
    const short = await ensureShortLinkForCard(supabase, cardId, url, null)
    if (short.error) {
      return { data: null, error: short.error, cancelled: false }
    }
    shortCode = short.code
  }

  const result = await supabase
    .from('cards')
    .update({
      nfc_url: url,
      nfc_uid: normalizeUid(uid),
      short_code: shortCode,
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
  {
    destinationUrl,
    nfcUrl,
    notes,
    locationBairroId,
    wasActivated,
    existingBairroId,
    nfcWriteSession = null,
    shortUrlPromise = null,
    storedNfcUrl = null,
    storedNfcUid = null,
    storedShortCode = null,
  },
) {
  const qrTrimmed = destinationUrl.trim()
  const nfcTrimmed = nfcUrl.trim()
  let activated = wasActivated

  if (!activated && !qrTrimmed && !nfcTrimmed) {
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
      wasActivated: activated,
      existingBairroId,
    })
    if (qrResult.error) {
      return { data: null, error: qrResult.error, step: 'qr' }
    }
    card = qrResult.data
    activated = isCardActivated(card)
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
    wasActivated: activated,
    existingBairroId: card?.location_bairro_id ?? existingBairroId,
    nfcWriteSession,
    shortUrlPromise,
    storedNfcUrl: card?.nfc_url ?? storedNfcUrl,
    storedNfcUid: card?.nfc_uid ?? storedNfcUid,
    storedShortCode: card?.short_code ?? storedShortCode,
  })
  if (nfcResult.cancelled) {
    return { data: card ?? nfcResult.data, error: null, nfcCancelled: true }
  }
  if (nfcResult.error) {
    return { data: card, error: nfcResult.error, step: 'nfc' }
  }

  return { data: nfcResult.data, error: null, nfcSavedUrlOnly: Boolean(nfcResult.savedUrlOnly) }
}
