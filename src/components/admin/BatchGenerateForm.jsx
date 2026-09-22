import { useState } from 'react'
import { BATCH_INSERT_CHUNK, BATCH_MAX } from '../../lib/config.js'
import { supabase } from '../../lib/supabase.js'
import { nextSequentialLojaCodes } from '../../utils/codes.js'
import { downloadSvgZip } from '../../utils/download.js'
import { cardPublicUrl, qrSvgForCode } from '../../utils/qr.js'

function chunkArray(arr, size) {
  const chunks = []
  for (let i = 0; i < arr.length; i += size) {
    chunks.push(arr.slice(i, i + size))
  }
  return chunks
}

export default function BatchGenerateForm() {
  const [quantity, setQuantity] = useState(50)
  const [batchLabel, setBatchLabel] = useState('')
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
    setProgress('Gerando códigos…')

    try {
      setProgress('Reservando códigos sequenciais…')
      const { data: existingRows, error: fetchError } = await supabase
        .from('cards')
        .select('code')
        .like('code', 'loja%')

      if (fetchError) {
        throw new Error(fetchError.message)
      }

      const codes = nextSequentialLojaCodes(existingRows ?? [], n)
      const label = batchLabel.trim() || null
      const rows = codes.map((code) => ({
        code,
        batch_label: label,
      }))

      for (const [index, chunk] of chunkArray(rows, BATCH_INSERT_CHUNK).entries()) {
        setProgress(`Salvando no banco (${index + 1})…`)
        const { error: insertError } = await supabase.from('cards').insert(chunk)
        if (insertError) {
          throw new Error(insertError.message)
        }
      }

      setProgress('Gerando QR codes…')
      const zipEntries = []
      const csvLines = ['code,status,url']

      for (let i = 0; i < codes.length; i++) {
        const code = codes[i]
        if (i % 25 === 0) {
          setProgress(`Gerando SVG ${i + 1} de ${codes.length}…`)
        }
        const svg = await qrSvgForCode(code)
        zipEntries.push({ filename: `${code}.svg`, content: svg })
        const url = cardPublicUrl(code)
        csvLines.push(`${code},virgem,${url}`)
      }

      zipEntries.push({
        filename: 'codigos.csv',
        content: csvLines.join('\n'),
      })

      const zipName = label
        ? `bairro-${label}-${codes.length}.zip`
        : `bairro-${new Date().toISOString().slice(0, 10)}-${codes.length}.zip`

      setProgress('Preparando download…')
      await downloadSvgZip(zipEntries, zipName)

      setResult(`${codes.length} códigos criados e ZIP baixado.`)
    } catch (err) {
      setError(err.message ?? 'Erro ao gerar bairro.')
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

      <label>
        Bairro (opcional)
        <input
          type="text"
          value={batchLabel}
          onChange={(e) => setBatchLabel(e.target.value)}
          placeholder="Ex.: Centro, Jardins…"
        />
      </label>

      <p className="form-hint muted">
        Códigos sequenciais: loja1, loja2, loja3… (até 15 caracteres). ZIP com SVG por
        código e CSV (código, status, URL pública).
      </p>

      {progress && <p className="form-hint">{progress}</p>}
      {error && <p className="form-hint error">{error}</p>}
      {result && <p className="form-hint success">{result}</p>}

      <button type="submit" className="btn primary" disabled={loading}>
        {loading ? 'Processando…' : 'Gerar bairro e baixar ZIP'}
      </button>
    </form>
  )
}
