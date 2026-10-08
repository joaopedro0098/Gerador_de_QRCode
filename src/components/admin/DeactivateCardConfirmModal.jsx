import Modal from '../ui/Modal.jsx'

export default function DeactivateCardConfirmModal({
  open,
  code,
  busy = false,
  onCancel,
  onConfirm,
}) {
  return (
    <Modal
      open={open}
      title={code ? `Desativar ${code}` : 'Desativar QR code'}
      onClose={busy ? () => {} : onCancel}
      animated
    >
      <p className="form-hint">
        QR, NFC, estabelecimento, bairro e anotações serão limpos e o card voltará para Virgens.
        Deseja continuar?
      </p>
      <div className="art-download-quality-actions">
        <button type="button" className="btn secondary" onClick={onCancel} disabled={busy}>
          Cancelar
        </button>
        <button type="button" className="btn secondary danger" onClick={onConfirm} disabled={busy}>
          {busy ? 'Desativando…' : 'Desativar'}
        </button>
      </div>
    </Modal>
  )
}
