import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { supabase } from '../../lib/supabase.js'
import { normalizeCode } from '../../utils/codes.js'

const MESSAGES = {
  not_found: {
    title: 'Código não encontrado',
    body: 'Este QR code não está cadastrado no sistema.',
  },
  not_activated: {
    title: 'QR code virgem.',
    body: null,
  },
}

export default function RedirectPage() {
  const { codigo } = useParams()
  const [state, setState] = useState({ kind: 'loading' })

  useEffect(() => {
    const code = normalizeCode(codigo)
    if (!code) {
      setState({ kind: 'error', ...MESSAGES.not_found })
      return
    }

    let cancelled = false

    supabase
      .rpc('lookup_card_redirect', { p_code: code })
      .then(({ data, error }) => {
        if (cancelled) return
        if (error) {
          setState({
            kind: 'error',
            title: 'Algo deu errado',
            body: 'Não foi possível consultar este código. Tente novamente em instantes.',
          })
          return
        }

        if (data.status === 'ok' && data.destination_url) {
          window.location.replace(data.destination_url)
          setState({ kind: 'redirecting' })
          return
        }

        if (data.status === 'not_activated') {
          setState({ kind: 'error', ...MESSAGES.not_activated })
          return
        }

        setState({ kind: 'error', ...MESSAGES.not_found })
      })

    return () => {
      cancelled = true
    }
  }, [codigo])

  if (state.kind === 'loading' || state.kind === 'redirecting') {
    return (
      <div className="public-page">
        <div className="public-card">
          <p>{state.kind === 'redirecting' ? 'Redirecionando…' : 'Carregando…'}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="public-page">
      <div className="public-card">
        <h1>{state.title}</h1>
        {state.body ? <p>{state.body}</p> : null}
      </div>
    </div>
  )
}
