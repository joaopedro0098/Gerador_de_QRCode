import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import ActivatedLocationsExplorer from '../../components/admin/ActivatedLocationsExplorer.jsx'
import CardsListStatusToolbar from '../../components/admin/CardsListStatusToolbar.jsx'
import BatchGenerateModal from '../../components/admin/BatchGenerateModal.jsx'
import CardAnnotationModal from '../../components/admin/CardAnnotationModal.jsx'
import CardDetailModal from '../../components/admin/CardDetailModal.jsx'
import DeactivateCardConfirmModal from '../../components/admin/DeactivateCardConfirmModal.jsx'
import VirginSelectionActionsModal from '../../components/admin/VirginSelectionActionsModal.jsx'
import PaginatedCardsListPanel from '../../components/admin/PaginatedCardsListPanel.jsx'
import { CARD_FIELDS, CARD_VIRGIN_LIST_FIELDS } from '../../utils/cardActivation.js'
import {
  applyActivatedCardsFilter,
  applyStockCardsFilter,
  applyVirginCardsFilter,
  isCardActivated,
  isCardInStock,
} from '../../utils/cardStatus.js'
import { sendAllVirginCardsToStock, sendVirginCardsToStock } from '../../utils/cardStock.js'
import { PAGE_SIZE } from '../../lib/config.js'
import {
  downloadQrOnlyPdfZip,
  resolveQrSizeCmForDownload,
} from '../../utils/downloadVirginQrOnly.js'
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
  const [initialLoading, setInitialLoading] = useState(true)
  const [pageBusy, setPageBusy] = useState(false)
  const [error, setError] = useState(null)
  const [selectedCard, setSelectedCard] = useState(null)
  const [focusActivate, setFocusActivate] = useState(false)
  const [gerarOpen, setGerarOpen] = useState(false)
  const [explorerRefreshKey, setExplorerRefreshKey] = useState(0)
  const [annotationCard, setAnnotationCard] = useState(null)
  const [deactivateTarget, setDeactivateTarget] = useState(null)
  const [deactivateBusy, setDeactivateBusy] = useState(false)
  const [stockPickMode, setStockPickMode] = useState(false)
  const [stockPickIds, setStockPickIds] = useState(() => new Set())
  const [stockSendBusy, setStockSendBusy] = useState(false)
  const [stockSendConfirm, setStockSendConfirm] = useState(null)
  const [qrDownloadBusy, setQrDownloadBusy] = useState(false)
  const [qrDownloadProgress, setQrDownloadProgress] = useState('')
  const activatedExplorerRef = useRef(null)
  const listFetchGenRef = useRef(0)
  const prevListQueryRef = useRef({
    page: 0,
    filter: '',
    search: '',
    showActivatedSearch: false,
    showActivatedExplorer: false,
  })

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
      if (!silent) {
        setInitialLoading(false)
        setPageBusy(false)
      }
      setCards([])
      setTotal(0)
      return
    }

    const prev = prevListQueryRef.current
    const pageOnly =
      filter === prev.filter &&
      search === prev.search &&
      showActivatedSearch === prev.showActivatedSearch &&
      showActivatedExplorer === prev.showActivatedExplorer &&
      page !== prev.page

    prevListQueryRef.current = {
      page,
      filter,
      search,
      showActivatedSearch,
      showActivatedExplorer,
    }

    const fetchGen = ++listFetchGenRef.current

    if (showActivatedSearch) {
      if (!silent) {
        setError(null)
        if (pageOnly) {
          setPageBusy(true)
        } else {
          setInitialLoading(true)
          setPageBusy(false)
        }
      }
      const { data, error: fetchError } = await searchActivatedCards(search)
      if (fetchGen !== listFetchGenRef.current) return
      if (!silent) {
        setInitialLoading(false)
        setPageBusy(false)
      }
      if (fetchError) {
        setError(fetchError.message)
        return
      }
      setCards(data ?? [])
      setTotal(data?.length ?? 0)
      return
    }

    if (!silent) {
      setError(null)
      if (pageOnly) {
        setPageBusy(true)
      } else {
        setInitialLoading(true)
        setPageBusy(false)
      }
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
    } else if (filter === 'stock') {
      query = applyStockCardsFilter(query)
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

    if (fetchGen !== listFetchGenRef.current) return

    if (!silent) {
      setInitialLoading(false)
      setPageBusy(false)
    }
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
        if (isCardActivated(data)) {
          setFilter('activated')
        } else if (isCardInStock(data)) {
          setFilter('stock')
        } else {
          setFilter('virgin')
        }
        setSelectedCard(data)
        setFocusActivate(isCardInStock(data) && !isCardActivated(data))
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

  const openCardModal = useCallback((card, scrollToActivate = false) => {
    setSelectedCard(card)
    setFocusActivate(scrollToActivate)
  }, [])

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
    if (filter === 'stock' && nextActivated && !prevActivated) {
      bumpExplorerRefresh()
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

  function buildListSearchOr(term) {
    if (!term) return null
    const notesPrefix = escapeIlikePrefix(term)
    const codePrefix = escapeIlikePrefix(normalizeCode(term))
    return `notes.ilike.${notesPrefix}%,code.ilike.${codePrefix}%`
  }

  function toggleStockPick(id) {
    setStockPickIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function exitStockPickMode() {
    setStockPickMode(false)
    setStockPickIds(new Set())
    if (!stockSendBusy) {
      setStockSendConfirm(null)
    }
  }

  async function fetchVirginCardsForSelectionConfirm(confirm) {
    if (confirm.mode === 'selected') {
      const ids = [...stockPickIds]
      if (!ids.length) return []
      const { data, error: fetchError } = await supabase
        .from('cards')
        .select('id, code')
        .in('id', ids)
        .is('activated_at', null)
        .is('stock_at', null)
        .order('loja_num', { ascending: true })

      if (fetchError) throw new Error(fetchError.message)
      return data ?? []
    }

    let query = supabase
      .from('cards')
      .select('id, code')
      .is('activated_at', null)
      .is('stock_at', null)
      .order('loja_num', { ascending: true })

    if (search) {
      const term = normalizeEstablishmentSearch(search)
      const notesPrefix = escapeIlikePrefix(term)
      const codePrefix = escapeIlikePrefix(normalizeCode(term))
      query = query.or(`notes.ilike.${notesPrefix}%,code.ilike.${codePrefix}%`)
    }

    const pageSize = 500
    const all = []
    let from = 0

    while (true) {
      const { data, error: fetchError } = await query.range(from, from + pageSize - 1)
      if (fetchError) throw new Error(fetchError.message)
      if (!data?.length) break
      all.push(...data)
      if (data.length < pageSize) break
      from += pageSize
    }

    return all
  }

  function openVirginSelectionModalSelected() {
    if (!stockPickIds.size) return
    setStockSendConfirm({ mode: 'selected', count: stockPickIds.size })
  }

  function openVirginSelectionModalAll() {
    if (total < 1) return
    setStockPickIds(new Set(cards.map((c) => c.id)))
    setStockSendConfirm({ mode: 'all', count: total })
  }

  function cancelVirginSelectionModal() {
    if (stockSendBusy || qrDownloadBusy) return
    setStockSendConfirm(null)
    setQrDownloadProgress('')
  }

  async function handleVirginSelectionDownloadQr() {
    if (!stockSendConfirm) return
    setError(null)
    setQrDownloadBusy(true)
    setQrDownloadProgress('Preparando download…')

    try {
      const list = await fetchVirginCardsForSelectionConfirm(stockSendConfirm)
      if (!list.length) {
        throw new Error('Nenhum ID virgem para baixar.')
      }
      const qrSizeCm = await resolveQrSizeCmForDownload()
      await downloadQrOnlyPdfZip(list, qrSizeCm, { onProgress: setQrDownloadProgress })
    } catch (err) {
      setError(err.message ?? 'Erro ao baixar QR codes.')
    } finally {
      setQrDownloadBusy(false)
      setQrDownloadProgress('')
    }
  }

  async function executeStockSendConfirm() {
    if (!stockSendConfirm || stockSendConfirm.count < 1) return

    setStockSendBusy(true)
    setError(null)

    if (stockSendConfirm.mode === 'selected') {
      const ids = [...stockPickIds]
      const { data, error: sendError } = await sendVirginCardsToStock(supabase, ids)
      setStockSendBusy(false)
      if (sendError) {
        setError(sendError.message)
        return
      }
      const sent = new Set((data ?? []).map((c) => c.id))
      setCards((prev) => prev.filter((c) => !sent.has(c.id)))
      setTotal((t) => Math.max(0, t - sent.size))
      setStockSendConfirm(null)
      exitStockPickMode()
      return
    }

    const searchOr = buildListSearchOr(normalizeEstablishmentSearch(search))
    const { data, error: sendError } = await sendAllVirginCardsToStock(supabase, { searchOr })
    setStockSendBusy(false)
    if (sendError) {
      setError(sendError.message)
      return
    }
    if ((data?.length ?? 0) > 0) {
      loadCards({ silent: true })
    }
    setStockSendConfirm(null)
    exitStockPickMode()
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
    const now = new Date().toISOString()
    const { data, error: updateError } = await supabase
      .from('cards')
      .update({
        activated_at: null,
        paused: false,
        stock_at: card.stock_at ?? now,
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

  const showListCountText =
    (filter === 'virgin' || filter === 'stock') &&
    !showActivatedExplorer &&
    !(initialLoading && cards.length === 0)
      ? `${total} registro(s) no filtro atual`
      : null

  const handleSelectCard = useCallback(
    (card) => {
      if (filter === 'virgin' && stockPickMode) {
        toggleStockPick(card.id)
        return
      }
      openCardModal(card, filter === 'stock' && !isCardActivated(card))
    },
    [filter, stockPickMode, openCardModal],
  )

  const paginatedTableProps = useMemo(
    () => ({
      virginLayout: filter === 'virgin',
      stockLayout: filter === 'stock',
      activatedMinimalLayout: showActivatedSearch,
      stockPickMode: filter === 'virgin' && stockPickMode,
      stockPickSelectedIds: stockPickIds,
      onToggleStockPick: toggleStockPick,
      showLocationColumn: showActivatedSearch,
      hideRowActions: filter === 'virgin' || showActivatedSearch || filter === 'stock',
      onSelectCard: handleSelectCard,
      onActivateCard: (card) => openCardModal(card, true),
      onDeactivateCard: requestDeactivateCard,
      onPauseCard: handlePauseCard,
      onAnnotationCard: setAnnotationCard,
    }),
    [
      filter,
      showActivatedSearch,
      stockPickMode,
      stockPickIds,
      handleSelectCard,
      openCardModal,
      handlePauseCard,
    ],
  )

  const handlePageChange = useCallback((nextPage) => {
    setPage(nextPage)
  }, [])

  const handleFilterChange = useCallback((value) => {
    setFilter((prev) => {
      if (prev !== value && (value === 'virgin' || value === 'stock')) {
        setSearchInput('')
        setSearch('')
      }
      return value
    })
    setStockPickMode(false)
    setStockPickIds(new Set())
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
        {showActivatedExplorer && !error && (
          <ActivatedLocationsExplorer
            ref={activatedExplorerRef}
            refreshKey={explorerRefreshKey}
            onOpenCard={(card) => openCardModal(card, false)}
          />
        )}

        {!showActivatedExplorer && (
          <PaginatedCardsListPanel
            cards={cards}
            initialLoading={initialLoading}
            pageBusy={pageBusy}
            error={error}
            showPagination={!showActivatedSearch}
            page={page}
            pageCount={pageCount}
            onPageChange={handlePageChange}
            listCount={showListCountText}
            virginToolbar={
              filter === 'virgin' ? (
                <div className="virgin-stock-toolbar">
                  {!stockPickMode ? (
                    <button
                      type="button"
                      className="btn-ghost-link"
                      disabled={stockSendBusy || (initialLoading && cards.length === 0)}
                      onClick={() => setStockPickMode(true)}
                    >
                      Selecionar
                    </button>
                  ) : (
                    <div className="virgin-stock-toolbar-active">
                      <button
                        type="button"
                        className="btn-ghost-link"
                        disabled={stockSendBusy || qrDownloadBusy || !stockPickIds.size}
                        onClick={openVirginSelectionModalSelected}
                      >
                        Selecionados
                      </button>
                      <button
                        type="button"
                        className="btn-ghost-link"
                        disabled={stockSendBusy || qrDownloadBusy || total < 1}
                        onClick={openVirginSelectionModalAll}
                      >
                        Selecionar todos
                      </button>
                      <button
                        type="button"
                        className="btn-ghost-link"
                        disabled={stockSendBusy}
                        onClick={exitStockPickMode}
                      >
                        Cancelar
                      </button>
                    </div>
                  )}
                </div>
              ) : null
            }
            tableProps={paginatedTableProps}
          />
        )}
      </div>

      <CardDetailModal
        card={selectedCard}
        focusActivate={focusActivate}
        onClose={closeCardModal}
        onSaved={handleCardSaved}
        readOnlyActivated={filter === 'activated' || filter === 'virgin'}
        stockUi={filter === 'stock'}
        onPauseCard={filter === 'stock' ? handlePauseCard : undefined}
        onDeactivateCard={filter === 'stock' ? requestDeactivateCard : undefined}
      />

      <CardAnnotationModal
        card={annotationCard}
        open={Boolean(annotationCard)}
        onClose={() => setAnnotationCard(null)}
        onSaved={handleCardSaved}
      />

      <BatchGenerateModal
        open={gerarOpen}
        onClose={() => setGerarOpen(false)}
        onGenerated={() => loadCards({ silent: true })}
      />

      <DeactivateCardConfirmModal
        open={Boolean(deactivateTarget)}
        code={deactivateTarget?.code}
        busy={deactivateBusy}
        onCancel={() => !deactivateBusy && setDeactivateTarget(null)}
        onConfirm={confirmDeactivateCard}
      />

      <VirginSelectionActionsModal
        open={Boolean(stockSendConfirm)}
        count={stockSendConfirm?.count ?? 0}
        busy={stockSendBusy}
        downloadBusy={qrDownloadBusy}
        downloadProgress={qrDownloadProgress}
        onCancel={cancelVirginSelectionModal}
        onConfirmStock={() => void executeStockSendConfirm()}
        onDownloadQr={() => void handleVirginSelectionDownloadQr()}
      />
    </div>
  )
}
