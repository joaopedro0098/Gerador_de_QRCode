import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase.js'
import { normalizeCode } from '../../utils/codes.js'
import { isValidHttpsUrl } from '../../utils/validate.js'

export default function ActivateForm({ card = null, standalone = false, onSaved }) {
  const [code, setCode] = useState(card?.code ?? '')
  const [destinationUrl, setDestinationUrl] = useState('')
  const [notes, setNotes] = useState('')
  const [loading, setLoading] = useState(false)
  const [loadingCard, setLoadingCard] = useState(Boolean(card?.id))
  const [message, setMessage] = useState(null)
  const [error, setError] = useState(null)
  const [existing, setExisting] = useState(null)

  useEffect(() => {
    if (standalone) return
    if (!card?.id) return
    setCode(card.code)
  }, [card?.id, card?.code, standalone])

  useEffect(() => {
    setMessage(null)
    setError(null)

    if (standalone) {
      const normalized = normalizeCode(code)
      if (normalized.length !== 6) {
        setExisting(null)
        setDestinationUrl('')
        setNotes('')
        setLoadingCard(false)
        return
      }

      let cancelled = false
      setLoadingCard(true)
      supabase
        .from('cards')
        .select('id, code, destination_url, activated_at, notes')
        .eq('code', normalized)
        .maybeSingle()
        .then(({ data, error: fetchError }) => {
          if (cancelled) return
          setLoadingCard(false)
          if (fetchError || !data) {
            setExisting(null)
            setDestinationUrl('')
            setNotes('')
            return
          }
          setExisting(data)
          setDestinationUrl(data.destination_url ?? '')
          setNotes(data.notes ?? '')
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
      .select('id, code, destination_url, activated_at, notes')
      .eq('id', card.id)
      .single()
      .then(({ data, error: fetchError }) => {
        if (cancelled) return
        setLoadingCard(false)
        if (fetchError || !data) {
          setExisting(null)
          setDestinationUrl('')
          setNotes('')
          return
        }
        setExisting(data)
        setDestinationUrl(data.destination_url ?? '')
        setNotes(data.notes ?? '')
      })

    return () => {
      cancelled = true
    }
  }, [card?.id, code, standalone])

  async function handleSubmit(e) {
    e.preventDefault()
    setError(null)
    setMessage(null)

    if (!existing) {
      setError(
        standalone
          ? 'Informe um código válido existente no sistema.'
          : 'Não foi possível carregar este código.',
      )
      return
    }

    const url = destinationUrl.trim()
    if (!isValidHttpsUrl(url)) {
      setError('O link de destino deve ser uma URL HTTPS válida.')
      return
    }

    setLoading(true)

    const wasActivated = Boolean(existing.destination_url)
    const payload = {
      destination_url: url,
      activated_at: new Date().toISOString(),
      notes: notes.trim() || null,
    }

    const result = await supabase
      .from('cards')
      .update(payload)
      .eq('id', existing.id)
      .select()
      .single()

    setLoading(false)

    if (result.error) {
      setError(result.error.message)
      return
    }

    setExisting(result.data)
    setMessage(wasActivated ? 'Link atualizado com sucesso.' : 'Card ativado com sucesso.')
    onSaved?.(result.data)
  }

  const isActivated = Boolean(existing?.destination_url)
  const normalizedCode = normalizeCode(code)
  const showCodeField = standalone

  return (
    <form className="stack-form" onSubmit={handleSubmit}>
      {showCodeField && (
        <label>
          Código do card
          <input
            type="text"
            value={code}
            onChange={(e) => setCode(normalizeCode(e.target.value))}
            placeholder="ex: x7k92m"
            maxLength={6}
            autoComplete="off"
          />
        </label>
      )}

      {loadingCard && <p className="muted">Carregando…</p>}
      {!loadingCard && showCodeField && normalizedCode.length === 6 && !existing && (
        <p className="form-hint error">Este código não existe no sistema.</p>
      )}
      {!loadingCard && existing && (
        <p className="form-hint">
          Código: <strong>{existing.code}</strong>
          {' · '}
          Status: <strong>{isActivated ? 'Ativado' : 'Virgem'}</strong>
          {isActivated && existing.activated_at && (
            <> · desde {new Date(existing.activated_at).toLocaleString('pt-BR')}</>
          )}
        </p>
      )}

      <label>
        Link de avaliação (HTTPS)
        <input
          type="url"
          value={destinationUrl}
          onChange={(e) => setDestinationUrl(e.target.value)}
          placeholder="https://…"
          disabled={loadingCard || !existing}
        />
      </label>

      <label>
        Estabelecimento (opcional)
        <input
          type="text"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Nome do estabelecimento"
          disabled={loadingCard || !existing}
        />
      </label>

      {error && <p className="form-hint error">{error}</p>}
      {message && <p className="form-hint success">{message}</p>}

      <button
        type="submit"
        className="btn primary"
        disabled={loading || !existing || loadingCard}
      >
        {loading ? 'Salvando…' : isActivated ? 'Atualizar link' : 'Ativar card'}
      </button>
    </form>
  )
}
