import Modal from '../../ui/Modal.jsx'
import { ART_PDF_EXPORT_SCALE, ART_PDF_EXPORT_SCALE_HIGH } from '../../../lib/config.js'

export const ART_DOWNLOAD_QUALITY = {
  standard: { id: 'standard', label: 'Qualidade padrão', scale: ART_PDF_EXPORT_SCALE },
  high: { id: 'high', label: 'Qualidade alta', scale: ART_PDF_EXPORT_SCALE_HIGH },
}

export default function ArtDownloadQualityModal({
  open,
  format,
  qualityId,
  onQualityChange,
  onConfirm,
  onClose,
}) {
  const formatUpper = format === 'pdf' ? 'PDF' : 'SVG'

  return (
    <Modal open={open} title={`Baixar ${formatUpper}`} onClose={onClose} animated>
      <p className="form-hint muted">Escolha a qualidade da arte de fundo ao gerar o arquivo.</p>

      <div className="art-download-quality-options" role="radiogroup" aria-label="Qualidade">
        {Object.values(ART_DOWNLOAD_QUALITY).map((opt) => (
          <label key={opt.id} className="art-download-quality-option">
            <input
              type="radio"
              name="art-download-quality"
              value={opt.id}
              checked={qualityId === opt.id}
              onChange={() => onQualityChange(opt.id)}
            />
            <span>{opt.label}</span>
          </label>
        ))}
      </div>

      <p className="form-hint muted">
        Qualidade alta gera arquivos maiores e pode demorar mais, principalmente ao baixar vários
        cartões de uma vez (ZIP).
      </p>

      <div className="art-download-quality-actions">
        <button type="button" className="btn secondary" onClick={onClose}>
          Cancelar
        </button>
        <button type="button" className="btn primary" onClick={onConfirm}>
          Confirmar
        </button>
      </div>
    </Modal>
  )
}
