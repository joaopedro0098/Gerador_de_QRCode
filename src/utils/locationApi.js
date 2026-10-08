import { supabase } from '../lib/supabase.js'
import { applyActivatedCardsFilter } from './cardStatus.js'
import { escapeIlikePrefix } from './search.js'

export const LOCATION_LEVELS = ['estado', 'cidade', 'distrito', 'bairro']

export const LOCATION_LEVEL_LABEL = {
  estado: 'Estado',
  cidade: 'Cidade',
  distrito: 'Distrito',
  bairro: 'Bairro',
}

export const CHILD_LEVEL = {
  estado: 'cidade',
  cidade: 'distrito',
  distrito: 'bairro',
}

export const PARENT_LEVEL = {
  cidade: 'estado',
  distrito: 'cidade',
  bairro: 'distrito',
}

const NODE_FIELDS = 'id, parent_id, level, name, created_at'

export async function listLocationChildren(parentId, level) {
  let query = supabase.from('location_nodes').select(NODE_FIELDS).eq('level', level).order('name')
  if (parentId) {
    query = query.eq('parent_id', parentId)
  } else {
    query = query.is('parent_id', null)
  }
  return query
}

export async function searchBairrosByPrefix(term, limit = 12) {
  const prefix = escapeIlikePrefix(term.trim())
  if (!prefix) return { data: [], error: null }

  const { data: bairros, error } = await supabase
    .from('location_nodes')
    .select(NODE_FIELDS)
    .eq('level', 'bairro')
    .ilike('name', `${prefix}%`)
    .order('name')
    .limit(limit)

  if (error || !bairros?.length) return { data: [], error }

  const enriched = await Promise.all(
    bairros.map(async (b) => {
      const { data: path } = await supabase.rpc('location_path_labels', { p_bairro_id: b.id })
      return { ...b, pathLabel: path ?? b.name }
    }),
  )

  return { data: enriched, error: null }
}

export async function createLocationNode({ level, parentId, name }) {
  const trimmed = name.trim()
  if (!trimmed) {
    return { data: null, error: { message: 'Informe um nome.' } }
  }
  return supabase
    .from('location_nodes')
    .insert({
      level,
      parent_id: parentId ?? null,
      name: trimmed,
    })
    .select(NODE_FIELDS)
    .single()
}

export async function updateLocationNode(id, name) {
  const trimmed = name.trim()
  if (!trimmed) {
    return { data: null, error: { message: 'Informe um nome.' } }
  }
  return supabase.from('location_nodes').update({ name: trimmed }).eq('id', id).select(NODE_FIELDS).single()
}

export async function locationHasActiveCards(nodeId) {
  const { data, error } = await supabase.rpc('location_has_active_cards', { p_node_id: nodeId })
  if (error) return { hasActive: true, error }
  return { hasActive: Boolean(data), error: null }
}

export async function deleteLocationNode(nodeId) {
  const { hasActive, error: checkError } = await locationHasActiveCards(nodeId)
  if (checkError) return { error: checkError }
  if (hasActive) {
    return { error: { message: 'Não é possível excluir: há QR codes ativos nesta pasta ou abaixo dela.' } }
  }

  const { count, error: childError } = await supabase
    .from('location_nodes')
    .select('id', { count: 'exact', head: true })
    .eq('parent_id', nodeId)

  if (childError) return { error: childError }
  if (count > 0) {
    return { error: { message: 'Exclua primeiro as pastas internas (sem QR ativos).' } }
  }

  return supabase.from('location_nodes').delete().eq('id', nodeId)
}

export async function getLocationPathLabels(bairroId) {
  return supabase.rpc('location_path_labels', { p_bairro_id: bairroId })
}

export async function searchActivatedCards(term) {
  return supabase.rpc('search_activated_cards', { p_search: term, p_limit: 500 })
}

export async function listActivatedCardsInBairro(bairroId) {
  let query = supabase
    .from('cards')
    .select(
      'id, code, destination_url, activated_at, created_at, notes, nfc_url, nfc_uid, location_bairro_id, paused, annotation',
    )
    .eq('location_bairro_id', bairroId)
    .order('loja_num', { ascending: true })
  query = applyActivatedCardsFilter(query)
  return query
}

/** Quantos QR/NFC ativos existem em cada bairro (location_bairro_id). */
export async function fetchActiveCardCountByBairroId() {
  let query = supabase.from('cards').select('location_bairro_id').not('location_bairro_id', 'is', null)
  query = applyActivatedCardsFilter(query)
  const { data, error } = await query
  if (error) return { map: new Map(), error }

  const map = new Map()
  for (const row of data ?? []) {
    const id = row.location_bairro_id
    map.set(id, (map.get(id) ?? 0) + 1)
  }
  return { map, error: null }
}

/** Soma cards ativos na subárvore de cada nó de localização. */
export function buildSubtreeActiveCounts(nodes, bairroCounts) {
  const childrenByParent = new Map()
  for (const n of nodes) {
    if (!n.parent_id) continue
    const list = childrenByParent.get(n.parent_id) ?? []
    list.push(n.id)
    childrenByParent.set(n.parent_id, list)
  }

  const memo = new Map()
  function countNode(id) {
    if (memo.has(id)) return memo.get(id)
    let sum = bairroCounts.get(id) ?? 0
    for (const childId of childrenByParent.get(id) ?? []) {
      sum += countNode(childId)
    }
    memo.set(id, sum)
    return sum
  }

  for (const n of nodes) {
    countNode(n.id)
  }
  return memo
}

export async function fetchLocationSubtreeActiveCounts() {
  const [{ data: nodes, error: nodesError }, { map: bairroCounts, error: countsError }] =
    await Promise.all([
      supabase.from('location_nodes').select('id, parent_id'),
      fetchActiveCardCountByBairroId(),
    ])
  if (nodesError) return { counts: new Map(), error: nodesError }
  if (countsError) return { counts: new Map(), error: countsError }
  return {
    counts: buildSubtreeActiveCounts(nodes ?? [], bairroCounts),
    error: null,
  }
}

async function findChildNode(level, parentId, label) {
  const trimmed = label.trim()
  const { data: siblings, error } = await listLocationChildren(parentId, level)
  if (error) throw error
  const lower = trimmed.toLowerCase()
  return siblings?.find((n) => n.name.trim().toLowerCase() === lower) ?? null
}

/** Cria ou reutiliza nós até o bairro (para fluxo de ativação). */
export async function ensureLocationPath({ estado, cidade, distrito, bairro }) {
  async function upsertChild(level, parentId, label) {
    const trimmed = label.trim()
    if (!trimmed) throw new Error(`Informe ${LOCATION_LEVEL_LABEL[level]}.`)

    const existing = await findChildNode(level, parentId, trimmed)
    if (existing) return existing

    const { data, error } = await createLocationNode({ level, parentId, name: trimmed })
    if (error) throw error
    return data
  }

  const estadoNode = await upsertChild('estado', null, estado)
  const cidadeNode = await upsertChild('cidade', estadoNode.id, cidade)
  const distritoNode = await upsertChild('distrito', cidadeNode.id, distrito)
  const bairroNode = await upsertChild('bairro', distritoNode.id, bairro)
  return bairroNode
}
