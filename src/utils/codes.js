import { CODE_CHARSET, CODE_LENGTH } from '../lib/config.js'

export function generateCode() {
  let code = ''
  const len = CODE_CHARSET.length
  const random = crypto.getRandomValues(new Uint32Array(CODE_LENGTH))
  for (let i = 0; i < CODE_LENGTH; i++) {
    code += CODE_CHARSET[random[i] % len]
  }
  return code
}

export function generateUniqueCodes(count) {
  const set = new Set()
  while (set.size < count) {
    set.add(generateCode())
  }
  return [...set]
}

export function normalizeCode(input) {
  return String(input ?? '')
    .trim()
    .toLowerCase()
}
