import { useCallback, useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import BatchGenerateModal from '../../components/admin/BatchGenerateModal.jsx'
import CardDetailModal from '../../components/admin/CardDetailModal.jsx'
import CardsTable from '../../components/admin/CardsTable.jsx'
import Pagination from '../../components/ui/Pagination.jsx'
import { PAGE_SIZE } from '../../lib/config.js'
import { supabase } from '../../lib/supabase.js'
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

  const codeFromUrl = searchParams.get('code')

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

  const loadCards = useCallback(async () => {
    setLoading(true)
    setError(null)

    const from = (page - 1) * PAGE_SIZE
    const to = from + PAGE_SIZE - 1

    let query = supabase
      .from('cards')
      .select(
        'id, code, destination_url, activated_at, created_at, batch_label, notes, nfc_url, nfc_uid',
        {
          count: 'exact',
        },
      )
      .order('loja_num', { ascending: true })
      .range(from, to)

    if (filter === 'virgin') {
      query = query.is('destination_url', null)
    } else if (filter === 'activated') {
      query = query.not('destination_url', 'is', null)
    }

    if (search) {
      const term = normalizeEstablishmentSearch(search)
      const notesPrefix = escapeIlikePrefix(term)
      const codePrefix = escapeIlikePrefix(normalizeCode(term))
      query = query.or(`notes.ilike.${notesPrefix}%,code.ilike.${codePrefix}%`)
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
    if (!isLojaCode(normalized)) return

    let cancelled = false
    supabase
      .from('cards')
      .select(
        'id, code, destination_url, activated_at, created_at, batch_label, notes, nfc_url, nfc_uid',
      )
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

  async function handleDeactivateCard(card) {
    if (!card?.destination_url) return
    const ok = window.confirm(
      `Desativar ${card.code}? QR, NFC e estabelecimento serão limpos e o card voltará para Virgens.`,
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
      })
      .eq('id', card.id)
      .select()
      .single()

    if (updateError) {
      setError(updateError.message)
      return
    }

    if (selectedCard?.id === card.id) {
      closeCardModal()
    }
    handleCardSaved(data)
  }

  function toggleStatusFilter(value) {
    setFilter((prev) => (prev === value ? 'all' : value))
    setPage(1)
  }

  return (
    <div className="admin-page">
      <header className="page-header">
        <h1>Códigos</h1>
        <p className="muted">{total} registro(s) no filtro atual</p>
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
          <input
            type="search"
            className="toolbar-search"
            placeholder="Buscar código ou estabelecimento…"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            aria-label="Buscar código ou estabelecimento"
          />
        </div>
        <div className="toolbar-spacer" aria-hidden />
        <button type="button" className="btn secondary small" onClick={() => setGerarOpen(true)}>
          Gerar mais
        </button>
        <Link to="/admin/arte" className="btn secondary small">
          Upload
        </Link>
      </div>

      {loading && <p className="muted">Carregando…</p>}
      {error && <p className="form-hint error">{error}</p>}
      {!loading && !error && (
        <>
          <CardsTable
            cards={cards}
            onSelectCard={(card) => openCardModal(card, false)}
            onActivateCard={(card) => openCardModal(card, true)}
            onDeactivateCard={handleDeactivateCard}
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

      <BatchGenerateModal open={gerarOpen} onClose={() => setGerarOpen(false)} />
    </div>
  )
}
