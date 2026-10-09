import { useEffect, useState } from 'react'
import Modal from '../ui/Modal.jsx'
import { supabase } from '../../lib/supabase.js'

export default function CardAnnotationModal({ card, open, onClose, onSaved }) {
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!open || !card) return
    setText(card.annotation ?? '')
    setError(null)
  }, [open, card?.id, card?.annotation])

  async function handleSave() {
    if (!card) return
    setBusy(true)
    setError(null)
    const value = text.trim()
    const { data, error: err } = await supabase
      .from('cards')
      .update({ annotation: value || null })
      .eq('id', card.id)
      .select(
        'id, code, destination_url, activated_at, created_at, notes, nfc_url, nfc_uid, location_bairro_id, paused, annotation',
      )
      .single()
    setBusy(false)
    if (err) {
      setError(err.message)
      return
    }
    onSaved?.(data)
    onClose()
  }

  return (
    <Modal open={open} title={`Anotações — ${card?.code ?? ''}`} onClose={onClose} animated>
      <label className="stack-form">
        <span className="muted">Texto da anotação</span>
        <textarea
          className="annotation-textarea"
          rows={12}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Escreva aqui…"
          disabled={busy}
        />
      </label>
      {error && <p className="form-hint error">{error}</p>}
      <div className="art-download-quality-actions">
        <button type="button" className="btn secondary" onClick={onClose} disabled={busy}>
          Cancelar
        </button>
        <button type="button" className="btn primary" onClick={handleSave} disabled={busy}>
          {busy ? 'Salvando…' : 'Salvar'}
        </button>
      </div>
    </Modal>
  )
}
