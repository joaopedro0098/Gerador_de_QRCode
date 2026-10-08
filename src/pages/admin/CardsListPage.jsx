import { useCallback, useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import ActivatedLocationsExplorer from '../../components/admin/ActivatedLocationsExplorer.jsx'
import BatchGenerateModal from '../../components/admin/BatchGenerateModal.jsx'
import CardAnnotationModal from '../../components/admin/CardAnnotationModal.jsx'
import CardDetailModal from '../../components/admin/CardDetailModal.jsx'
import CardsTable from '../../components/admin/CardsTable.jsx'
import Pagination from '../../components/ui/Pagination.jsx'
import { CARD_FIELDS } from '../../utils/cardActivation.js'
import {
  applyActivatedCardsFilter,
  applyVirginCardsFilter,
  isCardActivated,
} from '../../utils/cardStatus.js'
import { PAGE_SIZE } from '../../lib/config.js'
import { supabase } from '../../lib/supabase.js'
import { searchActivatedCards } from '../../utils/locationApi.js'
import { isLojaCode, normalizeCode } from '../../utils/codes.js'
import { escapeIlikePrefix, normalizeEstablishmentSearch } from '../../utils/search.js'

const STATUS_FILTERS = [
  { value: 'virgin', label: 'Virgens' },
  { value: 'activated', label: 'Ativados' },
]

const SEARCH_DEBOUNCE_MS = 280

export default function CardsListPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const [cards, setCards] = useState([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [filter, setFilter] = useState('all')
  const [search, setSearch] = useState('')
  const [searchInput, setSearchInput] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [selectedCard, setSelectedCard] = useState(null)
  const [focusActivate, setFocusActivate] = useState(false)
  const [gerarOpen, setGerarOpen] = useState(false)
  const [explorerRefreshKey, setExplorerRefreshKey] = useState(0)
  const [annotationCard, setAnnotationCard] = useState(null)

  const codeFromUrl = searchParams.get('code')
  const showActivatedExplorer = filter === 'activated' && !search.trim()
  const showActivatedSearch = filter === 'activated' && Boolean(search.trim())

  useEffect(() => {
    if (searchParams.get('gerar') === '1') {
      setGerarOpen(true)
      setSearchParams({}, { replace: true })
    }
  }, [searchParams, setSearchParams])

  useEffect(() => {
    const term = normalizeEstablishmentSearch(searchInput)
    const timer = window.setTimeout(() => {
      setSearch(term)
      setPage(1)
    }, SEARCH_DEBOUNCE_MS)
    return () => window.clearTimeout(timer)
  }, [searchInput])

  const loadCards = useCallback(async ({ silent = false } = {}) => {
    if (showActivatedExplorer) {
      if (!silent) setLoading(false)
      setCards([])
      setTotal(0)
      return
    }

    if (showActivatedSearch) {
      if (!silent) setLoading(true)
      setError(null)
      const { data, error: fetchError } = await searchActivatedCards(search)
      if (!silent) setLoading(false)
      if (fetchError) {
        setError(fetchError.message)
        return
      }
      setCards(data ?? [])
      setTotal(data?.length ?? 0)
      return
    }

    if (!silent) {
      setLoading(true)
      setError(null)
    }

    const from = (page - 1) * PAGE_SIZE
    const to = from + PAGE_SIZE - 1

    let query = supabase
      .from('cards')
      .select(CARD_FIELDS, { count: 'exact' })
      .order('loja_num', { ascending: true })
      .range(from, to)

    if (filter === 'virgin') {
      query = applyVirginCardsFilter(query)
    } else if (filter === 'activated') {
      query = applyActivatedCardsFilter(query)
    }

    if (search) {
      const term = normalizeEstablishmentSearch(search)
      const notesPrefix = escapeIlikePrefix(term)
      const codePrefix = escapeIlikePrefix(normalizeCode(term))
      query = query.or(`notes.ilike.${notesPrefix}%,code.ilike.${codePrefix}%`)
    }

    const { data, error: fetchError, count } = await query

    if (!silent) setLoading(false)
    if (fetchError) {
      if (!silent) setError(fetchError.message)
      return
    }

    setCards(data ?? [])
    setTotal(count ?? 0)
  }, [page, filter, search, showActivatedExplorer, showActivatedSearch])

  useEffect(() => {
    loadCards()
  }, [loadCards])

  useEffect(() => {
    if (!codeFromUrl) return
    const normalized = normalizeCode(codeFromUrl)
    if (!isLojaCode(normalized)) return

    let cancelled = false
    supabase
      .from('cards')
      .select(CARD_FIELDS)
      .eq('code', normalized)
      .maybeSingle()
      .then(({ data }) => {
        if (cancelled || !data) return
        if (!isCardActivated(data)) {
          setFilter('virgin')
        }
        setSelectedCard(data)
        setFocusActivate(true)
      })

    return () => {
      cancelled = true
    }
  }, [codeFromUrl])

  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE))

  function closeCardModal() {
    setSelectedCard(null)
    setFocusActivate(false)
    setSearchParams({})
    loadCards({ silent: true })
  }

  function openCardModal(card, scrollToActivate = false) {
    setSelectedCard(card)
    setFocusActivate(scrollToActivate)
  }

  function bumpExplorerRefresh() {
    setExplorerRefreshKey((k) => k + 1)
  }

  function handleCardSaved(updated, { reloadList = false } = {}) {
    const prevActivated = selectedCard ? isCardActivated(selectedCard) : false
    const nextActivated = isCardActivated(updated)

    setCards((prev) => {
      if (filter === 'virgin' && nextActivated) {
        return prev.filter((c) => c.id !== updated.id)
      }
      return prev.map((c) => (c.id === updated.id ? { ...c, ...updated } : c))
    })
    if (filter === 'virgin' && nextActivated) {
      setTotal((t) => Math.max(0, t - 1))
    }
    setSelectedCard((prev) => (prev?.id === updated.id ? { ...prev, ...updated } : prev))

    const bairroMoved =
      selectedCard?.location_bairro_id &&
      updated.location_bairro_id &&
      selectedCard.location_bairro_id !== updated.location_bairro_id

    if (prevActivated !== nextActivated || bairroMoved) {
      bumpExplorerRefresh()
    }
    if (reloadList) {
      loadCards({ silent: true })
    }
  }

  async function handleDeactivateCard(card) {
    if (!isCardActivated(card)) return
    const ok = window.confirm(
      `Desativar ${card.code}? QR, NFC, estabelecimento, bairro e anotações serão limpos e o card voltará para Virgens.`,
    )
    if (!ok) return

    const { data, error: updateError } = await supabase
      .from('cards')
      .update({
        destination_url: null,
        activated_at: null,
        notes: null,
        nfc_url: null,
        nfc_uid: null,
        location_bairro_id: null,
        paused: false,
        annotation: null,
      })
      .eq('id', card.id)
      .select(CARD_FIELDS)
      .single()

    if (updateError) {
      setError(updateError.message)
      return
    }

    if (selectedCard?.id === card.id) {
      closeCardModal()
    }
    handleCardSaved(data, { reloadList: true })
  }

  async function handlePauseCard(card) {
    if (!isCardActivated(card)) return
    const nextPaused = !card.paused
    const { data, error: updateError } = await supabase
      .from('cards')
      .update({ paused: nextPaused })
      .eq('id', card.id)
      .select(CARD_FIELDS)
      .single()

    if (updateError) {
      setError(updateError.message)
      return
    }
    handleCardSaved(data)
  }

  function toggleStatusFilter(value) {
    setFilter((prev) => {
      const next = prev === value ? 'all' : value
      if (next === 'virgin' || next === 'all') {
        setSearchInput('')
        setSearch('')
      }
      return next
    })
    setPage(1)
  }

  const showSearchField = filter === 'activated'

  return (
    <div className="admin-page">
      <header className="page-header">
        <h1>Códigos</h1>
        <p className="muted">
          {showActivatedExplorer
            ? 'Estado → Cidade → Distrito → Bairro → QR codes (clique em cada camada)'
            : `${total} registro(s) no filtro atual`}
        </p>
      </header>

      <div className="toolbar toolbar-home">
        <div className="filter-group" role="tablist" aria-label="Filtrar por status">
          {STATUS_FILTERS.map((f) => (
            <button
              key={f.value}
              type="button"
              role="tab"
              aria-selected={filter === f.value}
              className={`btn secondary small ${filter === f.value ? 'active' : ''}`}
              onClick={() => toggleStatusFilter(f.value)}
            >
              {f.label}
            </button>
          ))}
          {showSearchField && (
            <input
              type="search"
              className="toolbar-search"
              placeholder="Buscar código, estabelecimento, cidade, distrito ou bairro…"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              aria-label="Buscar"
            />
          )}
        </div>
        <div className="toolbar-spacer" aria-hidden />
        <button type="button" className="btn secondary small" onClick={() => setGerarOpen(true)}>
          Gerar mais
        </button>
        <Link to="/admin/arte" className="btn secondary small">
          Upload
        </Link>
      </div>

      {loading && !showActivatedExplorer && <p className="muted">Carregando…</p>}
      {error && <p className="form-hint error">{error}</p>}

      {showActivatedExplorer && !error && (
        <ActivatedLocationsExplorer
          refreshKey={explorerRefreshKey}
          onSelectCard={(card) => openCardModal(card, false)}
          onActivateCard={(card) => openCardModal(card, true)}
          onDeactivateCard={handleDeactivateCard}
          onPauseCard={handlePauseCard}
          onAnnotationCard={setAnnotationCard}
        />
      )}

      {!showActivatedExplorer && !loading && !error && (
        <>
          <CardsTable
            cards={cards}
            showLocationColumn={showActivatedSearch}
            onSelectCard={(card) => openCardModal(card, false)}
            onActivateCard={(card) => openCardModal(card, true)}
            onDeactivateCard={handleDeactivateCard}
            onPauseCard={handlePauseCard}
            onAnnotationCard={setAnnotationCard}
          />
          {!showActivatedSearch && (
            <Pagination
              page={page}
              pageCount={pageCount}
              disabled={loading}
              onPageChange={setPage}
            />
          )}
        </>
      )}

      <CardDetailModal
        card={selectedCard}
        focusActivate={focusActivate}
        onClose={closeCardModal}
        onSaved={handleCardSaved}
      />

      <CardAnnotationModal
        card={annotationCard}
        open={Boolean(annotationCard)}
        onClose={() => setAnnotationCard(null)}
        onSaved={handleCardSaved}
      />

      <BatchGenerateModal open={gerarOpen} onClose={() => setGerarOpen(false)} />
    </div>
  )
}
