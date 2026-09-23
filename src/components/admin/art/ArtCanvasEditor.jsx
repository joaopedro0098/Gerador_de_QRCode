import { useEffect, useMemo, useState } from 'react'
import { Rnd } from 'react-rnd'
import { qrSvgForCode } from '../../../utils/qr.js'

const PREVIEW_WIDTH = 360

export default function ArtCanvasEditor({ session, previewUrl, onChange }) {
  const [qrSvg, setQrSvg] = useState('')

  const scale = useMemo(() => {
    if (!session?.card_width_cm) return 1
    return PREVIEW_WIDTH / Number(session.card_width_cm)
  }, [session?.card_width_cm])

  const previewHeight = session?.card_height_cm
    ? Number(session.card_height_cm) * scale
    : PREVIEW_WIDTH * 0.6

  useEffect(() => {
    qrSvgForCode('loja0').then(setQrSvg)
  }, [])

  if (!session?.card_width_cm || !previewUrl) return null

  const qrX = Number(session.qr_x_cm) * scale
  const qrY = Number(session.qr_y_cm) * scale
  const qrSize = Number(session.qr_size_cm) * scale

  function emitUpdate(xPx, yPx, sizePx) {
    onChange({
      qr_x_cm: xPx / scale,
      qr_y_cm: yPx / scale,
      qr_size_cm: sizePx / scale,
    })
  }

  return (
    <div
      className="art-canvas-wrap"
      style={{ width: PREVIEW_WIDTH, height: previewHeight }}
    >
      <img src={previewUrl} alt="" className="art-canvas-bg" draggable={false} />
      {qrSvg && (
        <Rnd
          size={{ width: qrSize, height: qrSize }}
          position={{ x: qrX, y: qrY }}
          bounds="parent"
          lockAspectRatio
          onDragStop={(_e, d) => emitUpdate(d.x, d.y, qrSize)}
          onResizeStop={(_e, _dir, ref, _delta, position) => {
            const size = ref.offsetWidth
            emitUpdate(position.x, position.y, size)
          }}
          className="art-qr-rnd"
        >
          <div className="art-qr-inner" dangerouslySetInnerHTML={{ __html: qrSvg }} />
        </Rnd>
      )}
    </div>
  )
}
