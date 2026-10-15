import { useEffect, useRef, useState } from 'react'
import { blockEmptyBackspaceNav } from '../../utils/formInput.js'
import {
  fetchLocationChainFromBairroId,
  LOCATION_LEVEL_LABEL,
  searchLocationChildren,
} from '../../utils/locationApi.js'

const DEBOUNCE_MS = 200
const LEVELS = ['estado', 'cidade', 'distrito', 'bairro']

const EMPTY_CHAIN = { estado: null, cidade: null, distrito: null, bairro: null }

function parentIdForLevel(level, chain) {
  if (level === 'estado') return null
  if (level === 'cidade') return chain.estado?.id ?? null
  if (level === 'distrito') return chain.cidade?.id ?? null
  if (level === 'bairro') return chain.distrito?.id ?? null
  return null
}

function levelDisabled(level, chain, formDisabled) {
  if (formDisabled) return true
  if (level === 'estado') return false
  return !parentIdForLevel(level, chain)
}

function placeholderForLevel(level, chain) {
  if (level === 'estado') return 'nome do estado'
  if (level === 'cidade' && !chain.estado) return 'selecione o estado acima'
  if (level === 'distrito' && !chain.cidade) return 'selecione a cidade acima'
  if (level === 'bairro' && !chain.distrito) return 'selecione o distrito acima'
  return `nome do ${LOCATION_LEVEL_LABEL[level].toLowerCase()}`
}

function LocationLevelField({
  level,
  chain,
  selected,
  onSelect,
  onTypingClearsSelection,
  formDisabled,
}) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])
  const [openList, setOpenList] = useState(false)
  const [loading, setLoading] = useState(false)
  const wrapRef = useRef(null)

  const disabled = levelDisabled(level, chain, formDisabled)
  const parentId = parentIdForLevel(level, chain)

  useEffect(() => {
    setQuery('')
    setResults([])
    setOpenList(false)
  }, [parentId, selected?.id])

  useEffect(() => {
    if (!openList || disabled) {
      return
    }
    if (level !== 'estado' && !parentId) {
      return
    }

    let cancelled = false
    const term = query.trim()
    const delay = term ? DEBOUNCE_MS : 0

    const timer = window.setTimeout(async () => {
      setLoading(true)
      const { data } = await searchLocationChildren({
        level,
        parentId: level === 'estado' ? null : parentId,
        prefix: term,
      })
      if (cancelled) return
      setLoading(false)
      setResults(data ?? [])
    }, delay)

    return () => {
      cancelled = true
      window.clearTimeout(timer)
    }
  }, [openList, query, level, parentId, disabled])

  useEffect(() => {
    function onDocDown(e) {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) {
        setOpenList(false)
      }
    }
    document.addEventListener('mousedown', onDocDown)
    return () => document.removeEventListener('mousedown', onDocDown)
  }, [])

  const displayValue = query !== '' ? query : (selected?.name ?? '')

  const showEmpty = openList && !loading && results.length === 0 && !disabled

  function handleChange(e) {
    const next = e.target.value
    setQuery(next)
    if (selected && next !== selected.name) {
      onTypingClearsSelection()
    }
    setOpenList(true)
  }

  function handleFocus() {
    if (disabled) return
    setOpenList(true)
  }

  function pickItem(item) {
    onSelect(item)
    setQuery('')
    setOpenList(false)
    setResults([])
  }

  return (
    <div className="location-level-field" ref={wrapRef}>
      <label>
        {LOCATION_LEVEL_LABEL[level]}
        <input
          type="text"
          value={displayValue}
          onChange={handleChange}
          onKeyDown={blockEmptyBackspaceNav}
          onFocus={handleFocus}
          placeholder={placeholderForLevel(level, chain)}
          disabled={disabled}
          autoComplete="off"
        />
      </label>

      {openList && results.length > 0 && (
        <ul className="bairro-suggest-list" role="listbox">
          {results.map((item) => (
            <li key={item.id}>
              <button type="button" className="bairro-suggest-item" onClick={() => pickItem(item)}>
                <span className="bairro-suggest-name">{item.name}</span>
              </button>
            </li>
          ))}
        </ul>
      )}

      {showEmpty && (
        <div className="bairro-suggest-empty">
          <p className="form-hint muted">Não encontrado.</p>
        </div>
      )}
    </div>
  )
}

export default function BairroActivateField({
  bairroId,
  onBairroIdChange,
  onBeforeBairroChange,
  disabled,
}) {
  const [chain, setChain] = useState(EMPTY_CHAIN)

  useEffect(() => {
    if (!bairroId) return
    let cancelled = false
    fetchLocationChainFromBairroId(bairroId).then(({ data }) => {
      if (!cancelled && data) {
        setChain(data)
      }
    })
    return () => {
      cancelled = true
    }
  }, [bairroId])

  function clearFromLevel(level) {
    const idx = LEVELS.indexOf(level)
    const next = { ...chain }
    for (let i = idx; i < LEVELS.length; i += 1) {
      next[LEVELS[i]] = null
    }
    setChain(next)
    if (level !== 'bairro' || chain.bairro) {
      onBairroIdChange(null)
    }
  }

  async function selectAtLevel(level, node) {
    const idx = LEVELS.indexOf(level)
    const next = { ...chain }
    for (let i = idx; i < LEVELS.length; i += 1) {
      next[LEVELS[i]] = i === idx ? node : null
    }
    setChain(next)

    if (level === 'bairro' && node) {
      if (onBeforeBairroChange) {
        const allowed = await onBeforeBairroChange(node.id)
        if (!allowed) {
          if (bairroId) {
            fetchLocationChainFromBairroId(bairroId).then(({ data }) => {
              if (data) setChain(data)
            })
          }
          return
        }
      }
      onBairroIdChange(node.id)
    } else {
      onBairroIdChange(null)
    }
  }

  return (
    <div className="bairro-field location-cascade-fields">
      {LEVELS.map((level) => (
        <LocationLevelField
          key={level}
          level={level}
          chain={chain}
          selected={chain[level]}
          formDisabled={disabled}
          onSelect={(node) => {
            if (!node) {
              clearFromLevel(level)
              return
            }
            selectAtLevel(level, node)
          }}
          onTypingClearsSelection={() => clearFromLevel(level)}
        />
      ))}
    </div>
  )
}
