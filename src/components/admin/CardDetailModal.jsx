import { useEffect, useState } from 'react'
import Modal from '../ui/Modal.jsx'
import ActivateForm from './ActivateForm.jsx'
import { isCardActivated } from '../../utils/cardStatus.js'
import { qrSvgForCode } from '../../utils/qr.js'

function formatModalMeta(card) {
  if (!card?.code) return null
  const activated = isCardActivated(card)
  if (!activated) {
    return null
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
  }, [card?.id, card?.code, card?.destination_url, card?.nfc_url, card?.activated_at])

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
  }, [card?.code, activateOnly, isOpen])

  if (!isOpen) return null

  function handleSaved(updated) {
    setDisplayCard(updated)
    onSaved?.(updated)
  }

  const virginActivateFlow =
    Boolean(card) && focusActivate && displayCard && !isCardActivated(displayCard)

  const modalTitle = displayCard?.code
    ? `ID: ${displayCard.code}`
    : activateOnly
      ? 'Ativar card'
      : ''
  const headerMeta = activateOnly || virginActivateFlow ? null : formatModalMeta(displayCard)

  return (
    <Modal
      open={isOpen}
      title={modalTitle}
      headerMeta={headerMeta}
      onClose={onClose}
      wide
      cardLayout={!activateOnly && Boolean(card) && !virginActivateFlow}
    >
      {!activateOnly && card && !virginActivateFlow && (
        <section className="modal-section modal-section-qr">
          {qrLoading ? (
            <p className="muted">Gerando QR…</p>
          ) : (
            <>
              <div
                className="qr-preview qr-preview-compact"
                dangerouslySetInnerHTML={{ __html: svg }}
              />
            </>
          )}
        </section>
      )}

      <section className="modal-section modal-section-activate" id="modal-activate-section">
        <ActivateForm
          card={activateOnly ? null : displayCard}
          standalone={activateOnly}
          focusLinkOnMount={focusActivate}
          onSaved={handleSaved}
        />
      </section>
    </Modal>
  )
}
