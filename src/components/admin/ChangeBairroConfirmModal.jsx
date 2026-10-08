import Modal from '../ui/Modal.jsx'

export default function ChangeBairroConfirmModal({ open, busy = false, onCancel, onProceed }) {
  return (
    <Modal open={open} title="Mudar bairro" onClose={busy ? () => {} : onCancel} animated>
      <p className="form-hint">
        Esta loja já está ativa neste bairro, ao prosseguir você estará mudando ela de bairro,
        deseja prosseguir?
      </p>
      <div className="art-download-quality-actions">
        <button type="button" className="btn secondary" onClick={onCancel} disabled={busy}>
          Cancelar
        </button>
        <button type="button" className="btn primary" onClick={onProceed} disabled={busy}>
          {busy ? 'Salvando…' : 'Prosseguir'}
        </button>
      </div>
    </Modal>
  )
}
