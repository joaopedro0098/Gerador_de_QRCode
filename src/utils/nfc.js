const DEFAULT_SCAN_MS = 20000

export function isNfcSupported() {
  return typeof window !== 'undefined' && 'NDEFReader' in window
}

function mapNfcError(err) {
  const msg = String(err?.message ?? err ?? '').toLowerCase()
  if (err?.message === 'TIMEOUT') {
    return 'Aproxime a tag mais perto.'
  }
  if (msg.includes('timeout') || msg.includes('timed out')) {
    return 'Aproxime a tag mais perto.'
  }
  if (msg.includes('not allowed') || msg.includes('permission')) {
    return 'Permita o acesso à NFC nas configurações do Chrome.'
  }
  if (msg.includes('not supported') || msg.includes('ndefreader')) {
    return 'Use Chrome no Android para gravar NFC.'
  }
  return 'Não foi possível gravar a tag. Tente novamente.'
}

/**
 * Aguarda tag, lê serialNumber, grava URL NDEF.
 * @returns {Promise<string>} UID normalizado
 */
export async function scanAndWriteNfcUrl(url, { timeoutMs = DEFAULT_SCAN_MS } = {}) {
  if (!isNfcSupported()) {
    throw new Error('UNSUPPORTED')
  }

  const ndef = new NDEFReader()

  return new Promise((resolve, reject) => {
    const timer = window.setTimeout(() => {
      reject(new Error('TIMEOUT'))
    }, timeoutMs)

    ndef.onreadingerror = () => {
      window.clearTimeout(timer)
      reject(new Error('READ_ERROR'))
    }

    ndef.onreading = async (event) => {
      try {
        const uid = normalizeUid(event.serialNumber)
        await ndef.write({
          records: [{ recordType: 'url', data: url }],
        })
        window.clearTimeout(timer)
        resolve(uid)
      } catch (writeErr) {
        window.clearTimeout(timer)
        reject(writeErr)
      }
    }

    ndef.scan().catch((scanErr) => {
      window.clearTimeout(timer)
      reject(scanErr)
    })
  })
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
