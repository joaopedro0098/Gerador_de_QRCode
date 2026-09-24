import { useCallback, useEffect, useRef, useState } from 'react'
import ArtCanvasEditor from './ArtCanvasEditor.jsx'
import NumberWindowPagination from '../../ui/NumberWindowPagination.jsx'
import { detectArtAspectRatio } from '../../../utils/artMedia.js'
import { ART_DOWNLOAD_MAX } from '../../../lib/config.js'
import { supabase } from '../../../lib/supabase.js'
import { composeVirginCardPdf } from '../../../utils/artComposePdf.js'
import { downloadQrCodesZip } from '../../../utils/artZipDownload.js'
import { normalizeCode } from '../../../utils/codes.js'
import { escapeIlikePrefix, normalizeEstablishmentSearch } from '../../../utils/search.js'
import {
  clearArtSessionFile,
  defaultDimensionsPayload,
  deleteArtSession,
  getArtSignedUrl,
  updateArtSession,
  uploadArtSessionFile,
} from '../../../utils/artSessionApi.js'

const ACCEPT = '.jpg,.jpeg,.png,.svg,.pdf,image/jpeg,image/png,image/svg+xml,application/pdf'

function establishmentLabel(notes) {
  const t = notes?.trim()
  return t ? t : 'virgem'
}

function statusLabel(destinationUrl) {
  return destinationUrl ? 'Ativo' : 'Virgem'
}

