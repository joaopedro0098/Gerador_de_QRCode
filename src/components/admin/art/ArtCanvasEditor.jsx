import { useEffect, useMemo, useRef, useState } from 'react'
import { Rnd } from 'react-rnd'
import { qrSvgForCode } from '../../../utils/qr.js'

const STAGE_WIDTH = 360

export default function ArtCanvasEditor({
  session,
  previewUrl,
  onQrChange,
  onCardSizeChange,
}) {
  const [qrSvg, setQrSvg] = useState('')
  const qrSvgLoaded = useRef(false)

  const scale = useMemo(() => {
    if (!session?.card_width_cm) return 1
    return STAGE_WIDTH / Number(session.card_width_cm)
  }, [session?.card_width_cm])

  const cardW = Number(session.card_width_cm) * scale
  const cardH = Number(session.card_height_cm) * scale
  const aspect = Number(session.art_aspect_ratio) || cardW / cardH || 1

  const qrX = Number(session.qr_x_cm) * scale
  const qrY = Number(session.qr_y_cm) * scale
  const qrSize = Number(session.qr_size_cm) * scale

  useEffect(() => {
    if (qrSvgLoaded.current) return
    qrSvgLoaded.current = true
    qrSvgForCode('loja0').then(setQrSvg)
  }, [])

  if (!session?.card_width_cm || !previewUrl) return null

  function emitQr(xPx, yPx, sizePx) {
    onQrChange({
      qr_x_cm: xPx / scale,
      qr_y_cm: yPx / scale,
      qr_size_cm: sizePx / scale,
    })
  }

  function emitCardSize(widthPx, heightPx) {
    onCardSizeChange({
      card_width_cm: widthPx / scale,
      card_height_cm: heightPx / scale,
    })
  }

  return (
    <div className="art-canvas-stage" style={{ width: STAGE_WIDTH, minHeight: cardH + 8 }}>
      <Rnd
        size={{ width: cardW, height: cardH }}
        position={{ x: 0, y: 0 }}
        lockAspectRatio={aspect}
        enableResizing={{
          bottom: false,
          bottomLeft: true,
          bottomRight: true,
          left: false,
          right: false,
          top: false,
          topLeft: true,
          topRight: true,
        }}
        disableDragging
        onResizeStop={(_e, _dir, ref) => {
          emitCardSize(ref.offsetWidth, ref.offsetHeight)
        }}
        className="art-card-rnd"
      >
        <img src={previewUrl} alt="" className="art-canvas-bg" draggable={false} />
        {qrSvg && (
          <Rnd
            size={{ width: qrSize, height: qrSize }}
            position={{ x: qrX, y: qrY }}
            bounds="parent"
            lockAspectRatio
            onDragStop={(_e, d) => emitQr(d.x, d.y, qrSize)}
            onResizeStop={(_e, _dir, ref, _delta, position) => {
              emitQr(position.x, position.y, ref.offsetWidth)
            }}
            className="art-qr-rnd"
          >
            <div className="art-qr-inner" dangerouslySetInnerHTML={{ __html: qrSvg }} />
          </Rnd>
        )}
      </Rnd>
      <p className="form-hint muted art-canvas-hint">
        Arraste o canto do card para ajustar o tamanho (proporção preservada). Mova o QR dentro do card.
      </p>
    </div>
  )
}
