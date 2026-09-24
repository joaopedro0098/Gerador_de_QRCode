import { useEffect, useMemo, useState } from 'react'
import { qrSvgForCode } from '../../../utils/qr.js'
import { getArtSignedUrl } from '../../../utils/artSessionApi.js'

const PREVIEW_WIDTH = 320

export default function ArtVirginPreview({ session, code }) {
  const [previewUrl, setPreviewUrl] = useState(null)
  const [qrSvg, setQrSvg] = useState('')

  const scale = useMemo(() => {
    if (!session?.card_width_cm) return 1
    return PREVIEW_WIDTH / Number(session.card_width_cm)
  }, [session?.card_width_cm])

  const previewHeight = session?.card_height_cm
    ? Number(session.card_height_cm) * scale
    : 200

  useEffect(() => {
    if (!session?.file_path) return
    getArtSignedUrl(session.file_path).then(({ data }) => {
      setPreviewUrl(data?.signedUrl ?? null)
    })
  }, [session?.file_path])

  useEffect(() => {
    if (!code) return
    qrSvgForCode(code).then(setQrSvg)
  }, [code])

  if (!code) return <p className="muted">Nenhum card selecionado.</p>

  const qrX = Number(session.qr_x_cm) * scale
  const qrY = Number(session.qr_y_cm) * scale
  const qrSize = Number(session.qr_size_cm) * scale

  return (
    <div className="art-virgin-preview">
      <p className="form-hint">
        <strong>{code}</strong>
      </p>
      <div className="art-canvas-wrap" style={{ width: PREVIEW_WIDTH, height: previewHeight }}>
        {previewUrl && (
          <img src={previewUrl} alt="" className="art-canvas-bg art-canvas-bg-contain" draggable={false} />
        )}
        {qrSvg && (
          <div
            className="art-qr-overlay"
            style={{ left: qrX, top: qrY, width: qrSize, height: qrSize }}
            dangerouslySetInnerHTML={{ __html: qrSvg }}
          />
        )}
      </div>
    </div>
  )
}
