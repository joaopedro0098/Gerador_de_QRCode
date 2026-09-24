/** Paginação estilo Google: janelas de 10 (1–10, 11–20, …). `current` e `total` são 1-based. */
export default function NumberWindowPagination({ current, total, onChange, disabled }) {
  if (total <= 0) return null

  const safeCurrent = Math.min(Math.max(1, current), total)
  const windowStart = Math.floor((safeCurrent - 1) / 10) * 10 + 1
  const windowEnd = Math.min(windowStart + 9, total)
  const showPrev = windowStart > 1
  const showNext = windowEnd < total

  return (
    <nav className="number-window-pagination" aria-label="Selecionar card virgem">
      {showPrev && (
        <button
          type="button"
          className="number-window-pagination-arrow"
          disabled={disabled}
          onClick={() => onChange(windowStart - 1)}
          aria-label="Página anterior"
        >
          &lt;
        </button>
      )}
      {Array.from({ length: windowEnd - windowStart + 1 }, (_, i) => {
        const n = windowStart + i
        return (
          <button
            key={n}
            type="button"
            className={`number-window-pagination-page ${n === safeCurrent ? 'active' : ''}`}
            disabled={disabled}
            aria-current={n === safeCurrent ? 'page' : undefined}
            onClick={() => onChange(n)}
          >
            {n}
          </button>
        )
      })}
      {showNext && (
        <button
          type="button"
          className="number-window-pagination-arrow"
          disabled={disabled}
          onClick={() => onChange(windowEnd + 1)}
          aria-label="Próxima página"
        >
          &gt;
        </button>
      )}
    </nav>
  )
}
