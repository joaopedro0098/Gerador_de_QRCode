import { memo } from 'react'
import CardsTable from './CardsTable.jsx'
import Pagination from '../ui/Pagination.jsx'

function PaginatedCardsListPanel({
  cards,
  initialLoading,
  pageBusy,
  error,
  showPagination,
  page,
  pageCount,
  onPageChange,
  virginToolbar = null,
  listCount = null,
  tableProps,
}) {
  const showEmptyLoading = initialLoading && cards.length === 0
  const listBusy = initialLoading || pageBusy
  const bodyClass = [
    'cards-list-body',
    pageBusy ? 'is-page-busy' : '',
    initialLoading && cards.length > 0 ? 'is-context-busy' : '',
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <>
      {virginToolbar}
      {listCount != null && (
        <p className="muted virgin-cards-count">{listCount}</p>
      )}

      {error && <p className="form-hint error">{error}</p>}

      {showEmptyLoading ? (
        <p className="muted cards-list-loading">Carregando…</p>
      ) : (
        <div className={bodyClass} aria-busy={listBusy ? 'true' : 'false'}>
          <CardsTable cards={cards} {...tableProps} />
          {pageBusy && (
            <p className="cards-list-page-hint muted" aria-live="polite">
              Atualizando página…
            </p>
          )}
          <div className="cards-list-pagination-slot">
            {showPagination && (
              <Pagination
                page={page}
                pageCount={pageCount}
                busy={pageBusy}
                onPageChange={onPageChange}
              />
            )}
          </div>
        </div>
      )}
    </>
  )
}

export default memo(PaginatedCardsListPanel)
