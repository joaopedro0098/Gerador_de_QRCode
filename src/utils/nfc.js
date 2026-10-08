const DEFAULT_SCAN_MS = 20000

export function isNfcSupported() {
  return typeof window !== 'undefined' && 'NDEFReader' in window
}

function mapNfcError(err) {
  const name = String(err?.name ?? '')
  const msg = String(err?.message ?? err ?? '').toLowerCase()

  if (err?.message === 'TIMEOUT') {
    return 'Tempo esgotado. Encoste a tag no centro traseiro do celular e tente de novo.'
  }
  if (msg.includes('timeout') || msg.includes('timed out')) {
    return 'Tempo esgotado. Encoste a tag no centro traseiro do celular e tente de novo.'
  }
  if (err?.message === 'READ_ERROR') {
    return 'Tag incompatível ou sem NDEF. Use NTAG213/215/216 virgem ou outra tag gravável.'
  }
  if (name === 'NotAllowedError' || msg.includes('not allowed') || msg.includes('permission')) {
    return 'Permita NFC para este site no Chrome (ícone de cadeado → permissões).'
  }
  if (name === 'NotSupportedError' || msg.includes('not supported')) {
    return 'NFC desligado ou indisponível. Ative NFC nas configurações do Android e use Chrome.'
  }
  if (name === 'NotReadableError' || msg.includes('not readable')) {
    return 'Não deu para acessar a tag. Afaste e encoste de novo, sem capa grossa.'
  }
  if (name === 'InvalidStateError') {
    return 'Toque Salvar de novo e encoste a tag quando pedir (mantenha o Chrome aberto).'
  }
  if (name === 'NetworkError') {
    return 'A gravação foi interrompida. Mantenha a tag encostada e parada até concluir.'
  }
  if (name === 'AbortError') {
    return 'Gravação cancelada. Toque Salvar e encoste a tag de novo.'
  }
  if (msg.includes('ndefreader')) {
    return 'Use Chrome no Android, em HTTPS, com NFC ligado.'
  }
  return `Não foi possível gravar a tag. Afaste, encoste de novo ou teste outra tag NTAG. (código: ${err?.name || 'desconhecido'})`
}

/** Payload espelhado no console.error('[NFC write]', …) — debug temporário na UI. */
export function buildNfcWriteDiagnostic(err, event, url) {
  return {
    name: err?.name,
    message: err?.message,
    url,
    urlBytes: new TextEncoder().encode(url).length,
    isSecureContext: window.isSecureContext,
    serialNumber: event?.serialNumber,
    tagRecords: event?.message?.records?.length,
  }
}

/**
 * Inicia scan() no mesmo gesto do clique (obrigatório no Chrome).
 * Depois chame waitForWrite() — pode await outras coisas antes, desde que scan já tenha começado.
 */
export function createNfcWriteSession(url, { timeoutMs = DEFAULT_SCAN_MS } = {}) {
  if (!isNfcSupported()) {
    throw new Error('UNSUPPORTED')
  }

  const ndef = new NDEFReader()
  const message = {
    records: [{ recordType: 'url', data: url }],
  }

  let aborted = false
  let scanError = null
  let timer = null

  function stampNfcWriteDiagnostic(err, event) {
    const payload = buildNfcWriteDiagnostic(err, event, url)
    console.error('[NFC write]', payload)
    if (err && typeof err === 'object') {
      err.nfcWriteDiagnostic = payload
    }
    return payload
  }

  const scanPromise = ndef.scan().catch((err) => {
    stampNfcWriteDiagnostic(err, undefined)
    scanError = err
    throw err
  })

  const writePromise = new Promise((resolve, reject) => {
    timer = window.setTimeout(() => {
      const timeoutErr = new Error('TIMEOUT')
      stampNfcWriteDiagnostic(timeoutErr, undefined)
      reject(timeoutErr)
    }, timeoutMs)

    const fail = (err, event) => {
      stampNfcWriteDiagnostic(err, event)
      window.clearTimeout(timer)
      timer = null
      reject(err)
    }

    const succeed = (uid) => {
      window.clearTimeout(timer)
      timer = null
      resolve(uid)
    }

    ndef.addEventListener(
      'readingerror',
      (e) => {
        console.error('[NFC readingerror]', e)
        if (aborted) return
        const readErr = new Error('READ_ERROR')
        fail(readErr, e)
      },
      { once: true },
    )

    ndef.addEventListener(
      'reading',
      async (event) => {
        if (aborted) return
        try {
          await ndef.write(message, { overwrite: true })
          succeed(normalizeUid(event.serialNumber))
        } catch (writeErr) {
          fail(writeErr, event)
        }
      },
      { once: true },
    )
  })

  return {
    abort() {
      aborted = true
      if (timer != null) {
        window.clearTimeout(timer)
        timer = null
      }
    },
    async waitForWrite() {
      await scanPromise
      if (scanError) throw scanError
      return writePromise
    },
  }
}

/** @deprecated Prefer createNfcWriteSession from the click handler. */
export async function scanAndWriteNfcUrl(url, options) {
  const session = createNfcWriteSession(url, options)
  return session.waitForWrite()
}

export function normalizeUid(serialNumber) {
  if (serialNumber == null || serialNumber === '') return ''
  if (typeof serialNumber === 'string') return serialNumber.trim().toLowerCase()
  if (Array.isArray(serialNumber)) {
    return serialNumber.map((b) => Number(b).toString(16).padStart(2, '0')).join('')
  }
  return String(serialNumber).trim().toLowerCase()
}

export function getNfcUserMessage(err) {
  if (err?.message === 'UNSUPPORTED') {
    return 'Use Chrome no Android para gravar NFC.'
  }
  return mapNfcError(err)
}
