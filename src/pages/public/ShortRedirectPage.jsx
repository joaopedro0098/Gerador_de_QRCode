import { useLayoutEffect } from 'react'
import { useParams } from 'react-router-dom'

/**
 * Fallback se /r/:code cair no SPA: delega ao endpoint serverless (302),
 * sem carregar Supabase no cliente.
 */
export default function ShortRedirectPage() {
  const { code } = useParams()

  useLayoutEffect(() => {
    const trimmed = String(code ?? '').trim()
    if (!trimmed) {
      window.location.replace('/')
      return
    }
    window.location.replace(`/api/redirect/${encodeURIComponent(trimmed)}`)
  }, [code])

  return null
}
