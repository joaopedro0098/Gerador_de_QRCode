export default function Pagination({ page, pageCount, onPageChange, disabled }) {
  if (pageCount <= 1) return null

  return (
    <nav className="pagination" aria-label="Paginação">
      <button
        type="button"
        className="btn secondary"
        disabled={disabled || page <= 1}
        onClick={() => onPageChange(page - 1)}
      >
        Anterior
      </button>
      <span className="pagination-info">
        Página {page} de {pageCount}
      </span>
      <button
        type="button"
        className="btn secondary"
        disabled={disabled || page >= pageCount}
        onClick={() => onPageChange(page + 1)}
      >
        Próxima
      </button>
    </nav>
  )
}
