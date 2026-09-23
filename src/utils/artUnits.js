/** 1 cm em pontos PDF (72 pt = 1 polegada, 2,54 cm = 1 polegada). */
export function cmToPt(cm) {
  return (Number(cm) * 72) / 2.54
}

export function ptToCm(pt) {
  return (Number(pt) * 2.54) / 72
}

export function defaultQrPlacementBottomRight(cardWidthCm, cardHeightCm, qrSizeCm, marginCm) {
  const w = Number(cardWidthCm)
  const h = Number(cardHeightCm)
  const size = Number(qrSizeCm)
  const margin = Number(marginCm)
  return {
    qr_x_cm: Math.max(0, w - size - margin),
    qr_y_cm: Math.max(0, h - size - margin),
    qr_size_cm: size,
  }
}
