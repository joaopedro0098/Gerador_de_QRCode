import { isCardActivated } from '../../utils/cardStatus.js'
import AnnotationLeafButton from './AnnotationLeafButton.jsx'

function formatDateOnly(value) {
  if (!value) return '—'
  return new Date(value).toLocaleDateString('pt-BR')
}

function formatDateTime(value) {
  if (!value) return '—'
  return new Date(value).toLocaleString('pt-BR')
}

export default function CardsTable({
  cards,
  onSelectCard,
  onActivateCard,
  onDeactivateCard,
  onPauseCard,
  onAnnotationCard,
  showLocationColumn = false,
  embedAnnotationIcon = false,
  hideRowActions = false,
  virginLayout = false,
}) {
  if (!cards.length) {
    return <p className="muted">Nenhum ID encontrado.</p>
  }

  const showActionsColumn = !hideRowActions
  const showAnnotationColumn = !embedAnnotationIcon && !virginLayout
  const showStatusColumn = !virginLayout
  const showCreatedAtColumn = !virginLayout

  return (
    <div className="table-wrap">
      <table className="data-table">
        <thead>
          <tr>
            {showAnnotationColumn && <th aria-label="Anotações" />}
            <th>ID</th>
            {showStatusColumn && <th>Status</th>}
            <th>Estabelecimento</th>
            {showLocationColumn && <th>Local</th>}
            {showCreatedAtColumn && <th>Criado em</th>}
            <th>Ativado em</th>
            {embedAnnotationIcon && <th className="cell-trailing-icon" aria-label="Anotações" />}
            {showActionsColumn && <th aria-hidden />}
          </tr>
        </thead>
        <tbody>
          {cards.map((card) => {
            const activated = isCardActivated(card)
            return (
              <tr key={card.id} className={card.paused ? 'row-paused' : undefined}>
                {showAnnotationColumn && (
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
                {showStatusColumn && (
                  <td>
                    <span className={`badge ${activated ? 'badge-ok' : 'badge-muted'}`}>
                      {activated ? (card.paused ? 'Pausado' : 'Ativado') : 'Virgem'}
                    </span>
                  </td>
                )}
                <td className="cell-notes">{card.notes || '—'}</td>
                {showLocationColumn && (
                  <td className="cell-notes">{card.location_path || '—'}</td>
                )}
                {showCreatedAtColumn && <td>{formatDateOnly(card.created_at)}</td>}
                <td>{formatDateTime(card.activated_at)}</td>
                {embedAnnotationIcon && (
                  <td className="cell-trailing-icon">
                    {activated ? (
                      <AnnotationLeafButton card={card} onClick={onAnnotationCard} />
                    ) : null}
                  </td>
                )}
                {showActionsColumn && (
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
                )}
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
