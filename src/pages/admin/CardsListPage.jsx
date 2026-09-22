import { useCallback, useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import CardDetailModal from '../../components/admin/CardDetailModal.jsx'
import CardsTable from '../../components/admin/CardsTable.jsx'
import Pagination from '../../components/ui/Pagination.jsx'
import { PAGE_SIZE } from '../../lib/config.js'
import { supabase } from '../../lib/supabase.js'
import { normalizeCode } from '../../utils/codes.js'
import { escapeIlikePrefix, normalizeEstablishmentSearch } from '../../utils/search.js'

const FILTERS = [
  { value: 'all', label: 'Todos' },
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

  const codeFromUrl = searchParams.get('code')

  useEffect(() => {
    const term = normalizeEstablishmentSearch(searchInput)
    const timer = window.setTimeout(() => {
      setSearch(term)
      setPage(1)
    }, SEARCH_DEBOUNCE_MS)
    return () => window.clearTimeout(timer)
  }, [searchInput])

  const loadCards = useCallback(async () => {
    setLoading(true)
    setError(null)

    const from = (page - 1) * PAGE_SIZE
    const to = from + PAGE_SIZE - 1

    let query = supabase
      .from('cards')
      .select('id, code, destination_url, activated_at, created_at, batch_label, notes', {
        count: 'exact',
      })
      .order('created_at', { ascending: false })
      .range(from, to)

    if (filter === 'virgin') {
      query = query.is('destination_url', null)
    } else if (filter === 'activated') {
      query = query.not('destination_url', 'is', null)
    }

    if (search) {
      const prefix = escapeIlikePrefix(search)
      query = query.not('notes', 'is', null).ilike('notes', `${prefix}%`)
    }

    const { data, error: fetchError, count } = await query

    setLoading(false)
    if (fetchError) {
      setError(fetchError.message)
      return
    }

    setCards(data ?? [])
    setTotal(count ?? 0)
  }, [page, filter, search])

  useEffect(() => {
    loadCards()
  }, [loadCards])

  useEffect(() => {
    if (!codeFromUrl) return
    const normalized = normalizeCode(codeFromUrl)
    if (normalized.length !== 6) return

    let cancelled = false
    supabase
      .from('cards')
      .select('id, code, destination_url, activated_at, created_at, batch_label, notes')
      .eq('code', normalized)
      .maybeSingle()
      .then(({ data }) => {
        if (cancelled || !data) return
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
  }

  function openCardModal(card, scrollToActivate = false) {
    setSelectedCard(card)
    setFocusActivate(scrollToActivate)
  }

  function handleCardSaved(updated) {
    setCards((prev) => prev.map((c) => (c.id === updated.id ? { ...c, ...updated } : c)))
    setSelectedCard((prev) => (prev?.id === updated.id ? { ...prev, ...updated } : prev))
    loadCards()
  }

  return (
    <div className="admin-page">
      <header className="page-header">
        <h1>Códigos</h1>
        <p className="muted">{total} registro(s) no filtro atual</p>
      </header>

      <div className="toolbar">
        <div className="filter-group" role="tablist" aria-label="Filtrar por status">
          {FILTERS.map((f) => (
            <button
              key={f.value}
              type="button"
              role="tab"
              aria-selected={filter === f.value}
              className={`btn secondary small ${filter === f.value ? 'active' : ''}`}
              onClick={() => {
                setFilter(f.value)
                setPage(1)
              }}
            >
              {f.label}
            </button>
          ))}
        </div>

        <div className="search-form">
          <input
            type="search"
            placeholder="Buscar estabelecimento…"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            aria-label="Buscar estabelecimento"
          />
        </div>
      </div>

      {loading && <p className="muted">Carregando…</p>}
      {error && <p className="form-hint error">{error}</p>}
      {!loading && !error && (
        <>
          <CardsTable
            cards={cards}
            onSelectCard={(card) => openCardModal(card, false)}
            onActivateCard={(card) => openCardModal(card, true)}
          />
          <Pagination
            page={page}
            pageCount={pageCount}
            disabled={loading}
            onPageChange={setPage}
          />
        </>
      )}

      <CardDetailModal
        card={selectedCard}
        focusActivate={focusActivate}
        onClose={closeCardModal}
        onSaved={handleCardSaved}
      />
    </div>
  )
}
