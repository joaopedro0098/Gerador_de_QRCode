import { useCallback, useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import ActivatedLocationsExplorer from '../../components/admin/ActivatedLocationsExplorer.jsx'
import CardsListStatusToolbar from '../../components/admin/CardsListStatusToolbar.jsx'
import BatchGenerateModal from '../../components/admin/BatchGenerateModal.jsx'
import CardAnnotationModal from '../../components/admin/CardAnnotationModal.jsx'
import CardDetailModal from '../../components/admin/CardDetailModal.jsx'
import DeactivateCardConfirmModal from '../../components/admin/DeactivateCardConfirmModal.jsx'
import CardsTable from '../../components/admin/CardsTable.jsx'
import Pagination from '../../components/ui/Pagination.jsx'
import { CARD_FIELDS, CARD_VIRGIN_LIST_FIELDS } from '../../utils/cardActivation.js'
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

const SEARCH_DEBOUNCE_MS = 280

export default function CardsListPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const [cards, setCards] = useState([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [filter, setFilter] = useState('virgin')
  const [search, setSearch] = useState('')
  const [searchInput, setSearchInput] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [selectedCard, setSelectedCard] = useState(null)
  const [focusActivate, setFocusActivate] = useState(false)
  const [gerarOpen, setGerarOpen] = useState(false)
  const [explorerRefreshKey, setExplorerRefreshKey] = useState(0)
  const [annotationCard, setAnnotationCard] = useState(null)
  const [deactivateTarget, setDeactivateTarget] = useState(null)
  const [deactivateBusy, setDeactivateBusy] = useState(false)
  const activatedExplorerRef = useRef(null)

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

    const listFields = filter === 'virgin' ? CARD_VIRGIN_LIST_FIELDS : CARD_FIELDS

    let query = supabase
      .from('cards')
      .select(listFields, { count: 'exact' })
      .order('loja_num', { ascending: true })
      .range(from, to)

    if (filter === 'activated') {
      query = applyActivatedCardsFilter(query)
    } else {
      query = applyVirginCardsFilter(query)
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

  function handleCardSaved(updated, { reloadList = false, navigateToActivated = false } = {}) {
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

    const activatedMetadataChanged =
      prevActivated &&
      nextActivated &&
      selectedCard &&
      (selectedCard.notes !== updated.notes ||
        selectedCard.destination_url !== updated.destination_url)

    if (prevActivated !== nextActivated || bairroMoved || activatedMetadataChanged) {
      bumpExplorerRefresh()
    }
    if (reloadList) {
      loadCards({ silent: true })
    }

    if (navigateToActivated && nextActivated) {
      setFilter('activated')
      setSelectedCard(null)
      setFocusActivate(false)
      setSearchInput('')
      setSearch('')
    }
  }

  function requestDeactivateCard(card) {
    if (!isCardActivated(card)) return
    setDeactivateTarget(card)
  }

  async function confirmDeactivateCard() {
    const card = deactivateTarget
    if (!card || !isCardActivated(card)) {
      setDeactivateTarget(null)
      return
    }

    setDeactivateBusy(true)
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
    setDeactivateBusy(false)

    if (updateError) {
      setError(updateError.message)
      return
    }

    setDeactivateTarget(null)
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

  const showVirginCount = filter === 'virgin' && !loading

  const handleFilterChange = useCallback((value) => {
    setFilter((prev) => {
      if (prev !== value && value === 'virgin') {
        setSearchInput('')
        setSearch('')
      }
      return value
    })
    setPage(1)
  }, [])

  const handleSearchInputChange = useCallback((value) => {
    setSearchInput(value)
  }, [])

  const handleAdicionarClick = useCallback(() => {
    activatedExplorerRef.current?.openCreate()
  }, [])

  const handleGerarClick = useCallback(() => {
    setGerarOpen(true)
  }, [])

  return (
    <div className="admin-page admin-page-codes">
      <CardsListStatusToolbar
        filter={filter}
        searchInput={searchInput}
        onSearchInputChange={handleSearchInputChange}
        onFilterChange={handleFilterChange}
        onAdicionarClick={handleAdicionarClick}
        onGerarClick={handleGerarClick}
        showActivatedExplorer={showActivatedExplorer}
      />

      <div className="cards-list-panel" aria-live="polite">
        {showVirginCount && (
          <p className="muted virgin-cards-count">{total} registro(s) no filtro atual</p>
        )}

        {loading && !showActivatedExplorer && <p className="muted cards-list-loading">Carregando…</p>}
        {error && <p className="form-hint error">{error}</p>}

        {showActivatedExplorer && !error && (
          <ActivatedLocationsExplorer
            ref={activatedExplorerRef}
            refreshKey={explorerRefreshKey}
            onOpenCard={(card) => openCardModal(card, true)}
            onAnnotationCard={setAnnotationCard}
          />
        )}

        {!showActivatedExplorer && !loading && !error && (
          <>
          <CardsTable
            cards={cards}
            virginLayout={filter === 'virgin'}
            showLocationColumn={showActivatedSearch}
            embedAnnotationIcon={showActivatedSearch}
            hideRowActions={showActivatedSearch || filter === 'virgin'}
            onSelectCard={(card) =>
              openCardModal(card, filter === 'virgin' || showActivatedSearch ? true : false)
            }
            onActivateCard={(card) => openCardModal(card, true)}
            onDeactivateCard={requestDeactivateCard}
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
      </div>

      <CardDetailModal
        card={selectedCard}
        focusActivate={focusActivate}
        onClose={closeCardModal}
        onSaved={handleCardSaved}
        onPauseCard={filter === 'activated' ? handlePauseCard : undefined}
        onDeactivateCard={filter === 'activated' ? requestDeactivateCard : undefined}
      />

      <CardAnnotationModal
        card={annotationCard}
        open={Boolean(annotationCard)}
        onClose={() => setAnnotationCard(null)}
        onSaved={handleCardSaved}
      />

      <BatchGenerateModal open={gerarOpen} onClose={() => setGerarOpen(false)} />

      <DeactivateCardConfirmModal
        open={Boolean(deactivateTarget)}
        code={deactivateTarget?.code}
        busy={deactivateBusy}
        onCancel={() => !deactivateBusy && setDeactivateTarget(null)}
        onConfirm={confirmDeactivateCard}
      />
    </div>
  )
}
