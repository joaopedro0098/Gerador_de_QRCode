import { useEffect, useState } from 'react'
import Modal from '../ui/Modal.jsx'
import ActivateForm from './ActivateForm.jsx'
import { downloadSvgString } from '../../utils/download.js'
import { cardPublicUrl, qrSvgForCode } from '../../utils/qr.js'

export default function CardDetailModal({ card, onClose, onSaved }) {
  const [svg, setSvg] = useState('')
  const [qrLoading, setQrLoading] = useState(true)

  useEffect(() => {
    if (!card) return
    let cancelled = false
    setQrLoading(true)
    qrSvgForCode(card.code).then((result) => {
      if (!cancelled) {
        setSvg(result)
        setQrLoading(false)
      }
    })
    return () => {
      cancelled = true
    }
  }, [card])

  if (!card) return null

  const publicUrl = cardPublicUrl(card.code)
  const activated = Boolean(card.destination_url)

  return (
    <Modal
      open={Boolean(card)}
      title={card.code}
      onClose={onClose}
      wide
    >
      <section className="modal-section">
        <h3 className="modal-section-title">QR code</h3>
        {qrLoading ? (
          <p className="muted">Gerando QR…</p>
        ) : (
          <>
            <p className="qr-modal-url">
              <a href={publicUrl} target="_blank" rel="noreferrer">
                {publicUrl}
              </a>
            </p>
            <div
              className="qr-preview"
              dangerouslySetInnerHTML={{ __html: svg }}
            />
            <button
              type="button"
              className="btn secondary"
              onClick={() => downloadSvgString(svg, `${card.code}.svg`)}
            >
              Baixar SVG
            </button>
          </>
        )}
      </section>

      <section className="modal-section">
        <h3 className="modal-section-title">
          {activated ? 'Editar link' : 'Ativar'}
        </h3>
        <ActivateForm card={card} onSaved={onSaved} />
      </section>
    </Modal>
  )
}
