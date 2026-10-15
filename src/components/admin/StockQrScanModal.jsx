import { useCallback, useEffect, useRef, useState } from 'react'
import Modal from '../ui/Modal.jsx'

function supportsQrScan() {
  return typeof window !== 'undefined' && 'BarcodeDetector' in window
}

export default function StockQrScanModal({ open, onClose, onScanText, busy = false, scanError = null }) {
  const videoRef = useRef(null)
  const streamRef = useRef(null)
  const rafRef = useRef(0)
  const detectorRef = useRef(null)
  const handledRef = useRef(false)
  const [cameraError, setCameraError] = useState(null)
  const [hint, setHint] = useState(null)

  const stopCamera = useCallback(() => {
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current)
      rafRef.current = 0
    }
    streamRef.current?.getTracks().forEach((t) => t.stop())
    streamRef.current = null
    if (videoRef.current) {
      videoRef.current.srcObject = null
    }
  }, [])

  useEffect(() => {
    if (!open) {
      stopCamera()
      setCameraError(null)
      setHint(null)
      handledRef.current = false
      return
    }

    handledRef.current = false
    setCameraError(null)
    setHint(null)

    if (!supportsQrScan()) {
      setCameraError(
        'Seu navegador não suporta leitura de QR pela câmera. Use Chrome no celular ou atualize o navegador.',
      )
      return stopCamera
    }

    let cancelled = false

    async function start() {
      try {
        const detector = new BarcodeDetector({ formats: ['qr_code'] })
        detectorRef.current = detector

        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: 'environment' } },
          audio: false,
        })
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop())
          return
        }
        streamRef.current = stream
        const video = videoRef.current
        if (!video) return
        video.srcObject = stream
        await video.play()
        setHint('Aponte a câmera para o QR code.')

        const tick = async () => {
          if (cancelled || handledRef.current || busy) {
            rafRef.current = requestAnimationFrame(tick)
            return
          }
          try {
            const codes = await detector.detect(video)
            const qr = codes.find((c) => c.rawValue?.trim())
            if (qr?.rawValue) {
              const shouldClose = await onScanText(qr.rawValue.trim())
              if (shouldClose) {
                handledRef.current = true
                stopCamera()
                return
              }
            }
          } catch {
            /* frame sem leitura */
          }
          rafRef.current = requestAnimationFrame(tick)
        }
        rafRef.current = requestAnimationFrame(tick)
      } catch (err) {
        if (!cancelled) {
          setCameraError(
            err?.name === 'NotAllowedError'
              ? 'Permita o acesso à câmera para escanear o QR code.'
              : 'Não foi possível abrir a câmera.',
          )
        }
      }
    }

    void start()

    return () => {
      cancelled = true
      stopCamera()
      detectorRef.current = null
    }
  }, [open, busy, onScanText, stopCamera])

  function handleClose() {
    if (busy) return
    onClose()
  }

  return (
    <Modal open={open} title="Cadastrar por QR" onClose={handleClose}>
      <div className="stock-qr-scan-modal">
        {cameraError ? (
          <p className="form-hint error">{cameraError}</p>
        ) : (
          <>
            <div className="stock-qr-scan-video-wrap">
              <video ref={videoRef} className="stock-qr-scan-video" playsInline muted aria-label="Câmera" />
            </div>
            {hint && !busy && !scanError && <p className="form-hint muted">{hint}</p>}
            {busy && <p className="form-hint muted">Identificando QR code…</p>}
            {scanError && <p className="form-hint error">{scanError}</p>}
          </>
        )}
        <button type="button" className="btn secondary wide" disabled={busy} onClick={handleClose}>
          Cancelar
        </button>
      </div>
    </Modal>
  )
}
