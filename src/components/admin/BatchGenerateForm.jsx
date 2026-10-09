import { useState } from 'react'
import { BATCH_INSERT_CHUNK, BATCH_MAX } from '../../lib/config.js'
import { supabase } from '../../lib/supabase.js'
import { nextSequentialLojaCodes } from '../../utils/codes.js'

function chunkArray(arr, size) {
  const chunks = []
  for (let i = 0; i < arr.length; i += size) {
    chunks.push(arr.slice(i, i + size))
  }
  return chunks
}

export default function BatchGenerateForm() {
  const [quantity, setQuantity] = useState(50)
  const [loading, setLoading] = useState(false)
  const [progress, setProgress] = useState('')
  const [error, setError] = useState(null)
  const [result, setResult] = useState(null)

  async function handleSubmit(e) {
    e.preventDefault()
    setError(null)
    setResult(null)

    const n = Number(quantity)
    if (!Number.isInteger(n) || n < 1 || n > BATCH_MAX) {
      setError(`Informe uma quantidade entre 1 e ${BATCH_MAX}.`)
      return
    }

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
    } catch (err) {
      setError(err.message ?? 'Erro ao gerar.')
    } finally {
      setLoading(false)
      setProgress('')
    }
  }

  return (
    <form className="stack-form" onSubmit={handleSubmit}>
      <label>
        Quantidade (máx. {BATCH_MAX})
        <input
          type="number"
          min={1}
          max={BATCH_MAX}
          value={quantity}
          onChange={(e) => setQuantity(e.target.value)}
        />
      </label>

      <p className="form-hint muted">
        IDs sequenciais: loja1, loja2, loja3… (até 15 caracteres). Apenas cria cards virgens no
        sistema.
      </p>

      {progress && <p className="form-hint">{progress}</p>}
      {error && <p className="form-hint error">{error}</p>}
      {result && <p className="form-hint success">{result}</p>}

      <button type="submit" className="btn primary" disabled={loading}>
        {loading ? 'Processando…' : 'Gerar'}
      </button>
    </form>
  )
}
