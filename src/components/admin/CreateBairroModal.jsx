import { useEffect, useState } from 'react'
import Modal from '../ui/Modal.jsx'
import { blockEmptyBackspaceNav } from '../../utils/formInput.js'
import { ensureLocationPath } from '../../utils/locationApi.js'

export default function CreateBairroModal({ open, initialBairroName = '', onClose, onCreated }) {
  const [estado, setEstado] = useState('')
  const [cidade, setCidade] = useState('')
  const [distrito, setDistrito] = useState('')
  const [bairro, setBairro] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!open) return
    setEstado('')
    setCidade('')
    setDistrito('')
    setBairro(initialBairroName)
    setError(null)
  }, [open, initialBairroName])

  function handleClose() {
    if (busy) return
    onClose()
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      const node = await ensureLocationPath({ estado, cidade, distrito, bairro })
      onCreated?.(node)
      onClose()
    } catch (err) {
      setError(err.message ?? 'Não foi possível criar.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal open={open} title="Criar bairro" onClose={handleClose} animated wide cardLayout>
      <section className="modal-section modal-section-activate">
        <form className="stack-form activate-form" onSubmit={handleSubmit}>
          <label>
            Estado
            <input
              type="text"
              value={estado}
              onChange={(e) => setEstado(e.target.value)}
              onKeyDown={blockEmptyBackspaceNav}
              placeholder="insira o estado"
              required
              disabled={busy}
              autoComplete="off"
              autoFocus
            />
          </label>
          <label>
            Cidade
            <input
              type="text"
              value={cidade}
              onChange={(e) => setCidade(e.target.value)}
              onKeyDown={blockEmptyBackspaceNav}
              placeholder="insira a cidade"
              required
              disabled={busy}
              autoComplete="off"
            />
          </label>
          <label>
            Distrito
            <input
              type="text"
              value={distrito}
              onChange={(e) => setDistrito(e.target.value)}
              onKeyDown={blockEmptyBackspaceNav}
              placeholder="insira o distrito"
              required
              disabled={busy}
              autoComplete="off"
            />
          </label>
          <label>
            Bairro
            <input
              type="text"
              value={bairro}
              onChange={(e) => setBairro(e.target.value)}
              onKeyDown={blockEmptyBackspaceNav}
              placeholder="insira o nome do bairro"
              required
              disabled={busy}
              autoComplete="off"
            />
          </label>
          {error && <p className="form-hint error">{error}</p>}
          <button type="submit" className="btn primary" disabled={busy}>
            {busy ? 'Criando…' : 'Criar'}
          </button>
        </form>
      </section>
    </Modal>
  )
}
