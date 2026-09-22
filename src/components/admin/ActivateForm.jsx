import { useEffect, useRef, useState } from 'react'
import { supabase } from '../../lib/supabase.js'
import {
  activateComplete,
  activateNfc,
  activateQr,
} from '../../utils/cardActivation.js'
import { isLojaCode, normalizeCode } from '../../utils/codes.js'
import { isNfcSupported } from '../../utils/nfc.js'

const CARD_SELECT =
  'id, code, destination_url, activated_at, notes, nfc_url, nfc_uid, batch_label, created_at'

function blockEmptyBackspaceNav(e) {
  if (e.key !== 'Backspace') return
  const el = e.target
  if (el instanceof HTMLInputElement && el.value === '') {
    e.preventDefault()
  }
}

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
  const [nfcHint, setNfcHint] = useState(null)

  const isBusy = Boolean(busy)

  useEffect(() => {
    if (standalone) return
    if (!card?.id) return
    setCode(card.code)
  }, [card?.id, card?.code, standalone])

  function applyCardData(data) {
    setExisting(data)
    setDestinationUrl(data.destination_url ?? '')
    setNfcUrl(data.nfc_url ?? '')
    setNotes(data.notes ?? '')
  }

  useEffect(() => {
    setMessage(null)
    setError(null)
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
        .select(CARD_SELECT)
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

    let cancelled = false
    setLoadingCard(true)
    supabase
      .from('cards')
      .select(CARD_SELECT)
      .eq('id', card.id)
      .single()
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
  }, [card?.id, code, standalone])

  useEffect(() => {
    if (!focusLinkOnMount || loadingCard || !existing) return
    linkInputRef.current?.focus({ preventScroll: true })
  }, [focusLinkOnMount, loadingCard, existing?.id])

  function finishSuccess(data, text) {
    setExisting(data)
    setMessage(text)
    onSaved?.(data)
  }

  async function handleGerarQr() {
    setError(null)
    setMessage(null)
    setNfcHint(null)
    if (!existing) {
      setError('Não foi possível carregar este código.')
      return
    }

    setBusy('qr')
    const wasActivated = Boolean(existing.destination_url)
    const { data, error: qrError } = await activateQr(supabase, existing.id, destinationUrl)
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
    setNfcHint(null)
    if (!existing) {
      setError('Não foi possível carregar este código.')
      return
    }

    if (!isNfcSupported()) {
      setNfcHint('Use Chrome no Android para gravar NFC.')
      return
    }

    setBusy('nfc')
    const result = await activateNfc(supabase, existing.id, nfcUrl)
    setBusy(null)

    if (result.cancelled) {
      return
    }
    if (result.error) {
      setError(result.error.message)
      return
    }

    finishSuccess(result.data, 'NFC gravado com sucesso.')
  }

  async function handleAtivacaoCompleta(e) {
    e.preventDefault()
    setError(null)
    setMessage(null)
    setNfcHint(null)

    if (!existing) {
      setError(
        standalone
          ? 'Informe um código válido existente no sistema.'
          : 'Não foi possível carregar este código.',
      )
      return
    }

    const wasActivated = Boolean(existing.destination_url)
    setBusy('full')

    const result = await activateComplete(supabase, existing.id, {
      destinationUrl,
      nfcUrl,
      notes,
    })

    setBusy(null)

    if (result.error) {
      if (result.step === 'nfc' && result.data) {
        setExisting(result.data)
        onSaved?.(result.data)
      }
      setError(result.error.message)
      return
    }

    if (result.nfcCancelled) {
      finishSuccess(
        result.data,
        wasActivated ? 'QR atualizado. Gravação NFC cancelada.' : 'Card ativado. Gravação NFC cancelada.',
      )
      return
    }

    if (result.nfcSkipped && nfcUrl.trim() && !isNfcSupported()) {
      setNfcHint('Use Chrome no Android para gravar NFC.')
    }

    finishSuccess(
      result.data,
      wasActivated ? 'Card atualizado com sucesso.' : 'Card ativado com sucesso.',
    )
  }

  const normalizedCode = normalizeCode(code)
  const showCodeField = standalone
  const disabled = isBusy || loadingCard || !existing

  return (
    <form className="stack-form" onSubmit={handleAtivacaoCompleta}>
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

      <label>
        Link de avaliação — QR (HTTPS)
        <input
          ref={linkInputRef}
          type="text"
          inputMode="url"
          autoComplete="off"
          value={destinationUrl}
          onChange={(e) => setDestinationUrl(e.target.value)}
          onKeyDown={blockEmptyBackspaceNav}
          placeholder="https://…"
          disabled={disabled}
        />
      </label>
      <button
        type="button"
        className="btn secondary"
        disabled={disabled}
        onClick={handleGerarQr}
      >
        {busy === 'qr' ? 'Salvando QR…' : 'Gerar QR'}
      </button>

      <label>
        Link NFC (HTTPS)
        <input
          type="text"
          inputMode="url"
          autoComplete="off"
          value={nfcUrl}
          onChange={(e) => setNfcUrl(e.target.value)}
          onKeyDown={blockEmptyBackspaceNav}
          placeholder="https://…"
          disabled={disabled}
        />
      </label>
      <button
        type="button"
        className="btn secondary"
        disabled={disabled}
        onClick={handleGerarNfc}
      >
        {busy === 'nfc' ? 'Aproxime a tag…' : 'Gerar NFC'}
      </button>

      <label>
        Estabelecimento (opcional)
        <input
          type="text"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          onKeyDown={blockEmptyBackspaceNav}
          placeholder="Nome do estabelecimento"
          disabled={disabled}
        />
      </label>

      {nfcHint && <p className="form-hint">{nfcHint}</p>}
      {error && <p className="form-hint error">{error}</p>}
      {message && <p className="form-hint success">{message}</p>}

      <button type="submit" className="btn primary" disabled={disabled}>
        {busy === 'full' ? 'Processando…' : 'Ativação completa'}
      </button>
    </form>
  )
}
