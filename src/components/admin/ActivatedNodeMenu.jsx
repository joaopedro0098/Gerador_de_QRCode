import { useEffect, useId, useRef, useState } from 'react'

export default function ActivatedNodeMenu({
  label = 'Opções',
  canDelete = false,
  onEdit,
  onDelete,
}) {
  const [open, setOpen] = useState(false)
  const wrapRef = useRef(null)
  const menuId = useId()

  useEffect(() => {
    if (!open) return

    function onKey(e) {
      if (e.key === 'Escape') setOpen(false)
    }

    function onDocPointer(e) {
      if (wrapRef.current?.contains(e.target)) return
      setOpen(false)
    }

    window.addEventListener('keydown', onKey)
    const attachTimer = window.setTimeout(() => {
      document.addEventListener('pointerdown', onDocPointer)
    }, 0)

    return () => {
      window.clearTimeout(attachTimer)
      window.removeEventListener('keydown', onKey)
      document.removeEventListener('pointerdown', onDocPointer)
    }
  }, [open])

  function run(action) {
    setOpen(false)
    action?.()
  }

  return (
    <div
      className="activated-layer-menu-wrap activated-node-menu-wrap"
      ref={wrapRef}
      data-open={open ? 'true' : undefined}
      onClick={(e) => e.stopPropagation()}
      onPointerDown={(e) => e.stopPropagation()}
    >
      <button
        type="button"
        className="btn-icon activated-layer-menu-trigger"
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={menuId}
        onClick={(e) => {
          e.stopPropagation()
          setOpen((v) => !v)
        }}
      >
        ⋮
      </button>
      {open && (
        <div className="activated-layer-menu" id={menuId} role="menu">
          <button type="button" role="menuitem" className="activated-layer-menu-item" onClick={() => run(onEdit)}>
            Editar
          </button>
          {canDelete && (
            <button
              type="button"
              role="menuitem"
              className="activated-layer-menu-item danger-text"
              onClick={() => run(onDelete)}
            >
              Excluir
            </button>
          )}
        </div>
      )}
    </div>
  )
}
