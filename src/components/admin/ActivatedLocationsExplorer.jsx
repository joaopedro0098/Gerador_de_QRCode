import { useCallback, useEffect, useRef, useState } from 'react'
import CardsTable from './CardsTable.jsx'
import LocationNodeModal from './LocationNodeModal.jsx'
import {
  CHILD_LEVEL,
  LOCATION_LEVELS,
  LOCATION_LEVEL_LABEL,
  PARENT_LEVEL,
  deleteLocationNode,
  fetchLocationSubtreeActiveCounts,
  listActivatedCardsInBairro,
  listLocationChildren,
} from '../../utils/locationApi.js'

function buildSelection(prev, level, node) {
  const levelIndex = LOCATION_LEVELS.indexOf(level)
  const next = { ...prev, [level]: node }
  for (let i = levelIndex + 1; i < LOCATION_LEVELS.length; i++) {
    next[LOCATION_LEVELS[i]] = null
  }
  return next
}

function trimSelection(sel, upToLevel) {
  const levelIndex = LOCATION_LEVELS.indexOf(upToLevel)
  const next = { ...sel }
  for (let i = levelIndex + 1; i < LOCATION_LEVELS.length; i++) {
    next[LOCATION_LEVELS[i]] = null
  }
  return next
}

function viewAfterSelectingLevel(level) {
  if (level === 'bairro') return 'cards'
  return CHILD_LEVEL[level]
}

