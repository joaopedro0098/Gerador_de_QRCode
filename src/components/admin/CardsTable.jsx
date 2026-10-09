function formatDateOnly(value) {
  if (!value) return '—'
  return new Date(value).toLocaleDateString('pt-BR')
}

import { isCardActivated } from '../../utils/cardStatus.js'

function formatDateTime(value) {
  if (!value) return '—'
  return new Date(value).toLocaleString('pt-BR')
}

import AnnotationLeafButton from './AnnotationLeafButton.jsx'

export default function CardsTable({
  cards,
  onSelectCard,
  onActivateCard,
  onDeactivateCard,
  onPauseCard,
  onAnnotationCard,
  showLocationColumn = false,
  hideCodeColumnHeader = false,
  embedAnnotationIcon = false,
}) {
  if (!cards.length) {
    return <p className="muted">Nenhum código encontrado.</p>
  }

  return (
    <div className="table-wrap">
      <table className="data-table">
        <thead>
          <tr>
            {!embedAnnotationIcon && <th aria-label="Anotações" />}
            <th>{hideCodeColumnHeader ? '' : 'Código'}</th>
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
                {!embedAnnotationIcon && (
                  <td className="cell-icon">
                    {activated ? (
                      <AnnotationLeafButton
                        card={card}
                        onClick={onAnnotationCard}
                        className="annotation-btn"
                      />
                    ) : null}
                  </td>
                )}
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
                <td className={`cell-notes${embedAnnotationIcon && activated ? ' cell-notes-with-annotation' : ''}`}>
                  {embedAnnotationIcon && activated ? (
                    <span className="cell-notes-annotation-row">
                      <span className="cell-notes-text">{card.notes || '—'}</span>
                      <AnnotationLeafButton card={card} onClick={onAnnotationCard} />
                    </span>
                  ) : (
                    card.notes || '—'
                  )}
                </td>
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
