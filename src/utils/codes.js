import { CODE_MAX_LENGTH, CODE_PREFIX } from '../lib/config.js'

const LOJA_CODE_RE = /^loja[0-9]+$/

export function normalizeCode(input) {
  return String(input ?? '')
    .trim()
    .toLowerCase()
}

export function isLojaCode(value) {
  const code = normalizeCode(value)
  return LOJA_CODE_RE.test(code) && code.length <= CODE_MAX_LENGTH
}

export function formatLojaCode(number) {
  const n = Number(number)
  if (!Number.isInteger(n) || n < 1) {
    throw new Error('Número de loja inválido.')
  }
  const code = `${CODE_PREFIX}${n}`
  if (code.length > CODE_MAX_LENGTH) {
    throw new Error(`Código "${code}" excede ${CODE_MAX_LENGTH} caracteres.`)
  }
  return code
}

export function parseLojaNumber(code) {
  const normalized = normalizeCode(code)
  const match = normalized.match(/^loja([0-9]+)$/)
  if (!match) return null
  return parseInt(match[1], 10)
}

export function maxLojaNumberFromCodes(codes) {
  let max = 0
  for (const raw of codes) {
    const n = parseLojaNumber(typeof raw === 'string' ? raw : raw?.code)
    if (n !== null && n > max) max = n
  }
  return max
}

/** Próximos `count` códigos sequenciais após o maior `lojaN` já usado. */
export function nextSequentialLojaCodes(existingCodes, count) {
  let start = maxLojaNumberFromCodes(existingCodes) + 1
  const result = []
  for (let i = 0; i < count; i++) {
    result.push(formatLojaCode(start + i))
  }
  return result
}
