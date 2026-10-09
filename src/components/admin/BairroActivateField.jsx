import { useEffect, useRef, useState } from 'react'
import { blockEmptyBackspaceNav } from '../../utils/formInput.js'
import { getLocationPathLabels, searchBairrosByPrefix } from '../../utils/locationApi.js'
import CreateBairroModal from './CreateBairroModal.jsx'

const DEBOUNCE_MS = 280

export default function BairroActivateField({
  bairroId,
  onBairroIdChange,
  onBeforeBairroChange,
  disabled,
}) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])
  const [pathLabel, setPathLabel] = useState('')
  const [openList, setOpenList] = useState(false)
  const [createOpen, setCreateOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const wrapRef = useRef(null)

  useEffect(() => {
    if (!bairroId) {
      setPathLabel('')
      return
    }
    let cancelled = false
    getLocationPathLabels(bairroId).then(({ data }) => {
      if (!cancelled) {
        setPathLabel(data ?? '')
      }
    })
    return () => {
      cancelled = true
    }
  }, [bairroId])

  useEffect(() => {
    const term = query.trim()
    if (!term) {
      setResults([])
      return
    }
    let cancelled = false
    const timer = window.setTimeout(async () => {
      setLoading(true)
      const { data } = await searchBairrosByPrefix(term)
      if (cancelled) return
      setLoading(false)
      setResults(data ?? [])
      setOpenList(true)
    }, DEBOUNCE_MS)
    return () => {
      cancelled = true
      window.clearTimeout(timer)
    }
  }, [query])

  useEffect(() => {
    function onDocDown(e) {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) {
        setOpenList(false)
      }
    }
    document.addEventListener('mousedown', onDocDown)
    return () => document.removeEventListener('mousedown', onDocDown)
  }, [])

  async function selectBairro(item) {
    if (onBeforeBairroChange) {
      const allowed = await onBeforeBairroChange(item.id)
      if (!allowed) return
    }
    onBairroIdChange(item.id)
    setPathLabel(item.pathLabel ?? item.name)
    setQuery('')
    setOpenList(false)
    setResults([])
  }

  function clearSelectedBairro() {
    if (disabled) return
    onBairroIdChange(null)
    setPathLabel('')
    setQuery('')
    setOpenList(false)
    setResults([])
  }

  const showEmpty =
    openList && query.trim() && !loading && results.length === 0 && !disabled

  return (
    <div className="bairro-field" ref={wrapRef}>
      <label>
        Escolha um Bairro
        {bairroId && pathLabel ? (
          <div className="bairro-selected-path-row">
            <p className="bairro-selected-path muted">{pathLabel}</p>
            <button
              type="button"
              className="bairro-clear-btn"
              aria-label="Remover bairro selecionado"
              title="Remover bairro"
              disabled={disabled}
              onClick={clearSelectedBairro}
            >
              ×
            </button>
          </div>
        ) : null}
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={blockEmptyBackspaceNav}
          onFocus={() => query.trim() && setOpenList(true)}
          placeholder="nome do bairro"
          disabled={disabled}
          autoComplete="off"
        />
      </label>

      {openList && results.length > 0 && (
        <ul className="bairro-suggest-list" role="listbox">
          {results.map((item) => (
            <li key={item.id}>
              <button type="button" className="bairro-suggest-item" onClick={() => selectBairro(item)}>
                <span className="bairro-suggest-name">{item.name}</span>
                <span className="bairro-suggest-path muted">{item.pathLabel}</span>
              </button>
            </li>
          ))}
        </ul>
      )}

      {showEmpty && (
        <div className="bairro-suggest-empty">
          <p className="form-hint muted">Nenhum bairro criado com este nome.</p>
          <button type="button" className="btn secondary small" onClick={() => setCreateOpen(true)}>
            Criar
          </button>
        </div>
      )}

      <CreateBairroModal
        open={createOpen}
        initialBairroName={query.trim()}
        onClose={() => setCreateOpen(false)}
        onCreated={async (node) => {
          if (onBeforeBairroChange) {
            const allowed = await onBeforeBairroChange(node.id)
            if (!allowed) return
          }
          const { data } = await getLocationPathLabels(node.id)
          onBairroIdChange(node.id)
          setPathLabel(data ?? node.name)
          setQuery('')
          setOpenList(false)
          setResults([])
        }}
      />
    </div>
  )
}
