export function normalizeEstablishmentSearch(value) {
  return String(value ?? '').trim()
}

/** Escapa %, _ e \\ para uso em filtros ILIKE com prefixo. */
export function escapeIlikePrefix(value) {
  return normalizeEstablishmentSearch(value).replace(/\\/g, '\\\\').replace(/%/g, '\\%').replace(/_/g, '\\_')
}
