const CODE_ALPHABET = 'abcdefghijklmnopqrstuvwxyz0123456789'
const CODE_MIN_LEN = 6
const CODE_MAX_LEN = 8
const INSERT_MAX_ATTEMPTS = 10

export function getShortBaseUrl() {
  const raw = String(import.meta.env.VITE_SHORT_BASE_URL ?? '').trim()
  if (!raw) {
    throw new Error('VITE_SHORT_BASE_URL não configurado.')
  }
  return raw.replace(/\/+$/, '')
}

export function buildShortRedirectUrl(code) {
  return `${getShortBaseUrl()}/r/${encodeURIComponent(code)}`
}

/** 6–8 caracteres [a-z0-9], síncrono. */
export function generateShortCode() {
  const length =
    CODE_MIN_LEN + Math.floor(Math.random() * (CODE_MAX_LEN - CODE_MIN_LEN + 1))
  const bytes = new Uint8Array(length)
  crypto.getRandomValues(bytes)
  let out = ''
  for (let i = 0; i < length; i++) {
    out += CODE_ALPHABET[bytes[i] % CODE_ALPHABET.length]
  }
  return out
}

function isUniqueViolation(error) {
  return error?.code === '23505'
}

/**
 * Cria ou atualiza short_link para o card. Reutiliza short_code existente.
 * @returns {{ shortUrl, code, error }}
 */
export async function ensureShortLinkForCard(supabase, cardId, targetUrl, existingShortCode = null) {
  const target = targetUrl.trim()
  if (!target) {
    return { shortUrl: null, code: null, error: { message: 'Informe o link de destino.' } }
  }

  try {
    getShortBaseUrl()
  } catch (e) {
    return { shortUrl: null, code: null, error: { message: e.message } }
  }

  const reuseCode = existingShortCode?.trim() || null

  if (reuseCode) {
    const { data, error } = await supabase
      .from('short_links')
      .update({ target_url: target })
      .eq('code', reuseCode)
      .eq('card_id', cardId)
      .select('code')
      .maybeSingle()

    if (error) {
      return {
        shortUrl: null,
        code: null,
        error: { message: 'Não foi possível atualizar o link curto. Tente novamente.' },
      }
    }

    if (data?.code) {
      return { shortUrl: buildShortRedirectUrl(data.code), code: data.code, error: null }
    }
  }

  for (let attempt = 0; attempt < INSERT_MAX_ATTEMPTS; attempt++) {
    const code = generateShortCode()
    const { error: insertError } = await supabase.from('short_links').insert({
      code,
      target_url: target,
      card_id: cardId,
    })

    if (insertError) {
      if (isUniqueViolation(insertError)) {
        continue
      }
      return {
        shortUrl: null,
        code: null,
        error: { message: 'Não foi possível gerar o link curto. Tente novamente.' },
      }
    }

    const { data: cardRow, error: cardError } = await supabase
      .from('cards')
      .update({ short_code: code })
      .eq('id', cardId)
      .select('short_code')
      .single()

    if (cardError) {
      await supabase.from('short_links').delete().eq('code', code)
      return {
        shortUrl: null,
        code: null,
        error: { message: 'Não foi possível associar o link curto ao card.' },
      }
    }

    if (cardRow?.short_code) {
      return { shortUrl: buildShortRedirectUrl(code), code, error: null }
    }
  }

  return {
    shortUrl: null,
    code: null,
    error: { message: 'Não foi possível gerar um código único. Tente novamente.' },
  }
}

/** Promise repassada ao createNfcWriteSession (inicia no clique, sem await antes). */
export function createNfcShortUrlPromise(supabase, cardId, targetUrl, existingShortCode) {
  return ensureShortLinkForCard(supabase, cardId, targetUrl, existingShortCode).then(
    ({ shortUrl, error }) => {
      if (error) {
        const err = new Error(error.message)
        err.name = 'ShortLinkError'
        throw err
      }
      return shortUrl
    },
  )
}
