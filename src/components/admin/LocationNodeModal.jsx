import { useEffect, useState } from 'react'
import Modal from '../ui/Modal.jsx'
import { blockEmptyBackspaceNav } from '../../utils/formInput.js'
import { LOCATION_LEVEL_LABEL, createLocationNode, updateLocationNode } from '../../utils/locationApi.js'

export default function LocationNodeModal({
  open,
  mode,
  level,
  parentId,
  node,
  onClose,
  onSaved,
}) {
  const [name, setName] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!open) return
    setName(mode === 'edit' ? (node?.name ?? '') : '')
    setError(null)
  }, [open, mode, node?.id, node?.name])

  async function handleSubmit(e) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      if (mode === 'edit' && node) {
        const { data, error: err } = await updateLocationNode(node.id, name)
        if (err) throw err
        onSaved?.(data)
      } else {
        const { data, error: err } = await createLocationNode({ level, parentId, name })
        if (err) throw err
        onSaved?.(data)
      }
      onClose()
    } catch (err) {
      setError(err.message ?? 'Erro ao salvar.')
    } finally {
      setBusy(false)
    }
  }

  const title =
    mode === 'edit'
      ? `Editar ${LOCATION_LEVEL_LABEL[level]?.toLowerCase() ?? 'pasta'}`
      : `Novo ${LOCATION_LEVEL_LABEL[level]?.toLowerCase() ?? 'pasta'}`

  return (
    <Modal open={open} title={title} onClose={onClose} animated wide cardLayout>
      <section className="modal-section modal-section-activate">
        <form className="stack-form activate-form" onSubmit={handleSubmit}>
          <label>
            Nome
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={blockEmptyBackspaceNav}
              placeholder="insira o nome"
              required
              disabled={busy}
              autoComplete="off"
              autoFocus
            />
          </label>
          {error && <p className="form-hint error">{error}</p>}
          <button type="submit" className="btn primary" disabled={busy}>
            {busy ? 'Salvando…' : 'Salvar'}
          </button>
        </form>
      </section>
    </Modal>
  )
}
