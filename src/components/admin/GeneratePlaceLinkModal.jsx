import { useEffect, useState } from 'react'
import Modal from '../ui/Modal.jsx'
import { buildLinkFromPlaceId } from '../../utils/placeIdLink.js'

export default function GeneratePlaceLinkModal({ open, onClose }) {
  const [placeId, setPlaceId] = useState('')
  const [generatedLink, setGeneratedLink] = useState(null)
  const [copyHint, setCopyHint] = useState(null)

  useEffect(() => {
    if (!open) {
      setPlaceId('')
      setGeneratedLink(null)
      setCopyHint(null)
    }
  }, [open])

  function handleGenerate() {
    setCopyHint(null)
    const link = buildLinkFromPlaceId(placeId)
    setGeneratedLink(link)
  }

  async function handleCopy() {
    if (!generatedLink) return
    try {
      await navigator.clipboard.writeText(generatedLink)
      setCopyHint('Copiado!')
    } catch {
      setCopyHint('Não foi possível copiar.')
    }
  }

  return (
    <Modal open={open} title="Gerar link" onClose={onClose} animated>
      <div className="place-link-modal">
        <p className="place-link-modal-label">Cole o place ID do comércio</p>
        <div className="place-link-modal-row">
          <input
            type="text"
            className="place-link-modal-input"
            value={placeId}
            onChange={(e) => setPlaceId(e.target.value)}
            placeholder="Place ID"
            autoComplete="off"
          />
          <button type="button" className="btn secondary small" onClick={handleGenerate}>
            Gerar
          </button>
        </div>
        {generatedLink && (
          <div className="place-link-result">
            <a
              href={generatedLink}
              target="_blank"
              rel="noopener noreferrer"
              className="place-link-result-url"
            >
              {generatedLink}
            </a>
            <button
              type="button"
              className="place-link-result-copy"
              onClick={() => void handleCopy()}
              aria-label="Copiar link"
            >
              Copiar
            </button>
          </div>
        )}
        {copyHint && <p className="form-hint success place-link-copy-hint">{copyHint}</p>}
      </div>
    </Modal>
  )
}
