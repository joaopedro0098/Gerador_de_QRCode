import { useEffect, useState } from 'react'
import ArtCanvasEditor from './ArtCanvasEditor.jsx'
import ArtInsertModal from './ArtInsertModal.jsx'
import {
  deleteArtSession,
  finalizeArtSessionDimensions,
  getArtSignedUrl,
  updateArtSession,
  uploadArtSessionFile,
} from '../../../utils/artSessionApi.js'

const ACCEPT = '.jpg,.jpeg,.png,.svg,.pdf,image/jpeg,image/png,image/svg+xml,application/pdf'

export default function ArtSessionCard({ session, onRefresh, onDeleted }) {
  const [local, setLocal] = useState(session)
  const [previewUrl, setPreviewUrl] = useState(null)
  const [pendingDims, setPendingDims] = useState({ w: '8.5', h: '5.5' })
  const [uploading, setUploading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  const [insertOpen, setInsertOpen] = useState(false)

  useEffect(() => {
    setLocal(session)
  }, [session])

  useEffect(() => {
    if (!local?.file_path) {
      setPreviewUrl(null)
      return
    }
    getArtSignedUrl(local.file_path).then(({ data }) => {
      setPreviewUrl(data?.signedUrl ?? null)
    })
  }, [local?.file_path])

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
    const { data, error: err } = await uploadArtSessionFile(local.id, file)
    setUploading(false)
    if (err) {
      setError(err.message)
      return
    }
    setLocal(data)
    onRefresh()
  }

  async function handleSaveDimensions() {
    const w = Number(pendingDims.w)
    const h = Number(pendingDims.h)
    if (!w || !h || w <= 0 || h <= 0) {
      setError('Informe largura e altura válidas em cm.')
      return
    }
    setSaving(true)
    const { data, error: err } = await finalizeArtSessionDimensions(local.id, w, h)
    setSaving(false)
    if (err) {
      setError(err.message)
      return
    }
    setLocal(data)
    onRefresh()
  }

  async function handleQrChange(qrFields) {
    setLocal((prev) => ({ ...prev, ...qrFields }))
    setSaving(true)
    const { data, error: err } = await updateArtSession(local.id, qrFields)
    setSaving(false)
    if (err) setError(err.message)
    else if (data) {
      setLocal(data)
      onRefresh()
    }
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
          <p className="form-hint">Informe o tamanho físico do card em cm:</p>
          <label>
            Largura (cm)
            <input
              type="number"
              step="0.01"
              min="0.1"
              value={pendingDims.w}
              onChange={(e) => setPendingDims((p) => ({ ...p, w: e.target.value }))}
            />
          </label>
          <label>
            Altura (cm)
            <input
              type="number"
              step="0.01"
              min="0.1"
              value={pendingDims.h}
              onChange={(e) => setPendingDims((p) => ({ ...p, h: e.target.value }))}
            />
          </label>
          <button type="button" className="btn primary" onClick={handleSaveDimensions} disabled={saving}>
            Confirmar dimensões
          </button>
        </div>
      )}

      {isReady && previewUrl && (
        <>
          <ArtCanvasEditor session={local} previewUrl={previewUrl} onChange={handleQrChange} />
          <div className="art-cm-fields">
            <label>
              QR X (cm)
              <input
                type="number"
                step="0.01"
                value={Number(local.qr_x_cm).toFixed(2)}
                onChange={(e) =>
                  handleQrChange({ qr_x_cm: Number(e.target.value), qr_y_cm: local.qr_y_cm, qr_size_cm: local.qr_size_cm })
                }
              />
            </label>
            <label>
              QR Y (cm)
              <input
                type="number"
                step="0.01"
                value={Number(local.qr_y_cm).toFixed(2)}
                onChange={(e) =>
                  handleQrChange({ qr_x_cm: local.qr_x_cm, qr_y_cm: Number(e.target.value), qr_size_cm: local.qr_size_cm })
                }
              />
            </label>
            <label>
              QR tamanho (cm)
              <input
                type="number"
                step="0.01"
                min="0.1"
                value={Number(local.qr_size_cm).toFixed(2)}
                onChange={(e) =>
                  handleQrChange({ qr_x_cm: local.qr_x_cm, qr_y_cm: local.qr_y_cm, qr_size_cm: Number(e.target.value) })
                }
              />
            </label>
          </div>
          {saving && <p className="muted">Salvando posição…</p>}
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
