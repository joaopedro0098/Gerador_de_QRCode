import { useEffect, useState } from 'react'
import Modal from '../ui/Modal.jsx'
import ActivateForm from './ActivateForm.jsx'
import { isCardActivated } from '../../utils/cardStatus.js'
import { getLocationPathLabels } from '../../utils/locationApi.js'
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
  onPauseCard,
  onDeactivateCard,
}) {
  const [svg, setSvg] = useState('')
  const [qrLoading, setQrLoading] = useState(true)
  const [displayCard, setDisplayCard] = useState(card)
  const [locationPath, setLocationPath] = useState('')

  const isOpen = activateOnly ? open : Boolean(card)

  useEffect(() => {
    setDisplayCard(card)
  }, [card?.id, card?.code, card?.destination_url, card?.nfc_url, card?.activated_at, card?.location_bairro_id])

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

  const virginActivateFlow =
    Boolean(card) && focusActivate && displayCard && !isCardActivated(displayCard)
  const editingActivatedCard = Boolean(displayCard && isCardActivated(displayCard))

  useEffect(() => {
    const bairroId = displayCard?.location_bairro_id
    if (!editingActivatedCard || virginActivateFlow || activateOnly || !bairroId) {
      setLocationPath('')
      return
    }
    let cancelled = false
    getLocationPathLabels(bairroId).then(({ data }) => {
      if (!cancelled) setLocationPath(data?.trim() ? data : '')
    })
    return () => {
      cancelled = true
    }
  }, [displayCard?.location_bairro_id, editingActivatedCard, virginActivateFlow, activateOnly])

  if (!isOpen) return null

  function handleSaved(updated) {
    setDisplayCard(updated)
    onSaved?.(updated)
  }

  const modalTitle = displayCard?.code
    ? `ID: ${displayCard.code}`
    : activateOnly
      ? 'Ativar card'
      : ''
  const headerMeta = activateOnly || virginActivateFlow ? null : formatModalMeta(displayCard)
  const showActivatedFooterActions =
    !activateOnly &&
    displayCard &&
    isCardActivated(displayCard) &&
    (onPauseCard || onDeactivateCard)

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
            <div
              className="qr-preview qr-preview-compact"
              dangerouslySetInnerHTML={{ __html: svg }}
            />
          )}
          {locationPath ? (
            <p className="card-detail-location-path muted">{locationPath}</p>
          ) : null}
        </section>
      )}

      <section className="modal-section modal-section-activate" id="modal-activate-section">
        <ActivateForm
          card={activateOnly ? null : displayCard}
          standalone={activateOnly}
          focusLinkOnMount={focusActivate}
          hideActivateButton={editingActivatedCard}
          hideBairroField={editingActivatedCard}
          onSaved={handleSaved}
        />
        {showActivatedFooterActions && (
          <div className="card-detail-footer-actions">
            {onPauseCard && (
              <button
                type="button"
                className="btn secondary"
                onClick={() => onPauseCard(displayCard)}
              >
                {displayCard.paused ? 'Retomar' : 'Pausar'}
              </button>
            )}
            {onDeactivateCard && (
              <button
                type="button"
                className="btn secondary danger"
                onClick={() => onDeactivateCard(displayCard)}
              >
                Desativar
              </button>
            )}
          </div>
        )}
      </section>
    </Modal>
  )
}
