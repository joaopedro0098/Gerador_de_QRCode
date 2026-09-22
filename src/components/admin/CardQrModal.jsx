import { useEffect, useState } from 'react'
import Modal from '../ui/Modal.jsx'
import { downloadSvgString } from '../../utils/download.js'
import { cardPublicUrl, qrSvgForCode } from '../../utils/qr.js'

export default function CardQrModal({ card, onClose }) {
  const [svg, setSvg] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!card) return
    let cancelled = false
    setLoading(true)
    qrSvgForCode(card.code).then((result) => {
      if (!cancelled) {
        setSvg(result)
        setLoading(false)
      }
    })
    return () => {
      cancelled = true
    }
  }, [card])

  if (!card) return null

  const publicUrl = cardPublicUrl(card.code)

  return (
    <Modal open={Boolean(card)} title={`QR · ${card.code}`} onClose={onClose}>
      {loading ? (
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
            className="btn primary"
            onClick={() => downloadSvgString(svg, `${card.code}.svg`)}
          >
            Baixar SVG
          </button>
        </>
      )}
    </Modal>
  )
}
