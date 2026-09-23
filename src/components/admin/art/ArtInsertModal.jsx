import { useEffect, useState } from 'react'
import Modal from '../../ui/Modal.jsx'
import ArtVirginPreview from './ArtVirginPreview.jsx'
import { ART_VIRGIN_PDF_MAX } from '../../../lib/config.js'
import { supabase } from '../../../lib/supabase.js'
import { composeVirginCardPdf } from '../../../utils/artComposePdf.js'
import { downloadQrCodesZip } from '../../../utils/artZipDownload.js'
import { normalizeCode } from '../../../utils/codes.js'
import { escapeIlikePrefix, normalizeEstablishmentSearch } from '../../../utils/search.js'
import { cardPublicUrl, qrSvgForCode } from '../../../utils/qr.js'
import { downloadActiveQrPdf } from '../../../utils/qrPdfOnly.js'

const MODES = [
  { id: 'virgin', label: 'Virgem' },
  { id: 'active', label: 'Buscar QR ativo' },
]

export default function ArtInsertModal({ session, onClose }) {
  const [mode, setMode] = useState('virgin')
  const [virgins, setVirgins] = useState([])
  const [virginTotal, setVirginTotal] = useState(0)
  const [groupIndex, setGroupIndex] = useState(0)
  const [cardIndexInGroup, setCardIndexInGroup] = useState(0)
  const [virginLoading, setVirginLoading] = useState(true)
  const [singleCode, setSingleCode] = useState('')
  const [progress, setProgress] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const [warnTruncated, setWarnTruncated] = useState(false)

  const [searchInput, setSearchInput] = useState('')
  const [activeResults, setActiveResults] = useState([])
  const [activePick, setActivePick] = useState(null)
  const [activeQrSvg, setActiveQrSvg] = useState('')

  useEffect(() => {
    setVirginLoading(true)
    supabase
      .from('cards')
      .select('id, code', { count: 'exact' })
      .is('destination_url', null)
      .order('loja_num', { ascending: true })
      .limit(ART_VIRGIN_PDF_MAX)
      .then(({ data, count, error: err }) => {
        setVirginLoading(false)
        if (err) {
          setError(err.message)
          return
        }
        setVirgins(data ?? [])
        setVirginTotal(count ?? 0)
        setWarnTruncated((count ?? 0) > ART_VIRGIN_PDF_MAX)
      })
  }, [])

  const groupStart = groupIndex * 10
  const groupCards = virgins.slice(groupStart, groupStart + 10)
  const currentCard = groupCards[cardIndexInGroup] ?? null
  const groupCount = Math.max(1, Math.ceil(virgins.length / 10))

  useEffect(() => {
    if (!activePick?.code) {
      setActiveQrSvg('')
      return
    }
    qrSvgForCode(activePick.code).then(setActiveQrSvg)
  }, [activePick?.code])

  async function buildZipForCards(cards) {
    const entries = []
    for (let i = 0; i < cards.length; i++) {
      setProgress(`Gerando PDF ${i + 1} de ${cards.length}…`)
      const pdfBytes = await composeVirginCardPdf(session, cards[i].code)
      entries.push({ filename: `${cards[i].code}.pdf`, content: pdfBytes })
    }
    setProgress('Compactando ZIP…')
    await downloadQrCodesZip(entries)
  }

  async function handleDownloadAllVirgins() {
    setError(null)
    if (!virgins.length) {
      setError('Não há cards virgens.')
      return
    }
    setBusy(true)
    try {
      await buildZipForCards(virgins)
      setProgress('')
    } catch (e) {
      setError(e.message ?? 'Erro ao gerar PDFs.')
    } finally {
      setBusy(false)
      setProgress('')
    }
  }

  async function handleDownloadSingleVirgin() {
    setError(null)
    const code = normalizeCode(singleCode)
    if (!code) {
      setError('Informe o código.')
      return
    }
    const card = virgins.find((c) => c.code === code)
    let target = card
    if (!target) {
      const { data, error: err } = await supabase
        .from('cards')
        .select('id, code')
        .eq('code', code)
        .is('destination_url', null)
        .maybeSingle()
      if (err || !data) {
        setError(err?.message ?? 'Código virgem não encontrado.')
        return
      }
      target = data
    }
    setBusy(true)
    try {
      await buildZipForCards([target])
    } catch (e) {
      setError(e.message ?? 'Erro ao gerar PDF.')
    } finally {
      setBusy(false)
      setProgress('')
    }
  }

  function handleSearchActive() {
    setError(null)
    setActiveResults([])
    setActivePick(null)
    const term = normalizeEstablishmentSearch(searchInput)
    if (!term) {
      setError('Digite um termo para buscar.')
      return
    }
    const notesPrefix = escapeIlikePrefix(term)
    const codePrefix = escapeIlikePrefix(normalizeCode(term))
    supabase
      .from('cards')
      .select('id, code, notes, destination_url')
      .not('destination_url', 'is', null)
      .or(`notes.ilike.${notesPrefix}%,code.ilike.${codePrefix}%`)
      .order('loja_num', { ascending: true })
      .limit(20)
      .then(({ data, error: err }) => {
        if (err) {
          setError(err.message)
          return
        }
        setActiveResults(data ?? [])
        if (data?.length === 1) setActivePick(data[0])
      })
  }

  async function handleDownloadActive() {
    if (!activePick?.code) {
      setError('Selecione um card ativo.')
      return
    }
    setBusy(true)
    try {
      await downloadActiveQrPdf(activePick.code)
    } catch (e) {
      setError(e.message ?? 'Erro ao gerar PDF.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal open title="Inserir QR code" onClose={onClose} wide>
      <div className="filter-group art-insert-tabs">
        {MODES.map((m) => (
          <button
            key={m.id}
            type="button"
            className={`btn secondary small ${mode === m.id ? 'active' : ''}`}
            onClick={() => setMode(m.id)}
          >
            {m.label}
          </button>
        ))}
      </div>

      {mode === 'virgin' && (
        <div className="art-insert-virgin">
          {virginLoading && <p className="muted">Carregando virgens…</p>}
          {warnTruncated && !virginLoading && (
            <p className="form-hint">
              Serão gerados os primeiros {ART_VIRGIN_PDF_MAX} de {virginTotal} virgens disponíveis.
            </p>
          )}
          {!virginLoading && virgins.length === 0 && (
            <p className="muted">Nenhum card virgem.</p>
          )}
          {currentCard && (
            <>
              <ArtVirginPreview session={session} code={currentCard.code} />
              <p className="muted art-insert-nav">
                Card {cardIndexInGroup + 1} de {groupCards.length} (grupo {groupIndex + 1} de{' '}
                {groupCount}) · {groupStart + cardIndexInGroup + 1} de {virgins.length}
              </p>
              <div className="form-actions">
                <button
                  type="button"
                  className="btn secondary small"
                  disabled={groupIndex === 0 && cardIndexInGroup === 0}
                  onClick={() => {
                    if (cardIndexInGroup > 0) setCardIndexInGroup((i) => i - 1)
                    else if (groupIndex > 0) {
                      setGroupIndex((g) => g - 1)
                      setCardIndexInGroup(9)
                    }
                  }}
                >
                  Anterior
                </button>
                <button
                  type="button"
                  className="btn secondary small"
                  disabled={
                    groupIndex >= groupCount - 1 && cardIndexInGroup >= groupCards.length - 1
                  }
                  onClick={() => {
                    if (cardIndexInGroup < groupCards.length - 1) {
                      setCardIndexInGroup((i) => i + 1)
                    } else if (groupIndex < groupCount - 1) {
                      setGroupIndex((g) => g + 1)
                      setCardIndexInGroup(0)
                    }
                  }}
                >
                  Próximo
                </button>
              </div>
            </>
          )}
          <div className="art-download-block stack-form">
            <button
              type="button"
              className="btn primary"
              disabled={busy || !virgins.length}
              onClick={handleDownloadAllVirgins}
            >
              Baixar todos os virgens (ZIP)
            </button>
            <label>
              Baixar um código específico
              <input
                type="text"
                value={singleCode}
                onChange={(e) => setSingleCode(normalizeCode(e.target.value))}
                placeholder="loja1"
                maxLength={15}
              />
            </label>
            <button
              type="button"
              className="btn secondary"
              disabled={busy}
              onClick={handleDownloadSingleVirgin}
            >
              Baixar este (ZIP)
            </button>
          </div>
        </div>
      )}

      {mode === 'active' && (
        <div className="art-insert-active stack-form">
          <div className="search-form">
            <input
              type="search"
              placeholder="Estabelecimento ou código…"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
            />
            <button type="button" className="btn secondary" onClick={handleSearchActive}>
              Buscar
            </button>
          </div>
          {activeResults.length > 1 && (
            <ul className="art-active-list">
              {activeResults.map((c) => (
                <li key={c.id}>
                  <button
                    type="button"
                    className={`link-button ${activePick?.id === c.id ? 'active-pick' : ''}`}
                    onClick={() => setActivePick(c)}
                  >
                    {c.code}
                    {c.notes ? ` · ${c.notes}` : ''}
                  </button>
                </li>
              ))}
            </ul>
          )}
          {activePick && (
            <>
              <p className="form-hint">
                {activePick.code}
                {activePick.notes ? ` · ${activePick.notes}` : ''}
              </p>
              <p className="qr-modal-url muted">{cardPublicUrl(activePick.code)}</p>
              {activeQrSvg && (
                <div
                  className="qr-preview qr-preview-compact art-active-qr-only"
                  dangerouslySetInnerHTML={{ __html: activeQrSvg }}
                />
              )}
              <button type="button" className="btn primary" disabled={busy} onClick={handleDownloadActive}>
                Baixar PDF
              </button>
            </>
          )}
        </div>
      )}

      {progress && <p className="form-hint">{progress}</p>}
      {error && <p className="form-hint error">{error}</p>}
    </Modal>
  )
}
