import { memo } from 'react'
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

function CardsTable({
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
  activatedMinimalLayout = false,
  stockLayout = false,
  stockPickMode = false,
  stockPickSelectedIds = null,
  onToggleStockPick,
}) {
  if (!cards.length) {
    return <p className="muted">Nenhum ID encontrado.</p>
  }

  const showActionsColumn = !hideRowActions && !activatedMinimalLayout && !virginLayout
  const showAnnotationColumn =
    !embedAnnotationIcon && !virginLayout && !activatedMinimalLayout && (stockLayout || !hideRowActions)
  const showStatusColumn = stockLayout
  const showCreatedAtColumn = stockLayout
  const showEstablishmentColumn = stockLayout || (!virginLayout && !activatedMinimalLayout)
  const showActivatedAtColumn = stockLayout

  const pickSet = stockPickSelectedIds instanceof Set ? stockPickSelectedIds : null

  const tableColumnCount =
    1 +
    (stockPickMode ? 1 : 0) +
    (showAnnotationColumn ? 1 : 0) +
    (showStatusColumn ? 1 : 0) +
    (showEstablishmentColumn ? 1 : 0) +
    (showLocationColumn ? 1 : 0) +
    (showCreatedAtColumn ? 1 : 0) +
    (showActivatedAtColumn ? 1 : 0) +
    (embedAnnotationIcon ? 1 : 0) +
    (showActionsColumn ? 1 : 0)

  return (
    <div className="table-wrap">
      <table className="data-table">
        <thead>
          <tr>
            {stockPickMode && <th className="cell-pick" aria-label="Selecionar" />}
            {showAnnotationColumn && <th aria-label="Anotações" />}
            <th>ID</th>
            {showStatusColumn && <th>Status</th>}
            {showEstablishmentColumn && <th>Estabelecimento</th>}
            {showLocationColumn && <th>Local</th>}
            {showCreatedAtColumn && <th>Criado em</th>}
            {showActivatedAtColumn && <th>Ativado em</th>}
            {embedAnnotationIcon && <th className="cell-trailing-icon" aria-label="Anotações" />}
            {showActionsColumn && <th aria-hidden />}
          </tr>
        </thead>
        <tbody>
          {cards.map((card) => {
            const activated = isCardActivated(card)
            const picked = pickSet?.has(card.id)

            if (stockPickMode) {
              return (
                <tr key={card.id} className={card.paused ? 'row-paused' : undefined}>
                  <td colSpan={tableColumnCount} className="virgin-id-row-cell">
                    <button
                      type="button"
                      className="virgin-id-row-btn virgin-id-row-btn--pick"
                      aria-label={`Selecionar ${card.code}`}
                      onClick={() => onToggleStockPick?.(card.id)}
                    >
                      <input
                        type="checkbox"
                        className="stock-pick-checkbox"
                        checked={Boolean(picked)}
                        readOnly
                        tabIndex={-1}
                        aria-hidden="true"
                      />
                      <span className="virgin-id-row-label">{card.code}</span>
                    </button>
                  </td>
                </tr>
              )
            }

            return (
              <tr key={card.id} className={card.paused ? 'row-paused' : undefined}>
                {showAnnotationColumn && (
                  <td className="cell-icon">
                    {stockLayout || activated ? (
                      <AnnotationLeafButton
                        card={card}
                        onClick={onAnnotationCard}
                        className="annotation-btn"
                      />
                    ) : null}
                  </td>
                )}
                <td className={virginLayout ? 'virgin-id-row-cell' : undefined}>
                  {virginLayout ? (
                    <button
                      type="button"
                      className="virgin-id-row-btn"
                      onClick={() => onSelectCard(card)}
                    >
                      <span className="virgin-id-row-label">{card.code}</span>
                    </button>
                  ) : (
                    <button type="button" className="link-button" onClick={() => onSelectCard(card)}>
                      {card.code}
                    </button>
                  )}
                </td>
                {showStatusColumn && (
                  <td>
                    <span className={`badge ${activated ? 'badge-ok' : 'badge-muted'}`}>
                      {activated ? (card.paused ? 'Pausado' : 'Ativado') : 'No estoque'}
                    </span>
                  </td>
                )}
                {showEstablishmentColumn && (
                  <td className="cell-notes">{card.notes || '—'}</td>
                )}
                {showLocationColumn && (
                  <td className="cell-notes">{card.location_path || '—'}</td>
                )}
                {showCreatedAtColumn && <td>{formatDateOnly(card.created_at)}</td>}
                {showActivatedAtColumn && <td>{formatDateTime(card.activated_at)}</td>}
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

export default memo(CardsTable)