export default function ActivatedLocationsExplorer({
  onSelectCard,
  onActivateCard,
  onDeactivateCard,
  onPauseCard,
  onAnnotationCard,
  refreshKey = 0,
}) {
  const [activeView, setActiveView] = useState('estado')
  const [selected, setSelected] = useState({
    estado: null,
    cidade: null,
    distrito: null,
    bairro: null,
  })
  const [currentItems, setCurrentItems] = useState([])
  const [cards, setCards] = useState([])
  const [activeCountByNodeId, setActiveCountByNodeId] = useState(() => new Map())
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [nodeModal, setNodeModal] = useState(null)
  const selectedRef = useRef(selected)
  const activeViewRef = useRef(activeView)

  useEffect(() => {
    selectedRef.current = selected
  }, [selected])

  useEffect(() => {
    activeViewRef.current = activeView
  }, [activeView])

  const loadLevel = useCallback(async (level, parentId) => {
    const { data, error: err } = await listLocationChildren(parentId, level)
    if (err) throw err
    return data ?? []
  }, [])

  const refreshForView = useCallback(
    async (sel, view) => {
      setLoading(true)
      setError(null)
      try {
        const { counts, error: countsError } = await fetchLocationSubtreeActiveCounts()
        if (countsError) throw countsError
        setActiveCountByNodeId(counts)

        if (view === 'cards') {
          if (!sel.bairro) {
            setCards([])
          } else {
            const { data, error: err } = await listActivatedCardsInBairro(sel.bairro.id)
            if (err) throw err
            setCards(data ?? [])
          }
          setCurrentItems([])
        } else {
          setCards([])
          let parentId = null
          if (view === 'cidade') {
            if (!sel.estado) throw new Error('Selecione um estado.')
            parentId = sel.estado.id
          } else if (view === 'distrito') {
            if (!sel.cidade) throw new Error('Selecione uma cidade.')
            parentId = sel.cidade.id
          } else if (view === 'bairro') {
            if (!sel.distrito) throw new Error('Selecione um distrito.')
            parentId = sel.distrito.id
          }
          const items = await loadLevel(view, parentId)
          setCurrentItems(items)
        }

        setActiveView(view)
      } catch (e) {
        setError(e.message)
      } finally {
        setLoading(false)
      }
    },
    [loadLevel],
  )

  useEffect(() => {
    refreshForView(selectedRef.current, activeViewRef.current)
  }, [refreshKey, refreshForView])

  async function selectNode(level, node) {
    const nextSel = buildSelection(selectedRef.current, level, node)
    setSelected(nextSel)
    const nextView = viewAfterSelectingLevel(level)
    await refreshForView(nextSel, nextView)
  }

  async function goToView(view) {
    let nextSel = selectedRef.current
    if (view === 'estado') {
      nextSel = { estado: null, cidade: null, distrito: null, bairro: null }
    } else if (view === 'cidade') {
      nextSel = trimSelection(nextSel, 'estado')
    } else if (view === 'distrito') {
      nextSel = trimSelection(nextSel, 'cidade')
    } else if (view === 'bairro') {
      nextSel = trimSelection(nextSel, 'distrito')
    } else if (view === 'cards') {
      if (!nextSel.bairro) return
    }
    setSelected(nextSel)
    await refreshForView(nextSel, view)
  }

  async function handleDeleteNode(level, node) {
    if (!window.confirm(`Excluir "${node.name}"?`)) return
    const { error: err } = await deleteLocationNode(node.id)
    if (err) {
      setError(err.message)
      return
    }
    let nextSel = selectedRef.current
    if (nextSel[level]?.id === node.id) {
      nextSel = buildSelection(nextSel, level, null)
      setSelected(nextSel)
    }
    await refreshForView(nextSel, activeViewRef.current)
  }

  function openCreate() {
    if (activeView === 'cards') return
    const level = activeView
    const parentLevel = LOCATION_LEVELS[LOCATION_LEVELS.indexOf(level) - 1]
    const parentId = parentLevel ? selectedRef.current[parentLevel]?.id : null
    if (level !== 'estado' && !parentId) {
      setError(`Selecione ${LOCATION_LEVEL_LABEL[parentLevel]} antes.`)
      return
    }
    setNodeModal({ mode: 'create', level, parentId, node: null })
  }

  function layerTitle() {
    if (activeView === 'cards') {
      const b = selected.bairro
      return b ? `QR codes em «${b.name}»` : 'QR codes ativos'
    }
    const parentLevel = PARENT_LEVEL[activeView]
    const parent = parentLevel ? selected[parentLevel] : null
    if (parent) return `${LOCATION_LEVEL_LABEL[activeView]} em «${parent.name}»`
    return LOCATION_LEVEL_LABEL[activeView]
  }

  function renderBreadcrumb() {
    return (
      <nav className="activated-breadcrumb-nav" aria-label="Localização">
        <button type="button" className="activated-crumb" onClick={() => goToView('estado')}>
          Estados
        </button>
        {selected.estado && (
          <>
            <span className="activated-crumb-sep" aria-hidden>
              ›
            </span>
            <button type="button" className="activated-crumb" onClick={() => goToView('cidade')}>
              {selected.estado.name}
            </button>
          </>
        )}
        {selected.cidade && (
          <>
            <span className="activated-crumb-sep" aria-hidden>
              ›
            </span>
            <button type="button" className="activated-crumb" onClick={() => goToView('distrito')}>
              {selected.cidade.name}
            </button>
          </>
        )}
        {selected.distrito && (
          <>
            <span className="activated-crumb-sep" aria-hidden>
              ›
            </span>
            <button type="button" className="activated-crumb" onClick={() => goToView('bairro')}>
              {selected.distrito.name}
            </button>
          </>
        )}
        {selected.bairro && (
          <>
            <span className="activated-crumb-sep" aria-hidden>
              ›
            </span>
            <button
              type="button"
              className={`activated-crumb${activeView === 'cards' ? ' current' : ''}`}
              onClick={() => goToView('cards')}
            >
              {selected.bairro.name}
            </button>
          </>
        )}
      </nav>
    )
  }

  const listLevel = activeView === 'cards' ? null : activeView
  const selectedAtLevel = listLevel ? selected[listLevel] : null

  return (
    <div className="activated-explorer">
      {renderBreadcrumb()}

      {error && <p className="form-hint error">{error}</p>}
      {loading && <p className="muted">Carregando…</p>}

      <div className="activated-explorer-stage">
        <div className="location-layer-head">
          <span className="location-layer-type muted">{layerTitle()}</span>
          {listLevel && (
            <button type="button" className="btn secondary small" onClick={openCreate}>
              + Adicionar
            </button>
          )}
        </div>

        {listLevel && (
          <div className="location-card-grid">
            {currentItems.map((node) => (
              <div
                key={node.id}
                className={`location-chip-card${selectedAtLevel?.id === node.id ? ' selected' : ''}`}
              >
                <button
                  type="button"
                  className="location-chip-main"
                  onClick={() => selectNode(listLevel, node)}
                >
                  {node.name}
                  {(activeCountByNodeId.get(node.id) ?? 0) > 0 ? (
                    <span className="location-chip-count">{activeCountByNodeId.get(node.id)}</span>
                  ) : null}
                </button>
                <div className="location-chip-actions">
                  <button
                    type="button"
                    className="btn-icon small"
                    aria-label="Editar"
                    onClick={() =>
                      setNodeModal({ mode: 'edit', level: listLevel, parentId: node.parent_id, node })
                    }
                  >
                    ✎
                  </button>
                  <button
                    type="button"
                    className="btn-icon small danger-text"
                    aria-label="Excluir"
                    onClick={() => handleDeleteNode(listLevel, node)}
                  >
                    ×
                  </button>
                </div>
              </div>
            ))}
            {!loading && !currentItems.length && (
              <p className="muted location-empty">
                Nenhum item nesta camada. Use + Adicionar ou volte e escolha outro caminho.
              </p>
            )}
          </div>
        )}

        {activeView === 'cards' && !loading && (
          <>
            <button
              type="button"
              className="btn secondary small location-back-btn"
              onClick={() => goToView('bairro')}
            >
              ← Voltar aos bairros
            </button>
            <CardsTable
              cards={cards}
              onSelectCard={onSelectCard}
              onActivateCard={onActivateCard}
              onDeactivateCard={onDeactivateCard}
              onPauseCard={onPauseCard}
              onAnnotationCard={onAnnotationCard}
            />
            {!cards.length && (
              <p className="muted location-empty">Nenhum QR ativo neste bairro.</p>
            )}
          </>
        )}
      </div>

      <LocationNodeModal
        open={Boolean(nodeModal)}
        mode={nodeModal?.mode ?? 'create'}
        level={nodeModal?.level ?? 'estado'}
        parentId={nodeModal?.parentId ?? null}
        node={nodeModal?.node ?? null}
        onClose={() => setNodeModal(null)}
        onSaved={() => refreshForView(selectedRef.current, activeViewRef.current)}
      />
    </div>
  )
}
