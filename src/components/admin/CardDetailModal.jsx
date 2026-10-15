import { useEffect, useRef, useState } from 'react'
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
  readOnlyActivated = false,
  stockUi = false,
  onPauseCard,
  onDeactivateCard,
}) {
  const [svg, setSvg] = useState('')
  const [qrLoading, setQrLoading] = useState(true)
  const [displayCard, setDisplayCard] = useState(card)
  const [activatedSaveBusy, setActivatedSaveBusy] = useState(false)
  const activateFormRef = useRef(null)

  const isOpen = activateOnly ? open : Boolean(card)

  useEffect(() => {
    setDisplayCard(card)
  }, [
    card?.id,
    card?.code,
    card?.destination_url,
    card?.nfc_url,
    card?.activated_at,
    card?.location_bairro_id,
    card?.notes,
    card?.paused,
  ])

  useEffect(() => {
    if (!isOpen || !card || activateOnly) return
    let cancelled = false
    setQrLoading(true)
    const codeForQr = displayCard?.code ?? card.code
    const destForQr = displayCard?.destination_url ?? card.destination_url
    qrSvgForCode(codeForQr, destForQr).then((result) => {
      if (!cancelled) {
        setSvg(result)
        setQrLoading(false)
      }
    })
    return () => {
      cancelled = true
    }
  }, [card, displayCard?.code, displayCard?.destination_url, activateOnly, isOpen])

  const editingActivatedCard = Boolean(displayCard && isCardActivated(displayCard))
  const readOnly = readOnlyActivated && !stockUi && !activateOnly
  const stockActivationUi = stockUi && displayCard && !editingActivatedCard
  const stockManageUi = stockUi && displayCard && editingActivatedCard

  if (!isOpen) return null

  function handleSaved(updated, opts) {
    setDisplayCard(updated)
    onSaved?.(updated, opts)
  }

  const modalTitle = displayCard?.code
    ? `ID: ${displayCard.code}`
    : activateOnly
      ? 'Ativar card'
      : ''
  const headerMeta = activateOnly ? null : formatModalMeta(displayCard)
  const showStockManageFooter = !activateOnly && stockManageUi

  async function handleActivatedSaveClick() {
    const save = activateFormRef.current?.saveActivatedEdit
    if (!save) return
    setActivatedSaveBusy(true)
    try {
      await save()
    } finally {
      setActivatedSaveBusy(false)
    }
  }

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
          {qrLoading ? (
            <p className="muted">Gerando QR…</p>
          ) : (
            <div
              className="qr-preview qr-preview-compact"
              dangerouslySetInnerHTML={{ __html: svg }}
            />
          )}
        </section>
      )}

      {!readOnly && (
        <section className="modal-section modal-section-activate" id="modal-activate-section">
          <ActivateForm
            ref={activateFormRef}
            card={activateOnly ? null : displayCard}
            standalone={activateOnly}
            focusLinkOnMount={focusActivate}
            hideActivateButton={stockManageUi || stockActivationUi}
            hideBairroField={false}
            stockActivationUi={stockActivationUi}
            stockManageUi={stockManageUi}
            onSaved={handleSaved}
          />
          {showStockManageFooter && (
            <div className="card-detail-footer-actions">
              <button
                type="button"
                className="btn primary"
                disabled={activatedSaveBusy}
                onClick={() => void handleActivatedSaveClick()}
              >
                {activatedSaveBusy ? 'Salvando…' : 'Salvar'}
              </button>
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
      )}
    </Modal>
  )
}
