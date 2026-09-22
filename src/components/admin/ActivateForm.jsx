import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase.js'
import { isValidHttpsUrl } from '../../utils/validate.js'

export default function ActivateForm({ card, onSaved }) {
  const [destinationUrl, setDestinationUrl] = useState('')
  const [notes, setNotes] = useState('')
  const [loading, setLoading] = useState(false)
  const [loadingCard, setLoadingCard] = useState(true)
  const [message, setMessage] = useState(null)
  const [error, setError] = useState(null)
  const [existing, setExisting] = useState(null)

  useEffect(() => {
    if (!card?.id) return

    let cancelled = false
    setMessage(null)
    setError(null)
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
  }, [card?.id])

  async function handleSubmit(e) {
    e.preventDefault()
    setError(null)
    setMessage(null)

    if (!existing) {
      setError('Não foi possível carregar este código.')
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

  return (
    <form className="stack-form" onSubmit={handleSubmit}>
      {loadingCard && <p className="muted">Carregando…</p>}
      {!loadingCard && existing && (
        <p className="form-hint">
          Status:{' '}
          <strong>{isActivated ? 'Ativado' : 'Virgem'}</strong>
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
        Observações (opcional)
        <input
          type="text"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Nome do cliente, etc."
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
