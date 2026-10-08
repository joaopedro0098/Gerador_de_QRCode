import { createClient } from '@supabase/supabase-js'

function homeUrl(req) {
  const base = process.env.VITE_SHORT_BASE_URL?.trim()?.replace(/\/+$/, '')
  if (base) return `${base}/`
  const host = req.headers['x-forwarded-host'] || req.headers.host
  const proto = req.headers['x-forwarded-proto'] || 'https'
  return host ? `${proto}://${host}/` : '/'
}

function supabaseEnv() {
  const url = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  const anonKey =
    process.env.VITE_SUPABASE_ANON_KEY ||
    process.env.SUPABASE_ANON_KEY ||
    process.env.VITE_SUPABASE_KEY
  const key = serviceKey || anonKey
  if (!url || !key) return null
  return { url, key }
}

async function resolveTarget(supabase, code) {
  const { data: rpcData, error: rpcError } = await supabase.rpc('resolve_short_link', {
    p_code: code,
  })
  if (!rpcError && rpcData) {
    return { targetUrl: rpcData, lookupError: null }
  }

  const { data, error } = await supabase
    .from('short_links')
    .select('target_url, clicks')
    .eq('code', code)
    .maybeSingle()

  if (error || !data?.target_url) {
    return { targetUrl: null, lookupError: error ?? rpcError ?? null }
  }

  supabase
    .from('short_links')
    .update({ clicks: (data.clicks ?? 0) + 1 })
    .eq('code', code)
    .then(() => {})

  return { targetUrl: data.target_url, lookupError: null }
}

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.statusCode = 405
    res.end()
    return
  }

  const code = String(req.query.code ?? '').trim()
  if (!code) {
    res.writeHead(302, { Location: homeUrl(req) })
    res.end()
    return
  }

  const env = supabaseEnv()
  if (!env) {
    res.writeHead(302, { Location: homeUrl(req) })
    res.end()
    return
  }

  const supabase = createClient(env.url, env.key, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  const { targetUrl } = await resolveTarget(supabase, code)

  if (!targetUrl) {
    res.writeHead(302, { Location: homeUrl(req) })
    res.end()
    return
  }

  res.writeHead(302, { Location: targetUrl })
  res.end()
}
