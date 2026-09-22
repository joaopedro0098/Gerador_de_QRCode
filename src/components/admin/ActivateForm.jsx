import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../../lib/supabase.js'
import { normalizeCode } from '../../utils/codes.js'
import { isValidHttpsUrl } from '../../utils/validate.js'

export default function ActivateForm({ initialCode = '' }) {
  const [code, setCode] = useState(initialCode)
  const [destinationUrl, setDestinationUrl] = useState('')
  const [notes, setNotes] = useState('')
  const [loading, setLoading] = useState(false)
  const [loadingCard, setLoadingCard] = useState(false)
  const [message, setMessage] = useState(null)
  const [error, setError] = useState(null)
  const [existing, setExisting] = useState(null)

  useEffect(() => {
    setCode(initialCode)
  }, [initialCode])

  useEffect(() => {
    const normalized = normalizeCode(code)
    if (normalized.length !== 6) {
      setExisting(null)
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
        if (fetchError) {
          setExisting(null)
          return
        }
        setExisting(data)
        if (data) {
          setDestinationUrl(data.destination_url ?? '')
          setNotes(data.notes ?? '')
        } else {
          setDestinationUrl('')
          setNotes('')
        }
      })

    return () => {
      cancelled = true
    }
  }, [code])

  async function handleSubmit(e) {
    e.preventDefault()
    setError(null)
    setMessage(null)

    const normalized = normalizeCode(code)
    if (normalized.length !== 6) {
      setError('Informe um código válido com 6 caracteres.')
      return
    }

    const url = destinationUrl.trim()
    if (!isValidHttpsUrl(url)) {
      setError('O link de destino deve ser uma URL HTTPS válida.')
      return
    }

    setLoading(true)

    const payload = {
      destination_url: url,
      activated_at: new Date().toISOString(),
      notes: notes.trim() || null,
    }

    let result
    if (existing) {
      result = await supabase.from('cards').update(payload).eq('id', existing.id).select().single()
    } else {
      setError('Código não encontrado. Gere o lote antes de ativar.')
      setLoading(false)
      return
    }

    setLoading(false)

    if (result.error) {
      setError(result.error.message)
      return
    }

    setExisting(result.data)
    setMessage(
      existing?.destination_url
        ? 'Link atualizado com sucesso.'
        : 'Card ativado com sucesso.',
    )
  }

  const isActivated = Boolean(existing?.destination_url)

  return (
    <form className="stack-form" onSubmit={handleSubmit}>
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

      {loadingCard && <p className="muted">Buscando código…</p>}
      {!loadingCard && code.length === 6 && !existing && (
        <p className="form-hint error">Este código não existe no sistema.</p>
      )}
      {!loadingCard && existing && (
        <p className="form-hint">
          Status:{' '}
          <strong>{isActivated ? 'Ativado' : 'Virgem (não ativado)'}</strong>
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
        />
      </label>

      <label>
        Observações (opcional)
        <input
          type="text"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Nome do cliente, etc."
        />
      </label>

      {error && <p className="form-hint error">{error}</p>}
      {message && <p className="form-hint success">{message}</p>}

      <div className="form-actions">
        <button
          type="submit"
          className="btn primary"
          disabled={loading || !existing || loadingCard}
        >
          {loading ? 'Salvando…' : isActivated ? 'Atualizar link' : 'Ativar card'}
        </button>
        {existing && (
          <Link className="btn secondary" to={`/admin?code=${existing.code}`}>
            Ver na lista
          </Link>
        )}
      </div>
    </form>
  )
}
