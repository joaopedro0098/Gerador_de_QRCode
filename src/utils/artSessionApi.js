import {
  ART_BUCKET,
  ART_DEFAULT_QR_SIZE_CM,
  ART_QR_DEFAULT_MARGIN_CM,
} from '../lib/config.js'
import { supabase } from '../lib/supabase.js'
import { defaultQrPlacementBottomRight } from './artUnits.js'
import { getPdfPageSizeCm } from './artPdfRender.js'

const SESSION_FIELDS =
  'id, file_path, file_mime, card_width_cm, card_height_cm, qr_x_cm, qr_y_cm, qr_size_cm, created_at, updated_at'

export async function listArtSessions() {
  return supabase.from('art_sessions').select(SESSION_FIELDS).order('created_at', { ascending: true })
}

export async function createArtSession() {
  return supabase.from('art_sessions').insert({}).select(SESSION_FIELDS).single()
}

export async function updateArtSession(id, payload) {
  return supabase
    .from('art_sessions')
    .update({ ...payload, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select(SESSION_FIELDS)
    .single()
}

export async function deleteArtSession(session) {
  if (session.file_path) {
    await supabase.storage.from(ART_BUCKET).remove([session.file_path])
  }
  return supabase.from('art_sessions').delete().eq('id', session.id)
}

export async function getArtSignedUrl(filePath, expiresIn = 3600) {
  return supabase.storage.from(ART_BUCKET).createSignedUrl(filePath, expiresIn)
}

function extensionForMime(mime) {
  if (mime === 'image/jpeg') return 'jpg'
  if (mime === 'image/png') return 'png'
  if (mime === 'image/svg+xml') return 'svg'
  if (mime === 'application/pdf') return 'pdf'
  return 'bin'
}

export async function uploadArtSessionFile(sessionId, file) {
  const ext = extensionForMime(file.type)
  const path = `sessions/${sessionId}/original.${ext}`

  const { error: uploadError } = await supabase.storage.from(ART_BUCKET).upload(path, file, {
    upsert: true,
    contentType: file.type,
  })
  if (uploadError) {
    return { data: null, error: uploadError }
  }

  if (file.type === 'application/pdf') {
    const buf = await file.arrayBuffer()
    const size = await getPdfPageSizeCm(buf)
    const qr = defaultQrPlacementBottomRight(
      size.widthCm,
      size.heightCm,
      ART_DEFAULT_QR_SIZE_CM,
      ART_QR_DEFAULT_MARGIN_CM,
    )
    return updateArtSession(sessionId, {
      file_path: path,
      file_mime: file.type,
      card_width_cm: size.widthCm,
      card_height_cm: size.heightCm,
      qr_x_cm: qr.qr_x_cm,
      qr_y_cm: qr.qr_y_cm,
      qr_size_cm: qr.qr_size_cm,
    })
  }

  return updateArtSession(sessionId, {
    file_path: path,
    file_mime: file.type,
  })
}

export async function finalizeArtSessionDimensions(sessionId, cardWidthCm, cardHeightCm) {
  const qr = defaultQrPlacementBottomRight(
    cardWidthCm,
    cardHeightCm,
    ART_DEFAULT_QR_SIZE_CM,
    ART_QR_DEFAULT_MARGIN_CM,
  )
  return updateArtSession(sessionId, {
    card_width_cm: cardWidthCm,
    card_height_cm: cardHeightCm,
    qr_x_cm: qr.qr_x_cm,
    qr_y_cm: qr.qr_y_cm,
    qr_size_cm: qr.qr_size_cm,
  })
}

export async function fetchArtFileBytes(filePath) {
  const { data, error } = await supabase.storage.from(ART_BUCKET).download(filePath)
  if (error) throw error
  return new Uint8Array(await data.arrayBuffer())
}
