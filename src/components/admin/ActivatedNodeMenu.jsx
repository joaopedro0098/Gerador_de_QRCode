import { useEffect, useId, useRef, useState } from 'react'

export default function ActivatedNodeMenu({
  label = 'Opções',
  canAdd = false,
  canDelete = false,
  onAdd,
  onEdit,
  onDelete,
}) {
  const [open, setOpen] = useState(false)
  const wrapRef = useRef(null)
  const menuId = useId()

  useEffect(() => {
    if (!open) return
    function onDocPointer(e) {
      if (wrapRef.current?.contains(e.target)) return
      setOpen(false)
    }
    function onKey(e) {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('pointerdown', onDocPointer)
    window.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('pointerdown', onDocPointer)
      window.removeEventListener('keydown', onKey)
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
      onClick={(e) => e.stopPropagation()}
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
          {canAdd && (
            <button type="button" role="menuitem" className="activated-layer-menu-item" onClick={() => run(onAdd)}>
              Adicionar
            </button>
          )}
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
