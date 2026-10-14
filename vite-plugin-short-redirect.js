import { loadEnv } from 'vite'
import { createClient } from '@supabase/supabase-js'

function extractShortCode(pathname) {
  const m = String(pathname ?? '').match(/^\/(?:r|api\/redirect)\/([^/?#]+)/)
  return m ? decodeURIComponent(m[1]).trim() : ''
}

async function resolveTargetUrl(env, code) {
  const url = env.VITE_SUPABASE_URL
  const key =
    env.SUPABASE_SERVICE_ROLE_KEY ||
    env.VITE_SUPABASE_ANON_KEY ||
    env.VITE_SUPABASE_KEY
  if (!url || !key || !code) return null

  const supabase = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  const { data: rpcData, error: rpcError } = await supabase.rpc('resolve_short_link', {
    p_code: code,
  })
  if (!rpcError && rpcData) return rpcData

  const { data, error } = await supabase
    .from('short_links')
    .select('target_url')
    .eq('code', code)
    .maybeSingle()

  if (error || !data?.target_url) return null
  return data.target_url
}

function sendRedirect(res, location, status = 302) {
  res.statusCode = status
  res.setHeader('Location', location)
  res.setHeader('Cache-Control', 'no-store')
  res.end()
}

/** Dev: /r/:code e /api/redirect/:code respondem 302 como na Vercel. */
export function shortRedirectDevPlugin(mode) {
  const env = loadEnv(mode, process.cwd(), '')

  return {
    name: 'short-redirect-dev',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        if (req.method !== 'GET' && req.method !== 'HEAD') return next()

        const code = extractShortCode(req.url?.split('?')[0] ?? '')
        if (!code) return next()

        const home = '/'
        try {
          const target = await resolveTargetUrl(env, code)
          if (req.method === 'HEAD') {
            sendRedirect(res, target || home)
            return
          }
          sendRedirect(res, target || home)
        } catch {
          sendRedirect(res, home)
        }
      })
    },
  }
}
