import { Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'

export default function RootRedirect() {
  const { session, loading } = useAuth()

  if (loading) {
    return (
      <div className="page-center">
        <p className="muted">Carregando…</p>
      </div>
    )
  }

  return <Navigate to={session ? '/admin' : '/admin/login'} replace />
}
