import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Rnd } from 'react-rnd'
import { fetchArtFileBytes } from '../../../utils/artSessionApi.js'
import { renderPdfPageToPngBytes } from '../../../utils/artPdfRender.js'
import { qrSvgForCode } from '../../../utils/qr.js'
import { resolveArtRectCm } from '../../../utils/artUnits.js'

const STAGE_WIDTH = 360
const ZOOM_MIN = 0.35
const ZOOM_MAX = 3
const ZOOM_STEP = 0.08

const resizeHandleComponent = {
  topLeft: <span className="art-rnd-handle art-rnd-handle-nw" aria-hidden />,
  bottomRight: <span className="art-rnd-handle art-rnd-handle-se" aria-hidden />,
}

export default function ArtCanvasEditor({
  session,
  previewUrl,
  previewCode,
  onQrChange,
  onArtChange,
}) {
  const [qrSvg, setQrSvg] = useState('')
  const [bgSrc, setBgSrc] = useState(null)
  const [viewZoom, setViewZoom] = useState(1)
  const pdfBlobUrlRef = useRef(null)
  const viewportRef = useRef(null)

  const scale = useMemo(() => {
    if (!session?.card_width_cm) return 1
    return STAGE_WIDTH / Number(session.card_width_cm)
  }, [session?.card_width_cm])

  const cardW = Number(session.card_width_cm) * scale
  const cardH = Number(session.card_height_cm) * scale

  const artRect = useMemo(() => resolveArtRectCm(session), [session])
  const artX = artRect.art_x_cm * scale
  const artY = artRect.art_y_cm * scale
  const artW = artRect.art_width_cm * scale
  const artH = artRect.art_height_cm * scale

  const qrX = Number(session.qr_x_cm) * scale
  const qrY = Number(session.qr_y_cm) * scale
  const qrSize = Number(session.qr_size_cm) * scale

  const artAspect = useMemo(() => {
    const r = Number(session.art_aspect_ratio)
    if (r > 0) return r
    if (artRect.art_height_cm > 0) return artRect.art_width_cm / artRect.art_height_cm
    return 1
  }, [session.art_aspect_ratio, artRect.art_width_cm, artRect.art_height_cm])

  useEffect(() => {
    if (!previewCode) {
      setQrSvg('')
      return
    }
    qrSvgForCode(previewCode).then(setQrSvg)
  }, [previewCode])

  useEffect(() => {
    function revokePdfBlobUrl() {
      if (pdfBlobUrlRef.current) {
        URL.revokeObjectURL(pdfBlobUrlRef.current)
        pdfBlobUrlRef.current = null
      }
    }

    if (!session?.file_path || !session?.card_width_cm) {
      revokePdfBlobUrl()
      setBgSrc(null)
      return
    }

    if (session.file_mime !== 'application/pdf') {
      revokePdfBlobUrl()
      setBgSrc(previewUrl ?? null)
      return
    }

    let cancelled = false
    revokePdfBlobUrl()
    setBgSrc(null)

    ;(async () => {
      try {
        const bytes = await fetchArtFileBytes(session.file_path)
        if (cancelled) return
        const pngBytes = await renderPdfPageToPngBytes(bytes.buffer)
        if (cancelled) return
        const url = URL.createObjectURL(new Blob([pngBytes], { type: 'image/png' }))
        pdfBlobUrlRef.current = url
        setBgSrc(url)
      } catch {
        if (!cancelled) setBgSrc(null)
      }
    })()

    return () => {
      cancelled = true
      revokePdfBlobUrl()
    }
  }, [session?.file_path, session?.file_mime, session?.card_width_cm, previewUrl])

  const handleWheel = useCallback((e) => {
    if (!viewportRef.current?.contains(e.target)) return
    e.preventDefault()
    const delta = e.deltaY > 0 ? -ZOOM_STEP : ZOOM_STEP
    setViewZoom((z) => Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, z + delta)))
  }, [])

  useEffect(() => {
    const el = viewportRef.current
    if (!el) return
    el.addEventListener('wheel', handleWheel, { passive: false })
    return () => el.removeEventListener('wheel', handleWheel)
  }, [handleWheel, bgSrc])

  if (!session?.card_width_cm || !bgSrc) return null

  function emitQr(xPx, yPx, sizePx) {
    onQrChange({
      qr_x_cm: xPx / scale,
      qr_y_cm: yPx / scale,
      qr_size_cm: sizePx / scale,
    })
  }

  function emitArt(xPx, yPx, wPx, hPx) {
    onArtChange({
      art_x_cm: xPx / scale,
      art_y_cm: yPx / scale,
      art_width_cm: wPx / scale,
      art_height_cm: hPx / scale,
    })
  }

  const resizeHandles = {
    top: false,
    right: false,
    bottom: false,
    left: false,
    topRight: false,
    bottomLeft: false,
    topLeft: true,
    bottomRight: true,
  }

  const rndCommon = {
    bounds: 'parent',
    enableResizing: resizeHandles,
    resizeHandleComponent,
    scale: viewZoom,
  }

  return (
    <div className="art-canvas-stage">
      <div ref={viewportRef} className="art-canvas-viewport">
        <div
          className="art-canvas-zoom-layer"
          style={{
            width: cardW * viewZoom + 32,
            height: cardH * viewZoom + 32,
          }}
        >
          <div
            className="art-canvas-zoom-inner"
            style={{ transform: `scale(${viewZoom})`, width: cardW, height: cardH }}
          >
            <div className="art-canvas-wrap art-canvas-wrap-editor" style={{ width: cardW, height: cardH }}>
              <Rnd
                {...rndCommon}
                size={{ width: artW, height: artH }}
                position={{ x: artX, y: artY }}
                lockAspectRatio={artAspect}
                onDragStop={(_e, d) => emitArt(d.x, d.y, artW, artH)}
                onResizeStop={(_e, _dir, ref, _delta, position) => {
                  emitArt(position.x, position.y, ref.offsetWidth, ref.offsetHeight)
                }}
                className="art-layer-rnd art-art-rnd"
              >
                <img src={bgSrc} alt="" className="art-layer-img" draggable={false} />
              </Rnd>
              {qrSvg && (
                <Rnd
                  {...rndCommon}
                  size={{ width: qrSize, height: qrSize }}
                  position={{ x: qrX, y: qrY }}
                  lockAspectRatio
                  onDragStop={(_e, d) => emitQr(d.x, d.y, qrSize)}
                  onResizeStop={(_e, _dir, ref, _delta, position) => {
                    emitQr(position.x, position.y, ref.offsetWidth)
                  }}
                  className="art-layer-rnd art-qr-rnd"
                >
                  <div className="art-qr-inner" dangerouslySetInnerHTML={{ __html: qrSvg }} />
                </Rnd>
              )}
            </div>
          </div>
        </div>
      </div>
      <p className="form-hint muted art-canvas-zoom-hint">Use a roda do mouse sobre o quadro para dar zoom.</p>
    </div>
  )
}
