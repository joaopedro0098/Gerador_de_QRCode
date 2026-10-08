function formatDateOnly(value) {
  if (!value) return '—'
  return new Date(value).toLocaleDateString('pt-BR')
}

import { isCardActivated } from '../../utils/cardStatus.js'

function formatDateTime(value) {
  if (!value) return '—'
  return new Date(value).toLocaleString('pt-BR')
}

function LeafIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
      <path d="M6 3c6 8 10 12 16 14-2-6-6-10-14-16 1 4 2 8 0 12-4-2-8-4-12-2 4 6 8 10 10z" />
    </svg>
  )
}

export default function CardsTable({
  cards,
  onSelectCard,
  onActivateCard,
  onDeactivateCard,
  onPauseCard,
  onAnnotationCard,
  showLocationColumn = false,
}) {
  if (!cards.length) {
    return <p className="muted">Nenhum código encontrado.</p>
  }

  return (
    <div className="table-wrap">
      <table className="data-table">
        <thead>
          <tr>
            <th aria-label="Anotações" />
            <th>Código</th>
            <th>Status</th>
            <th>Estabelecimento</th>
            {showLocationColumn && <th>Local</th>}
            <th>Criado em</th>
            <th>Ativado em</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {cards.map((card) => {
            const activated = isCardActivated(card)
            return (
              <tr key={card.id} className={card.paused ? 'row-paused' : undefined}>
                <td className="cell-icon">
                  {activated ? (
                    <button
                      type="button"
                      className="btn-icon annotation-btn"
                      aria-label="Anotações"
                      title="Anotações"
                      onClick={() => onAnnotationCard?.(card)}
                    >
                      <LeafIcon />
                    </button>
                  ) : null}
                </td>
                <td>
                  <button type="button" className="link-button" onClick={() => onSelectCard(card)}>
                    {card.code}
                  </button>
                </td>
                <td>
                  <span className={`badge ${activated ? 'badge-ok' : 'badge-muted'}`}>
                    {activated ? (card.paused ? 'Pausado' : 'Ativado') : 'Virgem'}
                  </span>
                </td>
                <td className="cell-notes">{card.notes || '—'}</td>
                {showLocationColumn && (
                  <td className="cell-notes">{card.location_path || '—'}</td>
                )}
                <td>{formatDateOnly(card.created_at)}</td>
                <td>{formatDateTime(card.activated_at)}</td>
                <td className="cell-actions">
                  <div className="cell-actions-group">
                    <button
                      type="button"
                      className="btn secondary small"
                      onClick={() => onActivateCard(card)}
                    >
                      {activated ? 'Editar' : 'Ativar'}
                    </button>
                    {activated && (
                      <>
                        <button
                          type="button"
                          className="btn secondary small"
                          onClick={() => onPauseCard?.(card)}
                        >
                          {card.paused ? 'Retomar' : 'Pausar'}
                        </button>
                        <button
                          type="button"
                          className="btn secondary small danger"
                          onClick={() => onDeactivateCard(card)}
                        >
                          Desativar
                        </button>
                      </>
                    )}
                  </div>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
