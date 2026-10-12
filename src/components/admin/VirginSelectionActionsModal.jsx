import Modal from '../ui/Modal.jsx'

function formatCount(n) {
  const num = Number(n)
  if (!Number.isFinite(num) || num < 0) return '0'
  return String(num)
}

export default function VirginSelectionActionsModal({
  open,
  count = 0,
  busy = false,
  downloadBusy = false,
  downloadProgress = '',
  onCancel,
  onConfirmStock,
  onDownloadQr,
}) {
  const n = formatCount(count)
  const locked = busy || downloadBusy

  return (
    <Modal
      open={open}
      title="Selecionados"
      onClose={locked ? () => {} : onCancel}
      animated
    >
      <p className="form-hint">Foram selecionados {n} ID(s).</p>
      {downloadProgress && <p className="form-hint muted">{downloadProgress}</p>}
      <div className="virgin-selection-modal-actions">
        <button type="button" className="btn secondary" onClick={onCancel} disabled={locked}>
          Cancelar
        </button>
        <button
          type="button"
          className="btn secondary"
          onClick={onDownloadQr}
          disabled={locked || count < 1}
        >
          {downloadBusy ? 'Gerando…' : 'Baixar somente QR code'}
        </button>
        <button
          type="button"
          className="btn primary"
          onClick={onConfirmStock}
          disabled={locked || count < 1}
        >
          {busy ? 'Enviando…' : 'Enviar para estoque'}
        </button>
      </div>
    </Modal>
  )
}
