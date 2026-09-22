import { useEffect, useState } from 'react'
import Modal from '../ui/Modal.jsx'
import ActivateForm from './ActivateForm.jsx'
import { downloadSvgString } from '../../utils/download.js'
import { qrSvgForCode } from '../../utils/qr.js'

function formatModalMeta(card) {
  if (!card?.code) return null
  const activated = Boolean(card.destination_url)
  if (!activated) {
    return 'Virgem'
  }
  if (card.activated_at) {
    const date = new Date(card.activated_at).toLocaleDateString('pt-BR')
    return `Ativado · desde ${date}`
  }
  return 'Ativado'
}

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
  const [displayCard, setDisplayCard] = useState(card)

  const isOpen = activateOnly ? open : Boolean(card)

  useEffect(() => {
    setDisplayCard(card)
  }, [card?.id, card?.destination_url, card?.activated_at, card?.code])

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

  if (!isOpen) return null

  function handleSaved(updated) {
    setDisplayCard(updated)
    onSaved?.(updated)
  }

  const modalTitle = activateOnly ? 'Ativar card' : displayCard?.code
  const headerMeta = activateOnly ? null : formatModalMeta(displayCard)

  return (
    <Modal
      open={isOpen}
      title={modalTitle}
      headerMeta={headerMeta}
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

      <section className="modal-section modal-section-activate" id="modal-activate-section">
        <ActivateForm
          card={activateOnly ? null : card}
          standalone={activateOnly}
          focusLinkOnMount={focusActivate}
          onSaved={handleSaved}
        />
      </section>
    </Modal>
  )
}
