import { useEffect, useMemo, useState } from 'react'
import { Rnd } from 'react-rnd'
import { qrSvgForCode } from '../../../utils/qr.js'

const STAGE_WIDTH = 360

function ResizeGrip({ label }) {
  return (
    <span className="art-rnd-grip" aria-hidden title={label}>
      <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
        <path
          d="M1 5V1H5M9 1H13V5M13 9V13H9M5 13H1V9"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
        />
        <path d="M7 4V10M4 7H10" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
      </svg>
    </span>
  )
}

export default function ArtCanvasEditor({ session, previewUrl, previewCode, onQrChange }) {
  const [qrSvg, setQrSvg] = useState('')

  const scale = useMemo(() => {
    if (!session?.card_width_cm) return 1
    return STAGE_WIDTH / Number(session.card_width_cm)
  }, [session?.card_width_cm])

  const cardW = Number(session.card_width_cm) * scale
  const cardH = Number(session.card_height_cm) * scale

  const qrX = Number(session.qr_x_cm) * scale
  const qrY = Number(session.qr_y_cm) * scale
  const qrSize = Number(session.qr_size_cm) * scale

  useEffect(() => {
    if (!previewCode) {
      setQrSvg('')
      return
    }
    qrSvgForCode(previewCode).then(setQrSvg)
  }, [previewCode])

  if (!session?.card_width_cm || !previewUrl) return null

  function emitQr(xPx, yPx, sizePx) {
    onQrChange({
      qr_x_cm: xPx / scale,
      qr_y_cm: yPx / scale,
      qr_size_cm: sizePx / scale,
    })
  }

  return (
    <div className="art-canvas-stage" style={{ width: STAGE_WIDTH, minHeight: cardH + 8 }}>
      <div className="art-canvas-wrap art-canvas-wrap-editor" style={{ width: cardW, height: cardH }}>
        <ResizeGrip label="Arte" />
        <img src={previewUrl} alt="" className="art-canvas-bg" draggable={false} />
        {qrSvg && (
          <Rnd
            size={{ width: qrSize, height: qrSize }}
            position={{ x: qrX, y: qrY }}
            bounds="parent"
            lockAspectRatio
            enableResizing={{
              top: false,
              right: false,
              bottom: false,
              left: false,
              topRight: false,
              bottomLeft: false,
              topLeft: true,
              bottomRight: true,
            }}
            onDragStop={(_e, d) => emitQr(d.x, d.y, qrSize)}
            onResizeStop={(_e, _dir, ref, _delta, position) => {
              emitQr(position.x, position.y, ref.offsetWidth)
            }}
            className="art-qr-rnd"
          >
            <ResizeGrip label="QR code" />
            <div className="art-qr-inner" dangerouslySetInnerHTML={{ __html: qrSvg }} />
          </Rnd>
        )}
      </div>
    </div>
  )
}
