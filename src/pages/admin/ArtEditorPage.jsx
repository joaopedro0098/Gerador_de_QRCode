import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import ArtSessionCard from '../../components/admin/art/ArtSessionCard.jsx'
import { createArtSession, listArtSessions } from '../../utils/artSessionApi.js'

function sortSessionsByCreatedAt(sessions) {
  return [...sessions].sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
  )
}

export default function ArtEditorPage() {
  const [sessions, setSessions] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const primarySessionId = useMemo(() => {
    if (!sessions.length) return null
    return sortSessionsByCreatedAt(sessions)[0].id
  }, [sessions])

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    const { data, error: err } = await listArtSessions()
    if (err) {
      setLoading(false)
      setError(err.message)
      return
    }

    let list = data ?? []
    if (!list.length) {
      const { data: created, error: createErr } = await createArtSession()
      if (createErr) {
        setLoading(false)
        setError(createErr.message)
        return
      }
      if (created) list = [created]
    }

    setSessions(sortSessionsByCreatedAt(list))
    setLoading(false)
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
    setSessions((prev) => sortSessionsByCreatedAt([...prev, data]))
  }

  function handleSessionUpdated(updated) {
    setSessions((prev) =>
      sortSessionsByCreatedAt(prev.map((s) => (s.id === updated.id ? updated : s))),
    )
  }

  function handleDeleted(id) {
    setSessions((prev) => prev.filter((s) => s.id !== id))
  }

  return (
    <div className="admin-page">
      <header className="page-header page-header-row">
        <div className="page-header-leading">
          <Link to="/admin" className="btn secondary small btn-back" aria-label="Voltar para Home">
            ← Voltar
          </Link>
          <div>
            <h1>Upload</h1>
            <p className="muted">Suba sua arte para ajustar a posição do QR code</p>
          </div>
        </div>
        <button type="button" className="btn primary" onClick={handleAddSession}>
          Adicionar sessão
        </button>
      </header>

      {loading && <p className="muted">Carregando…</p>}
      {error && <p className="form-hint error">{error}</p>}

      <div className="art-sessions-list">
        {sessions.map((session, index) => (
          <ArtSessionCard
            key={session.id}
            session={session}
            sessionNumber={index + 1}
            canDelete={session.id !== primarySessionId}
            onSessionUpdated={handleSessionUpdated}
            onDeleted={handleDeleted}
          />
        ))}
      </div>
    </div>
  )
}
