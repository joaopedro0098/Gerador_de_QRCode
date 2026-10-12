import Modal from '../ui/Modal.jsx'
import { VIRGIN_POOL_MAX } from '../../lib/config.js'

export default function BatchGenerateLimitModal({
  open,
  mode = null,
  available = 0,
  busy = false,
  onClose,
  onConfirmPartial,
}) {
  const isFull = mode === 'full'
  const isPartial = mode === 'partial'

  if (!isFull && !isPartial) return null

  const title = isFull ? 'Limite de virgens' : 'Quantidade acima do limite'

  const message = isFull ? (
    <>Transfira seus QR codes virgens para o estoque.</>
  ) : (
    <>
      Você solicitou uma quantidade maior do permitido. O limite é {VIRGIN_POOL_MAX}. Gerar pretende
      gerar somente os {available}.
    </>
  )

  return (
    <Modal open={open} title={title} onClose={busy ? () => {} : onClose} animated>
      <p className="form-hint">{message}</p>
      <div className="art-download-quality-actions">
        <button type="button" className="btn secondary" onClick={onClose} disabled={busy}>
          {isFull ? 'Fechar' : 'Cancelar'}
        </button>
        {isPartial && (
          <button
            type="button"
            className="btn primary"
            onClick={onConfirmPartial}
            disabled={busy || available < 1}
          >
            {busy ? 'Gerando…' : 'Confirmar'}
          </button>
        )}
      </div>
    </Modal>
  )
}
