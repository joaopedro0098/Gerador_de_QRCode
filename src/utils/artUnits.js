/** 1 cm em pontos PDF (72 pt = 1 polegada, 2,54 cm = 1 polegada). */
export function cmToPt(cm) {
  return (Number(cm) * 72) / 2.54
}

export function ptToCm(pt) {
  return (Number(pt) * 2.54) / 72
}

/** Posição/tamanho da arte no cartão (cm); padrão = página inteira. */
export function resolveArtRectCm(session) {
  const cw = Number(session.card_width_cm)
  const ch = Number(session.card_height_cm)
  if (session.art_width_cm != null && session.art_height_cm != null) {
    return {
      art_x_cm: Number(session.art_x_cm ?? 0),
      art_y_cm: Number(session.art_y_cm ?? 0),
      art_width_cm: Number(session.art_width_cm),
      art_height_cm: Number(session.art_height_cm),
    }
  }
  return {
    art_x_cm: 0,
    art_y_cm: 0,
    art_width_cm: cw,
    art_height_cm: ch,
  }
}

export function defaultArtFillRect(cardWidthCm, cardHeightCm) {
  return {
    art_x_cm: 0,
    art_y_cm: 0,
    art_width_cm: Number(cardWidthCm),
    art_height_cm: Number(cardHeightCm),
  }
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
