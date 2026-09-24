import { useCallback, useEffect, useState } from 'react'
import ArtSessionCard from '../../components/admin/art/ArtSessionCard.jsx'
import { createArtSession, listArtSessions } from '../../utils/artSessionApi.js'

export default function ArtEditorPage() {
  const [sessions, setSessions] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const load = useCallback(async () => {
    setLoading(true)
    const { data, error: err } = await listArtSessions()
    setLoading(false)
    if (err) {
      setError(err.message)
      return
    }
    setSessions(data ?? [])
  }, [])

  useEffect(() => {
    load()
  }, [load])

  async function handleAddSession() {
    setError(null)
    const { data, error: err } = await createArtSession()
    if (err) {
      setError(err.message)
      return
    }
    setSessions((prev) => [...prev, data])
  }

  function handleSessionUpdated(updated) {
    setSessions((prev) => prev.map((s) => (s.id === updated.id ? updated : s)))
  }

  function handleDeleted(id) {
    setSessions((prev) => prev.filter((s) => s.id !== id))
  }

  return (
    <div className="admin-page">
      <header className="page-header page-header-row">
        <div>
          <h1>Arte dos cards</h1>
          <p className="muted">Sessões independentes com posição de QR para impressão.</p>
        </div>
        <button type="button" className="btn primary" onClick={handleAddSession}>
          Adicionar sessão
        </button>
      </header>

      {loading && <p className="muted">Carregando…</p>}
      {error && <p className="form-hint error">{error}</p>}

      <div className="art-sessions-list">
        {sessions.map((session) => (
          <ArtSessionCard
            key={session.id}
            session={session}
            onSessionUpdated={handleSessionUpdated}
            onDeleted={handleDeleted}
          />
        ))}
      </div>

      {!loading && !sessions.length && (
        <p className="muted">Nenhuma sessão. Clique em Adicionar sessão.</p>
      )}
    </div>
  )
}
