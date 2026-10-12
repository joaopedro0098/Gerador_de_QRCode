export default function Pagination({ page, pageCount, onPageChange, disabled, busy = false }) {
  const inactive = pageCount <= 1

  return (
    <nav
      className={`pagination${inactive ? ' pagination--inactive' : ''}`}
      aria-label="Paginação"
      aria-hidden={inactive ? 'true' : undefined}
    >
      <button
        type="button"
        className="btn secondary"
        disabled={inactive || disabled || busy || page <= 1}
        onClick={() => onPageChange(page - 1)}
        tabIndex={inactive ? -1 : 0}
      >
        Anterior
      </button>
      <span className="pagination-info">
        {inactive ? '\u00a0' : `Página ${page} de ${pageCount}`}
        {busy && !inactive ? ' · …' : ''}
      </span>
      <button
        type="button"
        className="btn secondary"
        disabled={inactive || disabled || busy || page >= pageCount}
        onClick={() => onPageChange(page + 1)}
        tabIndex={inactive ? -1 : 0}
      >
        Próxima
      </button>
    </nav>
  )
}
