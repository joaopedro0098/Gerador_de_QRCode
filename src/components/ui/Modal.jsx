import { useEffect } from 'react'

function handleBackdropPointerDown(e, onClose) {
  if (e.target === e.currentTarget) {
    onClose()
  }
}

export default function Modal({
  open,
  title,
  headerMeta,
  onClose,
  children,
  wide = false,
  cardLayout = false,
}) {
  useEffect(() => {
    if (!open) return
    const onKey = (e) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null

  return (
    <div
      className="modal-backdrop"
      onMouseDown={(e) => handleBackdropPointerDown(e, onClose)}
      role="presentation"
    >
      <div
        className={`modal-panel${wide ? ' modal-panel-wide' : ''}${cardLayout ? ' modal-panel-card' : ''}`}
        onMouseDown={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
      >
        <header className="modal-header">
          <div className="modal-title-block">
            <h2 id="modal-title">{title}</h2>
            {headerMeta ? <p className="modal-header-meta">{headerMeta}</p> : null}
          </div>
          <button type="button" className="btn-icon" onClick={onClose} aria-label="Fechar">
            ×
          </button>
        </header>
        <div className={`modal-body${cardLayout ? ' modal-body-card' : ''}`}>{children}</div>
      </div>
    </div>
  )
}
