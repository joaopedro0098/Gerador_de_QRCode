import { useEffect, useRef, useState } from 'react'
import Modal from '../ui/Modal.jsx'
import ActivateForm from './ActivateForm.jsx'
import { downloadSvgString } from '../../utils/download.js'
import { qrSvgForCode } from '../../utils/qr.js'

export default function CardDetailModal({
  card = null,
  open = true,
  onClose,
  onSaved,
  focusActivate = false,
  activateOnly = false,
}) {
  const [svg, setSvg] = useState('')
  const [qrLoading, setQrLoading] = useState(true)
  const activateRef = useRef(null)

  const isOpen = activateOnly ? open : Boolean(card)

  useEffect(() => {
    if (!isOpen || !card || activateOnly) return
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
  }, [card, activateOnly, isOpen])

  useEffect(() => {
    if (!isOpen || !focusActivate) return
    const id = requestAnimationFrame(() => {
      activateRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    })
    return () => cancelAnimationFrame(id)
  }, [isOpen, focusActivate, card?.id])

  if (!isOpen) return null

  const activated = card ? Boolean(card.destination_url) : false

  return (
    <Modal
      open={isOpen}
      title={activateOnly ? 'Ativar card' : card.code}
      onClose={onClose}
      wide
      cardLayout={!activateOnly && Boolean(card)}
    >
      {!activateOnly && card && (
        <section className="modal-section modal-section-qr">
          <h3 className="modal-section-title">QR code</h3>
          {qrLoading ? (
            <p className="muted">Gerando QR…</p>
          ) : (
            <>
              <div
                className="qr-preview qr-preview-compact"
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
      )}

      <section
        className="modal-section modal-section-activate"
        ref={activateRef}
        id="modal-activate-section"
      >
        {!activateOnly && (
          <h3 className="modal-section-title">
            {activated ? 'Editar link' : 'Ativar'}
          </h3>
        )}
        <ActivateForm
          card={activateOnly ? null : card}
          standalone={activateOnly}
          onSaved={onSaved}
        />
      </section>
    </Modal>
  )
}
