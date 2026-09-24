import { useCallback, useEffect, useRef, useState } from 'react'
import ArtCanvasEditor from './ArtCanvasEditor.jsx'
import ArtInsertModal from './ArtInsertModal.jsx'
import { detectArtAspectRatio, heightCmFromWidth, widthCmFromHeight } from '../../../utils/artMedia.js'
import { ART_DEFAULT_QR_SIZE_CM, ART_QR_DEFAULT_MARGIN_CM } from '../../../lib/config.js'
import { defaultQrPlacementBottomRight } from '../../../utils/artUnits.js'
import {
  deleteArtSession,
  getArtSignedUrl,
  updateArtSession,
  uploadArtSessionFile,
} from '../../../utils/artSessionApi.js'

const ACCEPT = '.jpg,.jpeg,.png,.svg,.pdf,image/jpeg,image/png,image/svg+xml,application/pdf'

export default function ArtSessionCard({ session, onSessionUpdated, onDeleted }) {
  const [local, setLocal] = useState(session)
  const [previewUrl, setPreviewUrl] = useState(null)
  const [pendingDims, setPendingDims] = useState({ w: '8.5', h: '5.5' })
  const [qrDraft, setQrDraft] = useState({ x: '', y: '', size: '' })
  const [cardDraft, setCardDraft] = useState({ w: '', h: '' })
  const [uploading, setUploading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  const [insertOpen, setInsertOpen] = useState(false)
  const saveTimer = useRef(null)
  const previewPathRef = useRef(null)

  useEffect(() => {
    setLocal(session)
  }, [session.id])

  useEffect(() => {
    syncDraftsFromLocal(local)
  }, [local?.qr_x_cm, local?.qr_y_cm, local?.qr_size_cm, local?.card_width_cm, local?.card_height_cm])

  function syncDraftsFromLocal(data) {
    if (!data) return
    setQrDraft({
      x: data.qr_x_cm != null ? String(data.qr_x_cm) : '',
      y: data.qr_y_cm != null ? String(data.qr_y_cm) : '',
      size: data.qr_size_cm != null ? String(data.qr_size_cm) : '',
    })
    setCardDraft({
      w: data.card_width_cm != null ? String(data.card_width_cm) : '',
      h: data.card_height_cm != null ? String(data.card_height_cm) : '',
    })
  }

  useEffect(() => {
    if (!local?.file_path) {
      setPreviewUrl(null)
      previewPathRef.current = null
      return
    }
    if (previewPathRef.current === local.file_path) return
    let cancelled = false
    getArtSignedUrl(local.file_path).then(({ data }) => {
      if (cancelled) return
      previewPathRef.current = local.file_path
      setPreviewUrl(data?.signedUrl ?? null)
    })
    return () => {
      cancelled = true
    }
  }, [local?.file_path])

  const persistSession = useCallback(
    (payload, { silent = true } = {}) => {
      if (saveTimer.current) clearTimeout(saveTimer.current)
      saveTimer.current = setTimeout(async () => {
        setSaving(!silent)
        const { data, error: err } = await updateArtSession(local.id, payload)
        setSaving(false)
        if (err) {
          setError(err.message)
          return
        }
        if (data) {
          setLocal(data)
          onSessionUpdated?.(data)
        }
      }, silent ? 400 : 0)
    },
    [local.id, onSessionUpdated],
  )

  const needsDimensions =
    local?.file_path && (local.card_width_cm == null || local.card_height_cm == null)

  const isReady =
    local?.file_path &&
    local.card_width_cm != null &&
    local.qr_x_cm != null

  async function handleFile(file) {
    if (!file || local.file_path) return
    setError(null)
    setUploading(true)
    const aspect = await detectArtAspectRatio(file)
    const { data, error: err } = await uploadArtSessionFile(local.id, file)
    if (err) {
      setUploading(false)
      setError(err.message)
      return
    }
    let next = data
    if (aspect && data?.file_mime !== 'application/pdf') {
      const { data: withAspect, error: aspectErr } = await updateArtSession(local.id, {
        art_aspect_ratio: aspect,
      })
      if (!aspectErr && withAspect) next = withAspect
    }
    setUploading(false)
    setLocal(next)
    onSessionUpdated?.(next)
    if (aspect && next?.file_mime !== 'application/pdf') {
      const h = heightCmFromWidth(pendingDims.w, aspect)
      if (h) setPendingDims((p) => ({ ...p, h: String(Number(h.toFixed(2))) }))
    }
  }

  async function handleSaveDimensions() {
    const w = Number(pendingDims.w.replace(',', '.'))
    const h = Number(pendingDims.h.replace(',', '.'))
    if (!w || !h || w <= 0 || h <= 0) {
      setError('Informe largura e altura válidas em cm.')
      return
    }
    setSaving(true)
    const qr = defaultQrPlacementBottomRight(
      w,
      h,
      ART_DEFAULT_QR_SIZE_CM,
      ART_QR_DEFAULT_MARGIN_CM,
    )
    const { data, error: err } = await updateArtSession(local.id, {
      card_width_cm: w,
      card_height_cm: h,
      art_aspect_ratio: local.art_aspect_ratio ?? w / h,
      ...qr,
    })
    setSaving(false)
    if (err) {
      setError(err.message)
      return
    }
    setLocal(data)
    onSessionUpdated?.(data)
  }

  function handleQrChange(qrFields) {
    setLocal((prev) => {
      const next = { ...prev, ...qrFields }
      syncDraftsFromLocal(next)
      return next
    })
    persistSession(qrFields)
  }

  function handleCardSizeChange(sizeFields) {
    setLocal((prev) => ({ ...prev, ...sizeFields }))
    setCardDraft({
      w: String(sizeFields.card_width_cm),
      h: String(sizeFields.card_height_cm),
    })
    persistSession(sizeFields)
  }

  function handlePendingWidthChange(w) {
    setPendingDims((p) => {
      const next = { ...p, w }
      const aspect = local.art_aspect_ratio
      if (aspect) {
        const h = heightCmFromWidth(w.replace(',', '.'), aspect)
        if (h) next.h = String(Number(h.toFixed(2)))
      }
      return next
    })
  }

  function handlePendingHeightChange(h) {
    setPendingDims((p) => {
      const next = { ...p, h }
      const aspect = local.art_aspect_ratio
      if (aspect) {
        const w = widthCmFromHeight(h.replace(',', '.'), aspect)
        if (w) next.w = String(Number(w.toFixed(2)))
      }
      return next
    })
  }

  function commitQrDraftField(field) {
    const raw = qrDraft[field].replace(',', '.')
    const num = Number(raw)
    if (raw === '' || Number.isNaN(num)) return
    handleQrChange({
      qr_x_cm: field === 'x' ? num : Number(local.qr_x_cm),
      qr_y_cm: field === 'y' ? num : Number(local.qr_y_cm),
      qr_size_cm: field === 'size' ? num : Number(local.qr_size_cm),
    })
  }

  function commitCardDraftField(field) {
    const w = Number(cardDraft.w.replace(',', '.'))
    const h = Number(cardDraft.h.replace(',', '.'))
    if (Number.isNaN(w) || Number.isNaN(h) || w <= 0 || h <= 0) return
    handleCardSizeChange({ card_width_cm: w, card_height_cm: h })
  }

  async function handleDelete() {
    if (!window.confirm('Excluir esta sessão de arte?')) return
    const { error: err } = await deleteArtSession(local)
    if (err) {
      setError(err.message)
      return
    }
    onDeleted(local.id)
  }

  return (
    <article className="art-session-card">
      <header className="art-session-header">
        <span className="muted">
          Sessão · {new Date(local.created_at).toLocaleString('pt-BR')}
        </span>
        <button type="button" className="btn secondary small danger" onClick={handleDelete}>
          Excluir sessão
        </button>
      </header>

      {!local.file_path && (
        <label className="art-upload-label">
          <span>Enviar arte (PDF, SVG, JPG ou PNG — uma vez)</span>
          <input
            type="file"
            accept={ACCEPT}
            disabled={uploading}
            onChange={(e) => handleFile(e.target.files?.[0])}
          />
        </label>
      )}

      {uploading && <p className="muted">Enviando…</p>}

      {needsDimensions && (
        <div className="art-dims-pending stack-form">
          <p className="form-hint">
            Informe o tamanho físico do card em cm (altura ajusta pela proporção da imagem):
          </p>
          <label>
            Largura (cm)
            <input
              type="text"
              inputMode="decimal"
              value={pendingDims.w}
              onChange={(e) => handlePendingWidthChange(e.target.value)}
            />
          </label>
          <label>
            Altura (cm)
            <input
              type="text"
              inputMode="decimal"
              value={pendingDims.h}
              onChange={(e) => handlePendingHeightChange(e.target.value)}
            />
          </label>
          <button type="button" className="btn primary" onClick={handleSaveDimensions} disabled={saving}>
            Confirmar dimensões
          </button>
        </div>
      )}

      {isReady && previewUrl && (
        <>
          <ArtCanvasEditor
            session={local}
            previewUrl={previewUrl}
            onQrChange={handleQrChange}
            onCardSizeChange={handleCardSizeChange}
          />
          <div className="art-cm-fields">
            <label>
              Card largura (cm)
              <input
                type="text"
                inputMode="decimal"
                value={cardDraft.w}
                onChange={(e) => setCardDraft((d) => ({ ...d, w: e.target.value }))}
                onBlur={() => commitCardDraftField('w')}
              />
            </label>
            <label>
              Card altura (cm)
              <input
                type="text"
                inputMode="decimal"
                value={cardDraft.h}
                onChange={(e) => setCardDraft((d) => ({ ...d, h: e.target.value }))}
                onBlur={() => commitCardDraftField('h')}
              />
            </label>
            <label>
              QR X (cm)
              <input
                type="text"
                inputMode="decimal"
                value={qrDraft.x}
                onChange={(e) => setQrDraft((d) => ({ ...d, x: e.target.value }))}
                onBlur={() => commitQrDraftField('x')}
              />
            </label>
            <label>
              QR Y (cm)
              <input
                type="text"
                inputMode="decimal"
                value={qrDraft.y}
                onChange={(e) => setQrDraft((d) => ({ ...d, y: e.target.value }))}
                onBlur={() => commitQrDraftField('y')}
              />
            </label>
            <label>
              QR tamanho (cm)
              <input
                type="text"
                inputMode="decimal"
                value={qrDraft.size}
                onChange={(e) => setQrDraft((d) => ({ ...d, size: e.target.value }))}
                onBlur={() => commitQrDraftField('size')}
              />
            </label>
          </div>
          {saving && <p className="muted">Salvando…</p>}
          <button type="button" className="btn primary" onClick={() => setInsertOpen(true)}>
            Inserir QR code
          </button>
        </>
      )}

      {error && <p className="form-hint error">{error}</p>}

      {insertOpen && (
        <ArtInsertModal session={local} onClose={() => setInsertOpen(false)} />
      )}
    </article>
  )
}
