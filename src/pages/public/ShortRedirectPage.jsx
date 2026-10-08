import { useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { supabase } from '../../lib/supabase.js'

/** Fallback quando /r/:code cai no SPA (sem 302 serverless). Redirecionamento imediato, sem UI. */
export default function ShortRedirectPage() {
  const { code } = useParams()

  useEffect(() => {
    const trimmed = String(code ?? '').trim()
    if (!trimmed) {
      window.location.replace('/')
      return
    }

    let cancelled = false
    supabase.rpc('resolve_short_link', { p_code: trimmed }).then(({ data, error }) => {
      if (cancelled) return
      if (!error && data) {
        window.location.replace(data)
        return
      }
      window.location.replace('/')
    })

    return () => {
      cancelled = true
    }
  }, [code])

  return null
}
