import { createClient } from '@supabase/supabase-js'

function homeUrl(req) {
  const base = process.env.VITE_SHORT_BASE_URL?.trim()?.replace(/\/+$/, '')
  if (base) return `${base}/`
  const host = req.headers['x-forwarded-host'] || req.headers.host
  const proto = req.headers['x-forwarded-proto'] || 'https'
  return host ? `${proto}://${host}/` : '/'
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

  const url = process.env.VITE_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !serviceKey) {
    res.writeHead(302, { Location: homeUrl(req) })
    res.end()
    return
  }

  const supabase = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  const { data, error } = await supabase
    .from('short_links')
    .select('target_url, clicks')
    .eq('code', code)
    .maybeSingle()

  if (error || !data?.target_url) {
    res.writeHead(302, { Location: homeUrl(req) })
    res.end()
    return
  }

  supabase
    .from('short_links')
    .update({ clicks: (data.clicks ?? 0) + 1 })
    .eq('code', code)
    .then(() => {})

  res.writeHead(302, { Location: data.target_url })
  res.end()
}
