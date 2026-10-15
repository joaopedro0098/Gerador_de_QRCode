import { Fragment, forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react'
import ActivatedCardMobileList from './ActivatedCardMobileList.jsx'
import ActivatedNodeMenu from './ActivatedNodeMenu.jsx'
import LocationNodeModal from './LocationNodeModal.jsx'
import Pagination from '../ui/Pagination.jsx'
import {
  CHILD_LEVEL,
  LOCATION_LEVELS,
  LOCATION_LEVEL_LABEL,
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

const LAYER_PATH_STEPS = [
  { view: 'estado', label: 'Estados' },
  { view: 'cidade', label: 'Cidades' },
  { view: 'distrito', label: 'Distritos' },
  { view: 'bairro', label: 'Bairros' },
]

const PATH_DEPTH_BY_VIEW = {
  estado: 0,
  cidade: 1,
  distrito: 2,
  bairro: 3,
  cards: 3,
}

const EXPLORER_PAGE_SIZE = 10

function paginateItems(items, page) {
  const start = (page - 1) * EXPLORER_PAGE_SIZE
  return items.slice(start, start + EXPLORER_PAGE_SIZE)
}

function pageCountForLength(length) {
  return Math.max(1, Math.ceil(length / EXPLORER_PAGE_SIZE))
}

const EMPTY_CHILD_LAYER = {
  cidade: {
    message: 'Não há cidades cadastradas.',
    addLabel: 'Adicionar cidade',
    cancelView: 'estado',
  },
  distrito: {
    message: 'Não há distritos cadastrados.',
    addLabel: 'Adicionar distrito',
    cancelView: 'cidade',
  },
  bairro: {
    message: 'Não há bairros cadastrados.',
    addLabel: 'Adicionar bairro',
    cancelView: 'distrito',
  },
}

const ActivatedLocationsExplorer = forwardRef(function ActivatedLocationsExplorer(
  { onOpenCard, onAnnotationCard, refreshKey = 0 },
  ref,
) {
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
  const [error, setError] = useState(null)
  const [isFetching, setIsFetching] = useState(false)
  const [page, setPage] = useState(1)
  const [nodeModal, setNodeModal] = useState(null)
  const selectedRef = useRef(selected)
  const activeViewRef = useRef(activeView)
  const fetchGenRef = useRef(0)
  const countsGenRef = useRef(0)

  function blurActiveElement() {
    const el = document.activeElement
    if (el instanceof HTMLElement) el.blur()
  }

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

  const refreshActiveCounts = useCallback(async () => {
    const gen = ++countsGenRef.current
    const { counts, error: countsError } = await fetchLocationSubtreeActiveCounts()
    if (gen !== countsGenRef.current) return
    if (!countsError && counts) {
      setActiveCountByNodeId(counts)
    }
  }, [])

  const refreshForView = useCallback(
    async (sel, view, { refreshCounts = false } = {}) => {
      const gen = ++fetchGenRef.current
      setError(null)
      setPage(1)
      setIsFetching(true)
      setActiveView(view)
      activeViewRef.current = view

      try {
        if (view === 'cards') {
          if (!sel.bairro) {
            setCards([])
          } else {
            const { data, error: err } = await listActivatedCardsInBairro(sel.bairro.id)
            if (gen !== fetchGenRef.current) return
            if (err) throw err
            setCards(data ?? [])
          }
        } else {
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
          if (gen !== fetchGenRef.current) return
          setCurrentItems(items)
        }
      } catch (e) {
        if (gen !== fetchGenRef.current) return
        setError(e.message)
      } finally {
        if (gen === fetchGenRef.current) {
          setIsFetching(false)
        }
      }

      if (refreshCounts) {
        void refreshActiveCounts()
      }
    },
    [loadLevel, refreshActiveCounts],
  )

  useEffect(() => {
    void refreshForView(selectedRef.current, activeViewRef.current, { refreshCounts: true })
  }, [refreshKey, refreshForView])

  function selectNode(level, node) {
    blurActiveElement()
    const nextSel = buildSelection(selectedRef.current, level, node)
    setSelected(nextSel)
    selectedRef.current = nextSel
    const nextView = viewAfterSelectingLevel(level)
    void refreshForView(nextSel, nextView)
  }

  function goToView(view) {
    blurActiveElement()
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
    selectedRef.current = nextSel
    void refreshForView(nextSel, view)
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
    }
    setSelected(nextSel)
    const viewAfterDelete =
      level === 'estado'
        ? 'estado'
        : level === 'cidade'
          ? 'cidade'
          : level === 'distrito'
            ? 'distrito'
            : 'bairro'
    await refreshForView(nextSel, viewAfterDelete, { refreshCounts: true })
  }

  function openEditNode(node, level) {
    setNodeModal({
      mode: 'edit',
      level: node.level ?? level,
      parentId: node.parent_id,
      node,
    })
  }

  const openCreate = useCallback(() => {
    const view = activeViewRef.current
    if (view === 'cards') return
    const level = view
    const parentLevel = LOCATION_LEVELS[LOCATION_LEVELS.indexOf(level) - 1]
    const parentId = parentLevel ? selectedRef.current[parentLevel]?.id : null
    if (level !== 'estado' && !parentId) {
      setError(`Selecione ${LOCATION_LEVEL_LABEL[parentLevel]} antes.`)
      return
    }
    setNodeModal({ mode: 'create', level, parentId, node: null })
  }, [])

  useImperativeHandle(ref, () => ({ openCreate }), [openCreate])

  function openCreateAtCurrentLevel() {
    openCreate()
  }

  function cancelEmptyChildLayer() {
    const view = activeViewRef.current
    const copy = view && view !== 'cards' ? EMPTY_CHILD_LAYER[view] : null
    if (copy?.cancelView) goToView(copy.cancelView)
  }

  function renderLayerPathNav() {
    const currentDepth = PATH_DEPTH_BY_VIEW[activeView] ?? 0
    const visible = LAYER_PATH_STEPS.slice(0, currentDepth + 1)

    return (
      <nav className="location-layer-path" aria-label="Camadas de localização">
        {visible.map((step, index) => {
          const isCurrent = index === currentDepth
          return (
            <Fragment key={step.view}>
              {index > 0 && (
                <span className="location-layer-path-sep" aria-hidden>
                  {' '}
                  &gt;{' '}
                </span>
              )}
              {isCurrent ? (
                <span className="location-layer-type">{step.label}</span>
              ) : (
                <button
                  type="button"
                  className="location-layer-path-link"
                  onClick={() => goToView(step.view)}
                >
                  {step.label}
                </button>
              )}
            </Fragment>
          )
        })}
      </nav>
    )
  }

  const listLevel = activeView === 'cards' ? null : activeView
  const selectedAtLevel = listLevel ? selected[listLevel] : null
  const paginatedNodes = listLevel ? paginateItems(currentItems, page) : []
  const paginatedCards = activeView === 'cards' ? paginateItems(cards, page) : []
  const nodesPageCount = pageCountForLength(currentItems.length)
  const cardsPageCount = pageCountForLength(cards.length)
  const explorerPageCount = activeView === 'cards' ? cardsPageCount : nodesPageCount

  useEffect(() => {
    if (page > explorerPageCount) {
      setPage(explorerPageCount)
    }
  }, [page, explorerPageCount])

  return (
    <div className="activated-explorer">
      {error && <p className="form-hint error">{error}</p>}

      <div className="activated-explorer-stage" aria-busy={isFetching ? 'true' : 'false'}>
        {(listLevel || activeView === 'cards') && (
          <div className="location-layer-head">{renderLayerPathNav()}</div>
        )}

        {listLevel && !isFetching && !currentItems.length && EMPTY_CHILD_LAYER[listLevel] ? (
          <div className="location-layer-empty-state">
            <p className="muted">{EMPTY_CHILD_LAYER[listLevel].message}</p>
            <button type="button" className="btn secondary small" onClick={openCreateAtCurrentLevel}>
              {EMPTY_CHILD_LAYER[listLevel].addLabel}
            </button>
            <button type="button" className="btn secondary small" onClick={cancelEmptyChildLayer}>
              Cancelar
            </button>
          </div>
        ) : null}

        {listLevel && (isFetching || currentItems.length > 0) && (
          <div
            className={`location-card-grid${isFetching ? ' location-card-grid--busy' : ''}`}
            aria-busy={isFetching ? 'true' : undefined}
          >
            {paginatedNodes.map((node) => (
              <div
                key={node.id}
                className={`location-chip-card${selectedAtLevel?.id === node.id ? ' selected' : ''}`}
              >
                <button
                  type="button"
                  className="location-chip-main location-chip-main-full"
                  onClick={() => selectNode(listLevel, node)}
                >
                  <span className="location-chip-label">{node.name}</span>
                  {(activeCountByNodeId.get(node.id) ?? 0) > 0 ? (
                    <span className="location-chip-count">{activeCountByNodeId.get(node.id)}</span>
                  ) : null}
                </button>
                <ActivatedNodeMenu
                  label={`Opções: ${node.name}`}
                  canDelete={listLevel !== 'bairro'}
                  onEdit={() => openEditNode(node, listLevel)}
                  onDelete={() => handleDeleteNode(listLevel, node)}
                />
              </div>
            ))}
          </div>
        )}

        {listLevel && currentItems.length > 0 && (
          <Pagination
            page={page}
            pageCount={nodesPageCount}
            onPageChange={setPage}
            disabled={isFetching}
            busy={isFetching}
          />
        )}

        {listLevel === 'estado' && !isFetching && !currentItems.length && (
          <p className="muted location-empty location-layer-empty-state">
            Nenhum estado cadastrado. Use Adicionar no topo.
          </p>
        )}

        {activeView === 'cards' && (
          <div
            className={`activated-explorer-cards${isFetching ? ' activated-explorer-cards--busy' : ''}`}
            aria-busy={isFetching ? 'true' : undefined}
          >
            <ActivatedCardMobileList cards={paginatedCards} onOpenCard={onOpenCard} />
            {!isFetching && !cards.length && (
              <p className="muted location-empty">Nenhum QR ativo neste bairro.</p>
            )}
            {cards.length > 0 && (
              <Pagination
                page={page}
                pageCount={cardsPageCount}
                onPageChange={setPage}
                disabled={isFetching}
                busy={isFetching}
              />
            )}
          </div>
        )}
      </div>

      <LocationNodeModal
        open={Boolean(nodeModal)}
        mode={nodeModal?.mode ?? 'create'}
        level={nodeModal?.level ?? 'estado'}
        parentId={nodeModal?.parentId ?? null}
        node={nodeModal?.node ?? null}
        onClose={() => setNodeModal(null)}
        onSaved={() =>
          refreshForView(selectedRef.current, activeViewRef.current, { refreshCounts: true })
        }
      />
    </div>
  )
})

export default ActivatedLocationsExplorer
