import { useCallback, useEffect, useRef, useState } from 'react'
import ArtCanvasEditor from './ArtCanvasEditor.jsx'
import { detectArtAspectRatio } from '../../../utils/artMedia.js'
import { ART_DOWNLOAD_MAX } from '../../../lib/config.js'
import { supabase } from '../../../lib/supabase.js'
import { composeVirginCardPdf } from '../../../utils/artComposePdf.js'
import { composeQrOnlyPdf } from '../../../utils/artComposeQrPdf.js'
import { composeQrOnlyPng } from '../../../utils/artComposeQrPng.js'
import { composeVirginCardSvg } from '../../../utils/artComposeSvg.js'
import { assertDownloadWithinLimit, normalizeDownloadList } from '../../../utils/artDownloadLimit.js'
import { downloadArtEntries, downloadQrCodesZip } from '../../../utils/artZipDownload.js'
import ArtDownloadQualityModal, {
  ART_DOWNLOAD_QUALITY,
} from './ArtDownloadQualityModal.jsx'
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

function DownloadIcon() {
  return (
    <svg
      className="art-download-icon"
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="7 10 12 15 17 10" />
      <line x1="12" y1="15" x2="12" y2="3" />
    </svg>
  )
}

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
  const [virginCount, setVirginCount] = useState(null)
  const [confirmingQuantity, setConfirmingQuantity] = useState(false)
  const [specificInput, setSpecificInput] = useState('')
  const [specificCard, setSpecificCard] = useState(null)
  const [canvasFallbackCode, setCanvasFallbackCode] = useState(null)
  const [downloadBusy, setDownloadBusy] = useState(null)
  const [downloadProgress, setDownloadProgress] = useState('')
  const [downloadQualityModalFormat, setDownloadQualityModalFormat] = useState(null)
  const [downloadQualityId, setDownloadQualityId] = useState('standard')
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
      .is('nfc_url', null)
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
    if (!isReady) {
      setVirginCount(null)
      return
    }
    let cancelled = false
    supabase
      .from('cards')
      .select('id', { count: 'exact', head: true })
      .is('destination_url', null)
      .is('nfc_url', null)
      .then(({ count, error: err }) => {
        if (cancelled) return
        setVirginCount(err ? null : (count ?? 0))
      })
    return () => {
      cancelled = true
    }
  }, [isReady, confirmedPool.length])

  const quantityNum = Number(quantity)
  const quantityOverAvailable =
    virginCount != null &&
    Number.isInteger(quantityNum) &&
    quantityNum > 0 &&
    quantityNum > virginCount

  const previewCard = specificCard ?? null

  const previewCode =
    specificCard?.code ??
    confirmedPool[0]?.code ??
    (confirmedPool.length === 0 && !specificCard ? canvasFallbackCode : null)

  const showMeta = Boolean(specificCard)

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

  function handleArtChange(artFields) {
    setLocal((prev) => ({ ...prev, ...artFields }))
    persistSession(artFields)
  }

  async function handleConfirmQuantity() {
    setError(null)
    const n = Number(quantity)
    if (!Number.isInteger(n) || n < 1 || n > ART_DOWNLOAD_MAX) {
      setError(`Informe uma quantidade entre 1 e ${ART_DOWNLOAD_MAX}.`)
      return
    }
    if (virginCount != null && n > virginCount) {
      setConfirmedPool([])
      return
    }
    setConfirmingQuantity(true)
    setSpecificInput('')
    setSpecificCard(null)

    const { data, error: err } = await supabase
      .from('cards')
      .select('id, code, notes, destination_url')
      .is('destination_url', null)
      .is('nfc_url', null)
      .order('loja_num', { ascending: true })
      .limit(n)

    setConfirmingQuantity(false)
    if (err) {
      setError(err.message)
      return
    }
    if (!data?.length) {
      setConfirmedPool([])
      return
    }
    setConfirmedPool(data)
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

  function resolveCardsToRender() {
    if (specificCard) return specificCard
    if (confirmedPool.length) return confirmedPool
    return null
  }

  function openDownloadQualityModal(format) {
    setDownloadQualityId('standard')
    setDownloadQualityModalFormat(format)
  }

  function closeDownloadQualityModal() {
    setDownloadQualityModalFormat(null)
  }

  async function handleDownload(format, qualityId = 'standard') {
    setError(null)
    setDownloadProgress('')
    const cardsToRender = resolveCardsToRender()
    if (!cardsToRender) {
      setError('Confirme a quantidade (OK) ou busque um QR code específico.')
      return
    }
    const list = normalizeDownloadList(cardsToRender)
    try {
      assertDownloadWithinLimit(list)
    } catch (e) {
      setError(e.message)
      return
    }
    const pdfRenderScale =
      ART_DOWNLOAD_QUALITY[qualityId]?.scale ?? ART_DOWNLOAD_QUALITY.standard.scale
    const composeOptions = { pdfRenderScale }

    setDownloadBusy(format)
    try {
      const entries = []
      const ext = format === 'pdf' ? 'pdf' : 'svg'
      for (let i = 0; i < list.length; i++) {
        setDownloadProgress(`Gerando ${ext.toUpperCase()} ${i + 1} de ${list.length}…`)
        if (format === 'pdf') {
          const pdfBytes = await composeVirginCardPdf(local, list[i].code, composeOptions)
          entries.push({ filename: `${list[i].code}.pdf`, content: pdfBytes })
        } else {
          const svg = await composeVirginCardSvg(local, list[i].code, composeOptions)
          entries.push({ filename: `${list[i].code}.svg`, content: svg })
        }
      }
      if (list.length > 1) {
        setDownloadProgress('Compactando…')
      }
      await downloadArtEntries(entries, {
        zipFilename: format === 'pdf' ? 'artes-pdf.zip' : 'artes-svg.zip',
        mimeType: format === 'pdf' ? 'application/pdf' : 'image/svg+xml',
      })
      setDownloadProgress('')
    } catch (e) {
      setError(e.message ?? 'Erro ao baixar.')
    } finally {
      setDownloadBusy(null)
      setDownloadProgress('')
    }
  }

  async function handleDownloadQrOnly() {
    setError(null)
    setDownloadProgress('')
    const cardsToRender = resolveCardsToRender()
    if (!cardsToRender) {
      setError('Confirme a quantidade (OK) ou busque um QR code específico.')
      return
    }
    const list = normalizeDownloadList(cardsToRender)
    try {
      assertDownloadWithinLimit(list)
    } catch (e) {
      setError(e.message)
      return
    }

    const qrSizeCm = local.qr_size_cm
    setDownloadBusy('qr-only')
    try {
      const entries = []
      for (let i = 0; i < list.length; i++) {
        setDownloadProgress(`Gerando QR PDF ${i + 1} de ${list.length}…`)
        const pdfBytes = await composeQrOnlyPdf(list[i].code, qrSizeCm)
        entries.push({ filename: `${list[i].code}.pdf`, content: pdfBytes })
      }
      setDownloadProgress('Compactando…')
      await downloadQrCodesZip(entries, 'qrcodes-pdf.zip')
      setDownloadProgress('')
    } catch (e) {
      setError(e.message ?? 'Erro ao baixar QR codes.')
    } finally {
      setDownloadBusy(null)
      setDownloadProgress('')
    }
  }

  async function handleDownloadQrPng() {
    setError(null)
    setDownloadProgress('')
    const cardsToRender = resolveCardsToRender()
    if (!cardsToRender) {
      setError('Confirme a quantidade (OK) ou busque um QR code específico.')
      return
    }
    const list = normalizeDownloadList(cardsToRender)
    try {
      assertDownloadWithinLimit(list)
    } catch (e) {
      setError(e.message)
      return
    }

    const qrSizeCm = local.qr_size_cm
    setDownloadBusy('qr-png')
    try {
      const entries = []
      for (let i = 0; i < list.length; i++) {
        setDownloadProgress(`Gerando QR PNG ${i + 1} de ${list.length}…`)
        const pngBytes = await composeQrOnlyPng(list[i].code, qrSizeCm)
        entries.push({ filename: `${list[i].code}.png`, content: pngBytes })
      }
      setDownloadProgress('Compactando…')
      await downloadQrCodesZip(entries, 'qrcodes-png.zip')
      setDownloadProgress('')
    } catch (e) {
      setError(e.message ?? 'Erro ao baixar QR codes.')
    } finally {
      setDownloadBusy(null)
      setDownloadProgress('')
    }
  }

  const canDownload = Boolean(confirmedPool.length || specificCard)
  const downloadDisabled = Boolean(downloadBusy) || !canDownload

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
    <article className={`art-session-card${isReady && previewUrl ? ' art-session-card--editing' : ''}`}>
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

            {local.file_path && (
              <button
                type="button"
                className="btn secondary small danger art-sidebar-action"
                disabled={clearingFile}
                onClick={handleClearFile}
              >
                {clearingFile ? 'Excluindo…' : 'Excluir arquivo'}
              </button>
            )}

            <label className="art-download-field">
              Insira a quantidade
              {virginCount != null && (
                <span className="art-virgin-count-hint">{virginCount} virgens</span>
              )}
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
                  disabled={quantityLocked || confirmingQuantity || quantityOverAvailable}
                  onClick={handleConfirmQuantity}
                >
                  {confirmingQuantity ? '…' : 'OK'}
                </button>
              </div>
              {quantityOverAvailable && (
                <span className="art-qty-unavailable">Quantidade indisponível</span>
              )}
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
                className="btn art-download-format-btn"
                disabled={downloadDisabled}
                onClick={() => openDownloadQualityModal('pdf')}
                aria-label="Baixar PDF"
              >
                <DownloadIcon />
                PDF
              </button>
              <button
                type="button"
                className="btn art-download-format-btn"
                disabled={downloadDisabled}
                onClick={() => openDownloadQualityModal('svg')}
                aria-label="Baixar SVG"
              >
                <DownloadIcon />
                SVG
              </button>
            </div>

            <button
              type="button"
              className="btn secondary art-download-qr-only-btn"
              disabled={downloadDisabled}
              onClick={handleDownloadQrOnly}
            >
              {downloadBusy === 'qr-only' ? 'Gerando…' : 'Baixar somente QR code'}
            </button>

            <button
              type="button"
              className="btn secondary art-download-qr-only-btn"
              disabled={downloadDisabled}
              onClick={handleDownloadQrPng}
            >
              {downloadBusy === 'qr-png' ? 'Gerando…' : 'Baixar QR code (PNG)'}
            </button>

            {canDelete && (
              <button
                type="button"
                className="btn secondary small danger art-sidebar-action"
                onClick={handleDeleteSession}
              >
                Excluir sessão
              </button>
            )}

            {downloadProgress && <p className="form-hint">{downloadProgress}</p>}
            {saving && <p className="muted">Salvando…</p>}
          </aside>

          <div className="art-session-canvas-panel">
            <ArtCanvasEditor
              session={local}
              previewUrl={previewUrl}
              previewCode={previewCode}
              onQrChange={handleQrChange}
              onArtChange={handleArtChange}
            />
          </div>
        </div>
      )}

      {error && <p className="form-hint error">{error}</p>}

      <ArtDownloadQualityModal
        open={Boolean(downloadQualityModalFormat)}
        format={downloadQualityModalFormat ?? 'pdf'}
        qualityId={downloadQualityId}
        onQualityChange={setDownloadQualityId}
        onClose={closeDownloadQualityModal}
        onConfirm={() => {
          const format = downloadQualityModalFormat
          const qualityId = downloadQualityId
          closeDownloadQualityModal()
          if (format) handleDownload(format, qualityId)
        }}
      />
    </article>
  )
}
