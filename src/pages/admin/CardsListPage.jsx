import { useCallback, useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import CardQrModal from '../../components/admin/CardQrModal.jsx'
import CardsTable from '../../components/admin/CardsTable.jsx'
import Pagination from '../../components/ui/Pagination.jsx'
import { PAGE_SIZE } from '../../lib/config.js'
import { supabase } from '../../lib/supabase.js'
import { normalizeCode } from '../../utils/codes.js'

const FILTERS = [
  { value: 'all', label: 'Todos' },
  { value: 'virgin', label: 'Virgens' },
  { value: 'activated', label: 'Ativados' },
]

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

  const codeFromUrl = searchParams.get('code')

  useEffect(() => {
    if (!codeFromUrl) return
    const normalized = normalizeCode(codeFromUrl)
    setSearchInput(normalized)
    setSearch(normalized)
    setPage(1)
  }, [codeFromUrl])

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
      query = query.ilike('code', `%${search}%`)
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
    if (!codeFromUrl || !cards.length) return
    const match = cards.find((c) => c.code === normalizeCode(codeFromUrl))
    if (match) setSelectedCard(match)
  }, [codeFromUrl, cards])

  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE))

  function applySearch(e) {
    e.preventDefault()
    setPage(1)
    setSearch(normalizeCode(searchInput))
    if (searchInput.trim()) {
      setSearchParams({ code: normalizeCode(searchInput) })
    } else {
      setSearchParams({})
    }
  }

  return (
    <div className="admin-page">
      <header className="page-header">
        <div>
          <h1>Códigos</h1>
          <p className="muted">{total} registro(s) no filtro atual</p>
        </div>
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

        <form className="search-form" onSubmit={applySearch}>
          <input
            type="search"
            placeholder="Buscar código…"
            value={searchInput}
            onChange={(e) => setSearchInput(normalizeCode(e.target.value))}
            maxLength={6}
          />
          <button type="submit" className="btn secondary small">
            Buscar
          </button>
        </form>
      </div>

      {loading && <p className="muted">Carregando…</p>}
      {error && <p className="form-hint error">{error}</p>}
      {!loading && !error && (
        <>
          <CardsTable cards={cards} onSelectCard={setSelectedCard} />
          <Pagination
            page={page}
            pageCount={pageCount}
            disabled={loading}
            onPageChange={setPage}
          />
        </>
      )}

      <CardQrModal card={selectedCard} onClose={() => setSelectedCard(null)} />
    </div>
  )
}
