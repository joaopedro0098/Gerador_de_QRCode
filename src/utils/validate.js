export function isValidHttpsUrl(value) {
  const trimmed = String(value ?? '').trim()
  if (!trimmed) return false
  try {
    const url = new URL(trimmed)
    return url.protocol === 'https:'
  } catch {
    return false
  }
}
