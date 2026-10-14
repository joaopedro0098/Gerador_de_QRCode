import { useLayoutEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { supabase } from '../../lib/supabase.js'
import { Navigate } from 'react-router-dom'

/**
 * Fallback quando /r/:code ou /api/redirect/:code cai no SPA (sem 302 na edge).
 * Resolve no Supabase e redireciona ao destino real — evita mandar visitante para / admin.
 */
export default function ShortRedirectPage() {
  const { code } = useParams()
  const [failed, setFailed] = useState(false)

  useLayoutEffect(() => {
    const trimmed = String(code ?? '').trim()
    if (!trimmed) {
      setFailed(true)
      return
    }

    let cancelled = false
    supabase.rpc('resolve_short_link', { p_code: trimmed }).then(({ data, error }) => {
      if (cancelled) return
      if (!error && data) {
        window.location.replace(data)
        return
      }
      setFailed(true)
    })

    return () => {
      cancelled = true
    }
  }, [code])

  if (failed) {
    return <Navigate to="/link-indisponivel" replace />
  }

  return null
}
