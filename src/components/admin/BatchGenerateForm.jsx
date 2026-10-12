import { useCallback, useEffect, useState } from 'react'
import { BATCH_INSERT_CHUNK, BATCH_MAX, VIRGIN_POOL_MAX } from '../../lib/config.js'
import { supabase } from '../../lib/supabase.js'
import { nextSequentialLojaCodes } from '../../utils/codes.js'
import {
  fetchVirginPoolCount,
  virginSlotsAvailable,
} from '../../utils/virginPool.js'
import BatchGenerateLimitModal from './BatchGenerateLimitModal.jsx'

function chunkArray(arr, size) {
  const chunks = []
  for (let i = 0; i < arr.length; i += size) {
    chunks.push(arr.slice(i, i + size))
  }
  return chunks
}

export default function BatchGenerateForm({ active = true, onGenerated }) {
  const [quantity, setQuantity] = useState(50)
  const [loading, setLoading] = useState(false)
  const [progress, setProgress] = useState('')
  const [error, setError] = useState(null)
  const [result, setResult] = useState(null)
  const [virginCount, setVirginCount] = useState(null)
  const [limitModal, setLimitModal] = useState(null)

  const refreshVirginCount = useCallback(async () => {
    const { count, error: countError } = await fetchVirginPoolCount(supabase)
    if (!countError) {
      setVirginCount(count)
    }
  }, [])

  useEffect(() => {
    if (!active) return
    void refreshVirginCount()
  }, [active, refreshVirginCount])

  const slotsAvailable =
    virginCount != null ? virginSlotsAvailable(virginCount) : null

  async function runGenerate(n) {
    setLoading(true)
    setProgress('Reservando IDs sequenciais…')

    try {
      const { data: existingRows, error: fetchError } = await supabase
        .from('cards')
        .select('code')
        .like('code', 'loja%')

      if (fetchError) {
        throw new Error(fetchError.message)
      }

      const codes = nextSequentialLojaCodes(existingRows ?? [], n)
      const rows = codes.map((code) => ({ code }))

      for (const [index, chunk] of chunkArray(rows, BATCH_INSERT_CHUNK).entries()) {
        setProgress(`Salvando no banco (${index + 1})…`)
        const { error: insertError } = await supabase.from('cards').insert(chunk)
        if (insertError) {
          throw new Error(insertError.message)
        }
      }

      setResult(`${codes.length} QR codes virgens criados.`)
      await refreshVirginCount()
      onGenerated?.()
    } catch (err) {
      setError(err.message ?? 'Erro ao gerar.')
    } finally {
      setLoading(false)
      setProgress('')
    }
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError(null)
    setResult(null)

    const n = Number(quantity)
    if (!Number.isInteger(n) || n < 1 || n > BATCH_MAX) {
      setError(`Informe uma quantidade entre 1 e ${BATCH_MAX}.`)
      return
    }

    const { count, error: countError } = await fetchVirginPoolCount(supabase)
    if (countError) {
      setError(countError.message)
      return
    }
    setVirginCount(count)

    const available = virginSlotsAvailable(count)
    if (available <= 0) {
      setLimitModal({ mode: 'full' })
      return
    }
    if (n > available) {
      setLimitModal({ mode: 'partial', requested: n, available })
      return
    }

    await runGenerate(n)
  }

  async function confirmPartialGenerate() {
    if (!limitModal || limitModal.mode !== 'partial') return
    const n = limitModal.available
    setLimitModal(null)
    await runGenerate(n)
  }

  function closeLimitModal() {
    if (loading) return
    setLimitModal(null)
  }

  return (
    <>
      <form className="stack-form" onSubmit={handleSubmit}>
        <label>
          Quantidade (máx. {BATCH_MAX})
          <input
            type="number"
            min={1}
            max={BATCH_MAX}
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
            disabled={loading}
          />
        </label>

        <p className="form-hint muted">
          IDs sequenciais: loja01, loja02… loja09, loja10… (até 15 caracteres). Limite de{' '}
          {VIRGIN_POOL_MAX}{' '}
          virgens na lista.
          {slotsAvailable != null && (
            <>
              {' '}
              Disponível agora: {slotsAvailable}.
            </>
          )}
        </p>

        {progress && <p className="form-hint">{progress}</p>}
        {error && <p className="form-hint error">{error}</p>}
        {result && <p className="form-hint success">{result}</p>}

        <button type="submit" className="btn primary" disabled={loading}>
          {loading ? 'Processando…' : 'Gerar'}
        </button>
      </form>

      <BatchGenerateLimitModal
        open={Boolean(limitModal)}
        mode={limitModal?.mode ?? null}
        available={limitModal?.available ?? 0}
        busy={loading}
        onClose={closeLimitModal}
        onConfirmPartial={() => void confirmPartialGenerate()}
      />
    </>
  )
}
