import { useEffect, useRef, useState } from 'react'
import { supabase } from '../../lib/supabase.js'
import {
  CARD_FIELDS,
  activateComplete,
  activateNfc,
  activateQr,
  isCardActivated,
  isNfcTagWriteRequired,
} from '../../utils/cardActivation.js'
import BairroActivateField from './BairroActivateField.jsx'
import ChangeBairroConfirmModal from './ChangeBairroConfirmModal.jsx'
import { isLojaCode, normalizeCode } from '../../utils/codes.js'
import { isActiveCardBairroChange } from '../../utils/cardStatus.js'
import { blockEmptyBackspaceNav } from '../../utils/formInput.js'
import { createNfcWriteSession, isNfcSupported } from '../../utils/nfc.js'
import { createNfcShortUrlPromise } from '../../utils/shortLinks.js'
import { isValidHttpsUrl } from '../../utils/validate.js'

export default function ActivateForm({
  card = null,
  standalone = false,
  focusLinkOnMount = false,
  onSaved,
}) {
  const linkInputRef = useRef(null)
  const [code, setCode] = useState(card?.code ?? '')
  const [destinationUrl, setDestinationUrl] = useState('')
  const [nfcUrl, setNfcUrl] = useState('')
  const [notes, setNotes] = useState('')
  const [busy, setBusy] = useState(null)
  const [loadingCard, setLoadingCard] = useState(Boolean(card?.id))
  const [message, setMessage] = useState(null)
  const [error, setError] = useState(null)
  const [existing, setExisting] = useState(null)
  const [locationBairroId, setLocationBairroId] = useState(null)
  const [nfcHint, setNfcHint] = useState(null)
  const [nfcDebug, setNfcDebug] = useState(null)
  const [successTone, setSuccessTone] = useState(null)
  const [bairroConfirmOpen, setBairroConfirmOpen] = useState(false)
  const [bairroConfirmBusy, setBairroConfirmBusy] = useState(false)
  const bairroConfirmResolverRef = useRef(null)
  const pendingBairroIdRef = useRef(null)

  useEffect(() => {
    if (standalone) return
    if (!card?.id) return
    setCode(card.code)
  }, [card?.id, card?.code, standalone])

  function applyCardData(data) {
    setExisting(data)
    setDestinationUrl(data.destination_url ?? '')
    setNfcUrl(data.nfc_url ?? '')
    setNotes(data.notes?.trim() ? data.notes : '')
    setLocationBairroId(data.location_bairro_id ?? null)
  }

  useEffect(() => {
    setMessage(null)
    setError(null)
    setSuccessTone(null)
    setNfcHint(null)

    if (standalone) {
      const normalized = normalizeCode(code)
      if (!isLojaCode(normalized)) {
        setExisting(null)
        setDestinationUrl('')
        setNfcUrl('')
        setNotes('')
        setLoadingCard(false)
        return
      }

      let cancelled = false
      setLoadingCard(true)
      supabase
        .from('cards')
        .select(CARD_FIELDS)
        .eq('code', normalized)
        .maybeSingle()
        .then(({ data, error: fetchError }) => {
          if (cancelled) return
          setLoadingCard(false)
          if (fetchError || !data) {
            setExisting(null)
            setDestinationUrl('')
            setNfcUrl('')
            setNotes('')
            return
          }
          applyCardData(data)
        })
      return () => {
        cancelled = true
      }
    }

    if (!card?.id) return

    applyCardData(card)
    setLoadingCard(false)

    let cancelled = false
    supabase
      .from('cards')
      .select(CARD_FIELDS)
      .eq('id', card.id)
      .single()
      .then(({ data, error: fetchError }) => {
        if (cancelled) return
        if (fetchError || !data) {
          setExisting(null)
          setDestinationUrl('')
          setNfcUrl('')
          setNotes('')
          return
        }
        applyCardData(data)
      })

    return () => {
      cancelled = true
    }
  }, [card?.id, code, standalone])

  useEffect(() => {
    if (!focusLinkOnMount || loadingCard || !existing) return
    linkInputRef.current?.focus({ preventScroll: true })
  }, [focusLinkOnMount, loadingCard, existing?.id])

  function finishSuccess(data, text, { tone = null } = {}) {
    setExisting(data)
    setError(null)
    setMessage(text)
    setSuccessTone(tone)
    onSaved?.(data)
  }

  function askBairroChangeConfirm(newBairroId) {
    pendingBairroIdRef.current = newBairroId
    setBairroConfirmOpen(true)
    return new Promise((resolve) => {
      bairroConfirmResolverRef.current = resolve
    })
  }

  function closeBairroConfirm(result) {
    bairroConfirmResolverRef.current?.(result)
    bairroConfirmResolverRef.current = null
    pendingBairroIdRef.current = null
    setBairroConfirmOpen(false)
  }

  async function persistBairroChange(newBairroId) {
    if (!existing?.id || !newBairroId) return false
    setBairroConfirmBusy(true)
    const { data, error: saveError } = await supabase
      .from('cards')
      .update({ location_bairro_id: newBairroId })
      .eq('id', existing.id)
      .select(CARD_FIELDS)
      .single()
    setBairroConfirmBusy(false)

    if (saveError) {
      setError(saveError.message)
      return false
    }

    applyCardData(data)
    setLocationBairroId(data.location_bairro_id)
    finishSuccess(data, 'Bairro atualizado.')
    return true
  }

  async function onBeforeBairroChange(newBairroId) {
    if (!existing || !isActiveCardBairroChange(existing, newBairroId)) {
      return true
    }
    const proceed = await askBairroChangeConfirm(newBairroId)
    if (!proceed) return false
    return true
  }

  async function ensureBairroChangeBeforeSave() {
    if (!existing || !isActiveCardBairroChange(existing, locationBairroId)) {
      return true
    }
    const proceed = await askBairroChangeConfirm(locationBairroId)
    if (!proceed) return false
    return true
  }

  async function handleBairroConfirmProceed() {
    const newId = pendingBairroIdRef.current
    if (!newId) {
      closeBairroConfirm(false)
      return
    }
    const ok = await persistBairroChange(newId)
    closeBairroConfirm(ok)
  }

  function handleBairroConfirmCancel() {
    closeBairroConfirm(false)
  }

  async function handleSaveEstablishment() {
    setError(null)
    setMessage(null)
    setNfcHint(null)
    if (!existing) {
      setError('Não foi possível carregar este código.')
      return
    }

    setBusy('notes')
    const value = notes.trim()
    const { data, error: saveError } = await supabase
      .from('cards')
      .update({ notes: value || null })
      .eq('id', existing.id)
      .select(CARD_FIELDS)
      .single()
    setBusy(null)

    if (saveError) {
      setError(saveError.message)
      return
    }

    finishSuccess(data, 'Estabelecimento salvo.')
  }

  async function handleGerarQr() {
    setError(null)
    setMessage(null)
    setNfcHint(null)
    if (!existing) {
      setError('Não foi possível carregar este código.')
      return
    }
    if (!(await ensureBairroChangeBeforeSave())) return

    setBusy('qr')
    const wasActivated = isCardActivated(existing)
    const { data, error: qrError } = await activateQr(supabase, existing.id, destinationUrl, {
      locationBairroId,
      wasActivated,
      existingBairroId: existing.location_bairro_id,
    })
    setBusy(null)

    if (qrError) {
      setError(qrError.message)
      return
    }

    finishSuccess(
      data,
      wasActivated ? 'Link do QR atualizado.' : 'QR ativado com sucesso.',
    )
  }

  async function handleGerarNfc() {
    setError(null)
    setMessage(null)
    setSuccessTone(null)
    setNfcHint(null)
    setNfcDebug(null)
    if (!existing) {
      setError('Não foi possível carregar este código.')
      return
    }

    const url = nfcUrl.trim()
    if (!url) {
      setError('Informe o link NFC.')
      return
    }
    if (!isValidHttpsUrl(url)) {
      setError('O link NFC deve ser uma URL HTTPS válida.')
      return
    }

    if (!isNfcSupported()) {
      setNfcHint('Use Chrome no Android para gravar NFC.')
      return
    }

    const shortUrlPromise = createNfcShortUrlPromise(
      supabase,
      existing.id,
      url,
      existing.short_code,
    )

    let nfcWriteSession = null
    try {
      nfcWriteSession = createNfcWriteSession(shortUrlPromise)
    } catch {
      setNfcHint('Use Chrome no Android para gravar NFC.')
      return
    }

    if (!(await ensureBairroChangeBeforeSave())) {
      nfcWriteSession.abort()
      return
    }

    setBusy('nfc')
    const wasActivated = isCardActivated(existing)
    const result = await activateNfc(supabase, existing.id, nfcUrl, {
      locationBairroId,
      wasActivated,
      existingBairroId: existing.location_bairro_id,
      nfcWriteSession,
      shortUrlPromise,
      storedNfcUrl: existing.nfc_url,
      storedNfcUid: existing.nfc_uid,
      storedShortCode: existing.short_code,
      forceTagWrite: true,
    })
    setBusy(null)

    if (result.cancelled) {
      return
    }
    if (result.error) {
      setError(result.error.message)
      setNfcDebug(result.error.debug ?? null)
      return
    }

    setNfcDebug(null)
    const nfcSuccessText = result.hardwareSkipped
      ? 'Link NFC salvo no sistema (a tag não foi regravada).'
      : result.savedUrlOnly
        ? 'Link NFC salvo.'
        : 'NFC gravado com sucesso.'
    finishSuccess(result.data, nfcSuccessText, {
      tone: result.hardwareSkipped ? null : 'nfc',
    })
  }

  async function handleAtivacaoCompleta(e) {
    e.preventDefault()
    setError(null)
    setMessage(null)
    setSuccessTone(null)
    setNfcHint(null)
    setNfcDebug(null)

    if (!existing) {
      setError(
        standalone
          ? 'Informe um código válido existente no sistema.'
          : 'Não foi possível carregar este código.',
      )
      return
    }

    const wasActivated = isCardActivated(existing)
    const qrTrimmed = destinationUrl.trim()
    const nfcTrimmed = nfcUrl.trim()
    let nfcWriteSession = null
    let shortUrlPromise = null
    if (
      nfcTrimmed &&
      isValidHttpsUrl(nfcTrimmed) &&
      isNfcSupported() &&
      isNfcTagWriteRequired(existing, nfcTrimmed)
    ) {
      shortUrlPromise = createNfcShortUrlPromise(
        supabase,
        existing.id,
        nfcTrimmed,
        existing.short_code,
      )
      try {
        nfcWriteSession = createNfcWriteSession(shortUrlPromise)
      } catch {
        setNfcHint('Use Chrome no Android para gravar NFC.')
        return
      }
    }

    if (!(await ensureBairroChangeBeforeSave())) {
      nfcWriteSession?.abort()
      return
    }

    setBusy('full')

    const result = await activateComplete(supabase, existing.id, {
      destinationUrl,
      nfcUrl,
      notes,
      locationBairroId,
      wasActivated,
      existingBairroId: existing.location_bairro_id,
      nfcWriteSession,
      shortUrlPromise,
      storedNfcUrl: existing.nfc_url,
      storedNfcUid: existing.nfc_uid,
      storedShortCode: existing.short_code,
    })

    setBusy(null)

    if (result.error) {
      if (result.step === 'nfc' && result.data) {
        setExisting(result.data)
        onSaved?.(result.data)
      }
      setError(result.error.message)
      if (result.step === 'nfc') {
        setNfcDebug(result.error.debug ?? null)
      }
      return
    }

    if (result.nfcCancelled) {
      finishSuccess(
        result.data,
        wasActivated ? 'QR atualizado. Gravação NFC cancelada.' : 'Card ativado. Gravação NFC cancelada.',
      )
      return
    }

    if (result.nfcSavedUrlOnly) {
      setNfcHint('Link NFC salvo. Use Chrome no Android para gravar a tag física.')
    }

    const nfcDestOnlyUpdate =
      nfcTrimmed && !isNfcTagWriteRequired(existing, nfcTrimmed) && isNfcSupported()
    if (nfcDestOnlyUpdate) {
      setNfcHint(
        'Destino NFC atualizado no servidor. A tag física não precisa ser gravada de novo (mesmo link curto).',
      )
    }
    finishSuccess(
      result.data,
      wasActivated ? 'Card atualizado com sucesso.' : 'Card ativado com sucesso.',
      {},
    )
  }

  const normalizedCode = normalizeCode(code)
  const showCodeField = standalone
  const formUnavailable = loadingCard || !existing
  const formLocked = formUnavailable || busy === 'full'

  function fieldInputDisabled() {
    return formUnavailable || busy === 'full'
  }

  function fieldButtonDisabled(forField) {
    if (formUnavailable) return true
    if (busy === 'full') return true
    return busy === forField
  }

  return (
    <form className="stack-form activate-form" onSubmit={handleAtivacaoCompleta}>
      {showCodeField && (
        <label>
          Código do card
          <input
            type="text"
            value={code}
            onChange={(e) => setCode(normalizeCode(e.target.value))}
            onKeyDown={blockEmptyBackspaceNav}
            placeholder="ex: loja1"
            maxLength={15}
            autoComplete="off"
          />
        </label>
      )}

      {loadingCard && <p className="muted">Carregando…</p>}
      {!loadingCard && showCodeField && isLojaCode(normalizedCode) && !existing && (
        <p className="form-hint error">Este código não existe no sistema.</p>
      )}

      {!loadingCard && existing && (
        <BairroActivateField
          bairroId={locationBairroId}
          onBairroIdChange={setLocationBairroId}
          onBeforeBairroChange={onBeforeBairroChange}
          disabled={formLocked}
        />
      )}

      {!loadingCard && existing && (
        <label>
          Estabelecimento
          <div className="activate-inline-actions">
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              onKeyDown={blockEmptyBackspaceNav}
              placeholder="insira o nome do estabelecimento"
              disabled={fieldInputDisabled()}
            />
            <button
              type="button"
              className="btn secondary small"
              disabled={fieldButtonDisabled('notes')}
              onClick={handleSaveEstablishment}
            >
              {busy === 'notes' ? '…' : 'Salvar'}
            </button>
          </div>
        </label>
      )}

      <label>
        QR Code
        <div className="activate-inline-actions">
          <input
            ref={linkInputRef}
            type="text"
            inputMode="url"
            autoComplete="off"
            value={destinationUrl}
            onChange={(e) => setDestinationUrl(e.target.value)}
            onKeyDown={blockEmptyBackspaceNav}
            placeholder="Cole o link aqui"
            disabled={fieldInputDisabled()}
          />
          <button
            type="button"
            className="btn secondary small"
            disabled={fieldButtonDisabled('qr')}
            onClick={handleGerarQr}
          >
            {busy === 'qr' ? 'Salvando…' : 'Salvar'}
          </button>
        </div>
      </label>

      <label>
        NFC
        <div className="activate-inline-actions">
          <input
            type="text"
            inputMode="url"
            autoComplete="off"
            value={nfcUrl}
            onChange={(e) => setNfcUrl(e.target.value)}
            onKeyDown={blockEmptyBackspaceNav}
            placeholder="Cole o link aqui"
            disabled={fieldInputDisabled()}
          />
          <button
            type="button"
            className="btn secondary small"
            disabled={fieldButtonDisabled('nfc')}
            onClick={handleGerarNfc}
          >
            {busy === 'nfc' ? 'Aproxime a tag…' : 'Salvar'}
          </button>
        </div>
      </label>

      {nfcDebug && (
        <pre className="nfc-debug-panel" aria-label="Debug link curto NFC">
          {JSON.stringify(nfcDebug, null, 2)}
        </pre>
      )}

      {nfcHint && <p className="form-hint">{nfcHint}</p>}
      {error && <p className="form-hint error">{error}</p>}
      {message && (
        <p className={`form-hint success${successTone === 'nfc' ? ' success-nfc' : ''}`}>{message}</p>
      )}

      <button type="submit" className="btn primary" disabled={formLocked}>
        {busy === 'full' ? 'Processando…' : 'Ativar'}
      </button>

      <ChangeBairroConfirmModal
        open={bairroConfirmOpen}
        busy={bairroConfirmBusy}
        onCancel={handleBairroConfirmCancel}
        onProceed={handleBairroConfirmProceed}
      />
    </form>
  )
}
