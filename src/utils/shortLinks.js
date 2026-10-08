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

function pgDebug(error, extra = {}) {
  if (!error) return { ...extra }
  return {
    ...extra,
    pgCode: error.code ?? null,
    pgMessage: error.message ?? null,
    details: error.details ?? null,
    hint: error.hint ?? null,
  }
}

async function syncCardShortCode(supabase, cardId, code) {
  return supabase.from('cards').update({ short_code: code }).eq('id', cardId).select('short_code').single()
}

/** Reutiliza linha em short_links já ligada a este card (índice único em card_id). */
async function ensureExistingRowForCard(supabase, cardId, target) {
  const { data: row, error: fetchError } = await supabase
    .from('short_links')
    .select('code')
    .eq('card_id', cardId)
    .maybeSingle()

  if (fetchError) {
    return {
      shortUrl: null,
      code: null,
      error: {
        message: 'Não foi possível carregar o link curto deste card.',
        debug: pgDebug(fetchError, { step: 'fetch_by_card_id' }),
      },
    }
  }

  if (!row?.code) {
    return null
  }

  const { data: updated, error: updateError } = await supabase
    .from('short_links')
    .update({ target_url: target })
    .eq('card_id', cardId)
    .select('code')
    .single()

  if (updateError || !updated?.code) {
    return {
      shortUrl: null,
      code: null,
      error: {
        message: 'Não foi possível atualizar o link curto. Tente novamente.',
        debug: pgDebug(updateError, { step: 'update_by_card_id', existingCode: row.code }),
      },
    }
  }

  const { error: cardError } = await syncCardShortCode(supabase, cardId, updated.code)
  if (cardError) {
    return {
      shortUrl: null,
      code: null,
      error: {
        message: 'Não foi possível associar o link curto ao card.',
        debug: pgDebug(cardError, { step: 'sync_short_code', code: updated.code }),
      },
    }
  }

  return {
    shortUrl: buildShortRedirectUrl(updated.code),
    code: updated.code,
    error: null,
  }
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
        error: {
          message: 'Não foi possível atualizar o link curto. Tente novamente.',
          debug: pgDebug(error, { step: 'update_by_code', reuseCode }),
        },
      }
    }

    if (data?.code) {
      return { shortUrl: buildShortRedirectUrl(data.code), code: data.code, error: null }
    }
  }

  const existingRow = await ensureExistingRowForCard(supabase, cardId, target)
  if (existingRow?.error || existingRow?.code) {
    return existingRow
  }

  let lastInsertError = null

  for (let attempt = 0; attempt < INSERT_MAX_ATTEMPTS; attempt++) {
    const code = generateShortCode()
    const { error: insertError } = await supabase.from('short_links').insert({
      code,
      target_url: target,
      card_id: cardId,
    })

    if (insertError) {
      lastInsertError = insertError
      if (isUniqueViolation(insertError)) {
        const recovered = await ensureExistingRowForCard(supabase, cardId, target)
        if (recovered?.code) {
          return recovered
        }
        if (recovered?.error) {
          return recovered
        }
        continue
      }
      return {
        shortUrl: null,
        code: null,
        error: {
          message: 'Não foi possível gerar o link curto. Tente novamente.',
          debug: pgDebug(insertError, { step: 'insert', attempt }),
        },
      }
    }

    const { data: cardRow, error: cardError } = await syncCardShortCode(supabase, cardId, code)

    if (cardError) {
      await supabase.from('short_links').delete().eq('code', code)
      return {
        shortUrl: null,
        code: null,
        error: {
          message: 'Não foi possível associar o link curto ao card.',
          debug: pgDebug(cardError, { step: 'sync_short_code', code, attempt }),
        },
      }
    }

    if (cardRow?.short_code) {
      return { shortUrl: buildShortRedirectUrl(code), code, error: null }
    }
  }

  return {
    shortUrl: null,
    code: null,
    error: {
      message: 'Não foi possível gerar um código único. Tente novamente.',
      debug: pgDebug(lastInsertError, {
        step: 'insert_exhausted',
        attempts: INSERT_MAX_ATTEMPTS,
        note: 'Colisões repetidas em code ou card_id; verifique short_links para este card.',
      }),
    },
  }
}

/** Promise repassada ao createNfcWriteSession (inicia no clique, sem await antes). */
export function createNfcShortUrlPromise(supabase, cardId, targetUrl, existingShortCode) {
  return ensureShortLinkForCard(supabase, cardId, targetUrl, existingShortCode).then(
    ({ shortUrl, error }) => {
      if (error) {
        const err = new Error(error.message)
        err.name = 'ShortLinkError'
        err.shortLinkDebug = error.debug ?? null
        throw err
      }
      return shortUrl
    },
  )
}
