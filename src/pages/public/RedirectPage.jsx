import { useEffect, useState } from 'react'
import { Navigate, useParams } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext.jsx'
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
  paused: {
    title: 'Serviço pausado',
    body: 'Serviço temporariamente pausado. Acione a empresa responsável.',
  },
}

export default function RedirectPage() {
  const { codigo } = useParams()
  const { session, loading: authLoading } = useAuth()
  const [state, setState] = useState({ kind: 'loading' })
  const [adminActivateCode, setAdminActivateCode] = useState(null)

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
          setAdminActivateCode(code)
          setState({ kind: 'virgin' })
          return
        }

        if (data.status === 'paused') {
          setState({
            kind: 'error',
            title: MESSAGES.paused.title,
            body: data.message ?? MESSAGES.paused.body,
          })
          return
        }

        setState({ kind: 'error', ...MESSAGES.not_found })
      })

    return () => {
      cancelled = true
    }
  }, [codigo])

  if (state.kind === 'virgin' && adminActivateCode) {
    if (authLoading) {
      return (
        <div className="public-page">
          <div className="public-card">
            <p>Carregando…</p>
          </div>
        </div>
      )
    }
    const adminPath = `/admin?code=${encodeURIComponent(adminActivateCode)}`
    if (session) {
      return <Navigate to={adminPath} replace />
    }
    const returnTo = encodeURIComponent(adminPath)
    return <Navigate to={`/admin/login?returnTo=${returnTo}`} replace />
  }

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