export default function ArtSessionCard({
  session,
  sessionNumber = 1,
  canDelete = true,
  onSessionUpdated,
  onDeleted,
}) {
  const [local, setLocal] = useState(session)
  const [previewUrl, setPreviewUrl] = useState(null)
  const [uploading, setUploading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  const [quantity, setQuantity] = useState('1')
  const [confirmedPool, setConfirmedPool] = useState([])
  const [poolPage, setPoolPage] = useState(1)
  const [confirmingQuantity, setConfirmingQuantity] = useState(false)
  const [specificInput, setSpecificInput] = useState('')
  const [specificCard, setSpecificCard] = useState(null)
  const [canvasFallbackCode, setCanvasFallbackCode] = useState(null)
  const [downloadBusy, setDownloadBusy] = useState(false)
  const [downloadProgress, setDownloadProgress] = useState('')
  const [clearingFile, setClearingFile] = useState(false)
  const saveTimer = useRef(null)
  const previewPathRef = useRef(null)

  useEffect(() => {
    setLocal(session)
  }, [session.id])

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

  const isReady =
    local?.file_path && local.card_width_cm != null && local.qr_x_cm != null

  useEffect(() => {
    if (!isReady || confirmedPool.length || specificCard) return
    let cancelled = false
    supabase
      .from('cards')
      .select('code')
      .is('destination_url', null)
      .order('loja_num', { ascending: true })
      .limit(1)
      .maybeSingle()
      .then(({ data }) => {
        if (!cancelled) setCanvasFallbackCode(data?.code ?? null)
      })
    return () => {
      cancelled = true
    }
  }, [isReady, confirmedPool.length, specificCard])

  useEffect(() => {
    if (poolPage > confirmedPool.length && confirmedPool.length > 0) {
      setPoolPage(confirmedPool.length)
    }
  }, [confirmedPool.length, poolPage])

  const previewCard =
    specificCard ?? confirmedPool[Math.max(0, poolPage - 1)] ?? null

  const previewCode =
    previewCard?.code ??
    (confirmedPool.length === 0 && !specificCard ? canvasFallbackCode : null)

  const showMeta = Boolean(previewCard)
  const showPagination = confirmedPool.length > 0 && !specificCard

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
    if (data?.file_mime !== 'application/pdf') {
      const dims = defaultDimensionsPayload(aspect ?? data?.art_aspect_ratio)
      const { data: withDims, error: dimErr } = await updateArtSession(local.id, {
        ...dims,
        ...(aspect ? { art_aspect_ratio: aspect } : {}),
      })
      if (!dimErr && withDims) next = withDims
    }

    setUploading(false)
    setLocal(next)
    onSessionUpdated?.(next)
  }

  function resetQrSelection() {
    setConfirmedPool([])
    setPoolPage(1)
    setSpecificInput('')
    setSpecificCard(null)
  }

  async function handleClearFile() {
    if (!local.file_path) return
    if (!window.confirm('Excluir o arquivo desta sessão? A sessão permanece aberta.')) return
    setClearingFile(true)
    setError(null)
    previewPathRef.current = null
    setPreviewUrl(null)
    const { data, error: err } = await clearArtSessionFile(local)
    setClearingFile(false)
    if (err) {
      setError(err.message)
      return
    }
    setLocal(data)
    onSessionUpdated?.(data)
    resetQrSelection()
    setCanvasFallbackCode(null)
  }

  function handleQrChange(qrFields) {
    setLocal((prev) => ({ ...prev, ...qrFields }))
    persistSession(qrFields)
  }

  async function handleConfirmQuantity() {
    setError(null)
    const n = Number(quantity)
    if (!Number.isInteger(n) || n < 1 || n > ART_DOWNLOAD_MAX) {
      setError(`Informe uma quantidade entre 1 e ${ART_DOWNLOAD_MAX}.`)
      return
    }
    setConfirmingQuantity(true)
    setSpecificInput('')
    setSpecificCard(null)

    const { data, error: err } = await supabase
      .from('cards')
      .select('id, code, notes, destination_url')
      .is('destination_url', null)
      .order('loja_num', { ascending: true })
      .limit(n)

    setConfirmingQuantity(false)
    if (err) {
      setError(err.message)
      return
    }
    if (!data?.length) {
      setError('Não há cards virgens disponíveis.')
      setConfirmedPool([])
      return
    }
    if (data.length < n) {
      setError(`Só existem ${data.length} virgem(ns). Gere mais códigos ou reduza a quantidade.`)
    }
    setConfirmedPool(data)
    setPoolPage(1)
  }

  async function handleSearchSpecific() {
    setError(null)
    try {
      const card = await resolveSpecificCard()
      if (!card) {
        setError('Informe um código ou estabelecimento para buscar.')
        return
      }
      setConfirmedPool([])
      setPoolPage(1)
    } catch (e) {
      setError(e.message)
      setSpecificCard(null)
    }
  }

  async function resolveSpecificCard() {
    const term = normalizeEstablishmentSearch(specificInput)
    if (!term) {
      setSpecificCard(null)
      return null
    }
    const notesPrefix = escapeIlikePrefix(term)
    const codePrefix = escapeIlikePrefix(normalizeCode(term))
    const { data, error: err } = await supabase
      .from('cards')
      .select('id, code, notes, destination_url')
      .or(`notes.ilike.${notesPrefix}%,code.ilike.${codePrefix}%`)
      .order('loja_num', { ascending: true })
      .limit(2)

    if (err) throw new Error(err.message)
    if (!data?.length) throw new Error('Nenhum card encontrado para essa busca.')
    if (data.length > 1) {
      throw new Error('Mais de um resultado — refine código ou estabelecimento.')
    }
    setSpecificCard(data[0])
    return data[0]
  }

  async function handleDownload() {
    setError(null)
    setDownloadProgress('')
    setDownloadBusy(true)
    try {
      let cardsToRender = []

      if (specificCard) {
        cardsToRender = [specificCard]
      } else if (confirmedPool.length) {
        cardsToRender = confirmedPool
      } else {
        throw new Error('Confirme a quantidade (OK) ou busque um QR code específico.')
      }

      const entries = []
      for (let i = 0; i < cardsToRender.length; i++) {
        setDownloadProgress(`Gerando PDF ${i + 1} de ${cardsToRender.length}…`)
        const pdfBytes = await composeVirginCardPdf(local, cardsToRender[i].code)
        entries.push({ filename: `${cardsToRender[i].code}.pdf`, content: pdfBytes })
      }
      setDownloadProgress('Compactando…')
      await downloadQrCodesZip(entries)
      setDownloadProgress('')
    } catch (e) {
      setError(e.message ?? 'Erro ao baixar.')
    } finally {
      setDownloadBusy(false)
      setDownloadProgress('')
    }
  }

  async function handleDeleteSession() {
    if (!window.confirm('Excluir esta sessão por completo?')) return
    const { error: err } = await deleteArtSession(local)
    if (err) {
      setError(err.message)
      return
    }
    onDeleted(local.id)
  }

  const quantityLocked = Boolean(specificCard)

  return (
    <article className="art-session-card">
      {(local.file_path || canDelete) && (
        <header className="art-session-header art-session-header-compact">
          <div className="art-session-header-actions">
            {local.file_path && (
              <button
                type="button"
                className="btn secondary small danger"
                disabled={clearingFile}
                onClick={handleClearFile}
              >
                {clearingFile ? 'Excluindo…' : 'Excluir arquivo'}
              </button>
            )}
            {canDelete && (
              <button type="button" className="btn secondary small danger" onClick={handleDeleteSession}>
                Excluir sessão
              </button>
            )}
          </div>
        </header>
      )}

      {!local.file_path && (
        <div className="art-upload-zone">
          <p className="art-session-title art-upload-session-label">Sessão {sessionNumber}</p>
          <label className="art-upload-button">
            <input
              type="file"
              accept={ACCEPT}
              disabled={uploading}
              onChange={(e) => {
                handleFile(e.target.files?.[0])
                e.target.value = ''
              }}
            />
            {uploading ? 'Enviando…' : 'Escolher arquivo'}
          </label>
        </div>
      )}

      {isReady && previewUrl && (
        <div className="art-session-layout">
          <aside className="art-session-sidebar">
            <h2 className="art-session-title">Sessão {sessionNumber}</h2>

            <label className="art-download-field">
              Insira a quantidade
              <div className="art-input-with-btn">
                <input
                  type="number"
                  min={1}
                  max={ART_DOWNLOAD_MAX}
                  value={quantity}
                  disabled={quantityLocked}
                  onChange={(e) => setQuantity(e.target.value)}
                />
                <button
                  type="button"
                  className="btn secondary small"
                  disabled={quantityLocked || confirmingQuantity}
                  onClick={handleConfirmQuantity}
                >
                  {confirmingQuantity ? '…' : 'OK'}
                </button>
              </div>
            </label>

            <label className="art-download-field art-specific-field">
              Insira um QR code específico
              <div className="art-input-with-btn">
                <input
                  type="search"
                  placeholder="insira um código ou estabelecimento"
                  value={specificInput}
                  onChange={(e) => {
                    setSpecificInput(e.target.value)
                    setSpecificCard(null)
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault()
                      handleSearchSpecific()
                    }
                  }}
                />
                <button type="button" className="btn secondary small" onClick={handleSearchSpecific}>
                  Buscar
                </button>
              </div>
            </label>

            {showPagination && (
              <NumberWindowPagination
                current={poolPage}
                total={confirmedPool.length}
                disabled={downloadBusy}
                onChange={setPoolPage}
              />
            )}

            {showMeta && previewCard && (
              <div className="art-preview-meta">
                <p className="art-preview-line">
                  <span className="art-preview-label">Código:</span> {previewCard.code}
                </p>
                <p className="art-preview-line muted">
                  <span className="art-preview-label">Estabelecimento:</span>{' '}
                  {establishmentLabel(previewCard.notes)}
                </p>
                <p className="art-preview-line muted">
                  <span className="art-preview-label">Status:</span>{' '}
                  {statusLabel(previewCard.destination_url)}
                </p>
              </div>
            )}

            <div className="art-download-actions">
              <button
                type="button"
                className="btn primary"
                disabled={downloadBusy || (!confirmedPool.length && !specificCard)}
                onClick={handleDownload}
              >
                {downloadBusy ? 'Baixando…' : 'Baixar'}
              </button>
            </div>

            {downloadProgress && <p className="form-hint">{downloadProgress}</p>}
            {saving && <p className="muted">Salvando posição do QR…</p>}
          </aside>

          <div className="art-session-canvas-panel">
            <ArtCanvasEditor
              session={local}
              previewUrl={previewUrl}
              previewCode={previewCode}
              onQrChange={handleQrChange}
            />
          </div>
        </div>
      )}

      {error && <p className="form-hint error">{error}</p>}
    </article>
  )
}
