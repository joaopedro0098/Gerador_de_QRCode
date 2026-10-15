import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react'
import { supabase } from '../../lib/supabase.js'
import {
  CARD_FIELDS,
  activateComplete,
  activateNfc,
  activateQr,
  activateVirginCard,
  saveActivatedCardFields,
  isCardActivated,
  isNfcTagWriteRequired,
} from '../../utils/cardActivation.js'
import BairroActivateField from './BairroActivateField.jsx'
import ChangeBairroConfirmModal from './ChangeBairroConfirmModal.jsx'
import { isLojaCode, normalizeCode } from '../../utils/codes.js'
import { isActiveCardBairroChange } from '../../utils/cardStatus.js'
import { blockEmptyBackspaceNav } from '../../utils/formInput.js'
import { createNfcWriteSession, isNfcSupported } from '../../utils/nfc.js'
import { isValidHttpsUrl } from '../../utils/validate.js'

const ActivateForm = forwardRef(function ActivateForm(
  {
    card = null,
    standalone = false,
    focusLinkOnMount = false,
    hideActivateButton = false,
    hideBairroField = false,
    stockActivationUi = false,
    stockManageUi = false,
    onSaved,
  },
  ref,
) {
  const linkInputRef = useRef(null)
  const [code, setCode] = useState(card?.code ?? '')
  const [destinationUrl, setDestinationUrl] = useState('')
  const [nfcUrl, setNfcUrl] = useState('')
  const [notes, setNotes] = useState('')
  const [ownerName, setOwnerName] = useState('')
  const [contact, setContact] = useState('')
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
  const nfcWriteSessionRef = useRef(null)
  const nfcOpRef = useRef(0)

  function abortActiveNfcWrite() {
    nfcOpRef.current += 1
    nfcWriteSessionRef.current?.abort()
    nfcWriteSessionRef.current = null
  }

  useEffect(() => () => abortActiveNfcWrite(), [])

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
    setOwnerName(data.owner_name?.trim() ? data.owner_name : '')
    setContact(data.contact?.trim() ? data.contact : '')
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
        setOwnerName('')
        setContact('')
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
            setOwnerName('')
            setContact('')
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
          setOwnerName('')
          setContact('')
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

  function finishSuccess(data, text, { tone = null, navigateToActivated = false } = {}) {
    setExisting(data)
    setError(null)
    setMessage(text)
    setSuccessTone(tone)
    onSaved?.(data, { navigateToActivated })
  }

  function validateVirginBairroAndEstablishment() {
    if (!locationBairroId) {
      setError('Selecione ou crie um bairro.')
      return false
    }
    if (!notes.trim()) {
      setError('Informe o nome do estabelecimento.')
      return false
    }
    return true
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
    if (hideBairroField) return true
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

  const activatedEditUi =
    hideBairroField && hideActivateButton && !stockActivationUi && !stockManageUi && !standalone
  const unifiedFieldUi = stockActivationUi || stockManageUi || activatedEditUi
  const showStockContactFields = stockActivationUi || stockManageUi
  const stockContactPayload = showStockContactFields ? { ownerName, contact } : {}

  const handleActivatedEditSave = async () => {
    setError(null)
    setMessage(null)
    setNfcHint(null)
    if (!existing) {
      setError('Não foi possível carregar este ID.')
      return
    }

    setBusy('activated-save')
    const { data, error: saveError } = await saveActivatedCardFields(supabase, existing.id, {
      notes,
      destinationUrl,
      nfcUrl,
      storedDestinationUrl: existing.destination_url,
      storedNfcUrl: existing.nfc_url,
      ...stockContactPayload,
    })
    setBusy(null)

    if (saveError) {
      setError(saveError.message)
      return
    }

    finishSuccess(data, 'Alterações salvas.')
  }

  useImperativeHandle(ref, () => ({
    saveActivatedEdit: handleActivatedEditSave,
    isSaving: busy === 'activated-save',
  }))

  async function handleSaveEstablishment() {
    setError(null)
    setMessage(null)
    setNfcHint(null)
    if (!existing) {
      setError('Não foi possível carregar este ID.')
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
      setError('Não foi possível carregar este ID.')
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

  async function handleVirginAtivar() {
    setError(null)
    setMessage(null)
    setSuccessTone(null)
    setNfcHint(null)
    if (!existing) {
      setError('Não foi possível carregar este ID.')
      return
    }
    if (!validateVirginBairroAndEstablishment()) return

    const qr = destinationUrl.trim()
    const nfc = nfcUrl.trim()
    const storedNfc = existing.nfc_url?.trim() ?? ''
    if (!qr && !nfc && !storedNfc) {
      setError('Informe o link do QR ou grave o NFC antes de ativar.')
      return
    }

    if (!(await ensureBairroChangeBeforeSave())) return

    const wasActivated = isCardActivated(existing)
    setBusy('virgin-activate')

    const { data, error: saveError } = await activateVirginCard(supabase, existing.id, {
      destinationUrl: qr,
      nfcUrl: nfc,
      storedNfcUrl: storedNfc,
      notes,
      locationBairroId,
      wasActivated,
      existingBairroId: existing.location_bairro_id,
      storedStockAt: existing.stock_at,
      ...stockContactPayload,
    })

    setBusy(null)

    if (saveError) {
      setError(saveError.message)
      return
    }

    const becameActivated = !wasActivated && isCardActivated(data)
    finishSuccess(data, becameActivated ? 'Card ativado.' : 'Dados salvos.', {
      navigateToActivated: becameActivated,
    })
  }

  async function handleGerarNfc() {
    setError(null)
    setMessage(null)
    setSuccessTone(null)
    setNfcHint(null)
    setNfcDebug(null)
    if (!existing) {
      setError('Não foi possível carregar este ID.')
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

    abortActiveNfcWrite()
    const opId = nfcOpRef.current

    let nfcWriteSession = null
    try {
      nfcWriteSession = createNfcWriteSession(url)
      nfcWriteSessionRef.current = nfcWriteSession
    } catch {
      setNfcHint('Use Chrome no Android para gravar NFC.')
      return
    }

    if (!(await ensureBairroChangeBeforeSave())) {
      abortActiveNfcWrite()
      return
    }

    const wasActivated = isCardActivated(existing)
    const nfcDraftOnly = stockActivationUi && !wasActivated

    if (nfcDraftOnly && !validateVirginBairroAndEstablishment()) {
      abortActiveNfcWrite()
      return
    }

    setNfcHint(
      'Encoste a tag no celular e mantenha parada até concluir. Se já houver link na tag, ele será substituído.',
    )
    setBusy('nfc')

    try {
      const result = await activateNfc(supabase, existing.id, nfcUrl, {
        locationBairroId,
        wasActivated,
        existingBairroId: existing.location_bairro_id,
        nfcWriteSession,
        storedNfcUrl: existing.nfc_url,
        storedNfcUid: existing.nfc_uid,
        forceTagWrite: true,
        withoutActivation: nfcDraftOnly,
        notes: nfcDraftOnly ? notes : undefined,
        ...(nfcDraftOnly ? stockContactPayload : {}),
      })

      if (opId !== nfcOpRef.current) return

      if (result.cancelled) {
        return
      }
      if (result.error) {
        setError(result.error.message)
        setNfcDebug(result.error.debug ?? null)
        return
      }

      setNfcDebug(null)
      setNfcHint(null)
      const nfcSuccessText = result.hardwareSkipped
        ? 'Link NFC salvo no sistema (a tag não foi regravada).'
        : result.savedUrlOnly
          ? 'Link NFC salvo.'
          : 'NFC gravado com sucesso.'
      const becameActivated = !wasActivated && isCardActivated(result.data)
      finishSuccess(result.data, nfcSuccessText, {
        tone: result.hardwareSkipped ? null : 'nfc',
        navigateToActivated: becameActivated && stockActivationUi && !nfcDraftOnly,
      })
    } finally {
      if (nfcWriteSessionRef.current === nfcWriteSession) {
        nfcWriteSessionRef.current = null
      }
      if (opId === nfcOpRef.current) {
        setBusy(null)
      }
    }
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
          ? 'Informe um ID válido existente no sistema.'
          : 'Não foi possível carregar este ID.',
      )
      return
    }

    abortActiveNfcWrite()

    const wasActivated = isCardActivated(existing)
    const qrTrimmed = destinationUrl.trim()
    const nfcTrimmed = nfcUrl.trim()
    let nfcWriteSession = null
    if (
      nfcTrimmed &&
      isValidHttpsUrl(nfcTrimmed) &&
      isNfcSupported() &&
      isNfcTagWriteRequired(existing, nfcTrimmed)
    ) {
      try {
        nfcWriteSession = createNfcWriteSession(nfcTrimmed)
        nfcWriteSessionRef.current = nfcWriteSession
      } catch {
        setNfcHint('Use Chrome no Android para gravar NFC.')
        return
      }
    }

    if (!(await ensureBairroChangeBeforeSave())) {
      abortActiveNfcWrite()
      return
    }

    setBusy('full')

    let result
    try {
      result = await activateComplete(supabase, existing.id, {
        destinationUrl,
        nfcUrl,
        notes,
        locationBairroId,
        wasActivated,
        existingBairroId: existing.location_bairro_id,
        nfcWriteSession,
        storedNfcUrl: existing.nfc_url,
        storedNfcUid: existing.nfc_uid,
        ...stockContactPayload,
      })
    } finally {
      if (nfcWriteSession && nfcWriteSessionRef.current === nfcWriteSession) {
        nfcWriteSessionRef.current = null
      }
      setBusy(null)
    }

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
        'Link NFC atualizado no sistema. A tag física não precisa ser gravada de novo (mesmo endereço).',
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
  const formLocked =
    formUnavailable ||
    busy === 'full' ||
    busy === 'virgin-activate' ||
    busy === 'activated-save' ||
    busy === 'nfc' ||
    busy === 'qr'

  function fieldInputDisabled() {
    return (
      formUnavailable || busy === 'full' || busy === 'virgin-activate' || busy === 'activated-save'
    )
  }

  function fieldButtonDisabled(forField) {
    if (formUnavailable) return true
    if (busy === 'full' || busy === 'virgin-activate' || busy === 'activated-save') return true
    return busy === forField
  }

  const showStandaloneAtivarSubmit = !hideActivateButton && !stockActivationUi

  function handleFormSubmit(e) {
    e.preventDefault()
    if (stockActivationUi) {
      void handleVirginAtivar()
      return
    }
    if (showStandaloneAtivarSubmit) {
      void handleAtivacaoCompleta(e)
    }
  }

  return (
    <form className="stack-form activate-form" onSubmit={handleFormSubmit}>
      {showCodeField && (
        <label>
          ID do card
          <input
            type="text"
            value={code}
            onChange={(e) => setCode(normalizeCode(e.target.value))}
            onKeyDown={blockEmptyBackspaceNav}
            placeholder="ex: loja01"
            maxLength={15}
            autoComplete="off"
          />
        </label>
      )}

      {loadingCard && <p className="muted">Carregando…</p>}
      {!loadingCard && showCodeField && isLojaCode(normalizedCode) && !existing && (
        <p className="form-hint error">Este ID não existe no sistema.</p>
      )}

      {!loadingCard && existing && !hideBairroField && (
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
          {unifiedFieldUi ? (
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              onKeyDown={blockEmptyBackspaceNav}
              placeholder="insira o nome do estabelecimento"
              disabled={fieldInputDisabled()}
            />
          ) : (
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
          )}
        </label>
      )}

      {!loadingCard && existing && showStockContactFields && (
        <>
          <label>
            Nome do proprietário
            <input
              type="text"
              value={ownerName}
              onChange={(e) => setOwnerName(e.target.value)}
              onKeyDown={blockEmptyBackspaceNav}
              placeholder="opcional"
              disabled={fieldInputDisabled()}
              autoComplete="name"
            />
          </label>
          <label>
            Contato
            <input
              type="text"
              value={contact}
              onChange={(e) => setContact(e.target.value)}
              onKeyDown={blockEmptyBackspaceNav}
              placeholder="opcional"
              disabled={fieldInputDisabled()}
              autoComplete="tel"
            />
          </label>
        </>
      )}

      <label className="activate-field-with-clear">
        <span className="activate-field-title">QR Code</span>
        <button
          type="button"
          className="btn-ghost-link activate-field-clear"
          disabled={fieldInputDisabled()}
          onClick={() => setDestinationUrl('')}
        >
          Limpar
        </button>
        {unifiedFieldUi ? (
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
        ) : (
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
        )}
      </label>

      <label className="activate-field-with-clear">
        <span className="activate-field-title">NFC</span>
        <button
          type="button"
          className="btn-ghost-link activate-field-clear"
          disabled={fieldInputDisabled()}
          onClick={() => setNfcUrl('')}
        >
          Limpar
        </button>
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
            {busy === 'nfc' ? 'Aproxime a tag…' : 'Gravar'}
          </button>
        </div>
      </label>

      {nfcDebug && (
        <pre className="nfc-debug-panel" aria-label="Debug NFC">
          {JSON.stringify(nfcDebug, null, 2)}
        </pre>
      )}

      {nfcHint && <p className="form-hint">{nfcHint}</p>}
      {error && <p className="form-hint error">{error}</p>}
      {message && (
        <p className={`form-hint success${successTone === 'nfc' ? ' success-nfc' : ''}`}>{message}</p>
      )}

      {stockActivationUi && !loadingCard && existing && (
        <button type="submit" className="btn primary activate-virgin-save-btn" disabled={formLocked}>
          {busy === 'virgin-activate' ? 'Ativando…' : 'Ativar'}
        </button>
      )}

      {showStandaloneAtivarSubmit && (
        <button type="submit" className="btn primary" disabled={formLocked}>
          {busy === 'full' ? 'Processando…' : 'Ativar'}
        </button>
      )}

      <ChangeBairroConfirmModal
        open={bairroConfirmOpen}
        busy={bairroConfirmBusy}
        onCancel={handleBairroConfirmCancel}
        onProceed={handleBairroConfirmProceed}
      />
    </form>
  )
})

export default ActivateForm
