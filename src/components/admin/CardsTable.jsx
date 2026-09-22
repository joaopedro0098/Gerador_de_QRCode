function formatDateOnly(value) {
  if (!value) return '—'
  return new Date(value).toLocaleDateString('pt-BR')
}

function formatDateTime(value) {
  if (!value) return '—'
  return new Date(value).toLocaleString('pt-BR')
}

export default function CardsTable({ cards, onSelectCard, onActivateCard, onDeactivateCard }) {
  if (!cards.length) {
    return <p className="muted">Nenhum código encontrado.</p>
  }

  return (
    <div className="table-wrap">
      <table className="data-table">
        <thead>
          <tr>
            <th>Código</th>
            <th>Status</th>
            <th>Bairro</th>
            <th>Estabelecimento</th>
            <th>Criado em</th>
            <th>Ativado em</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {cards.map((card) => {
            const activated = Boolean(card.destination_url)
            return (
              <tr key={card.id}>
                <td>
                  <button
                    type="button"
                    className="link-button"
                    onClick={() => onSelectCard(card)}
                  >
                    {card.code}
                  </button>
                </td>
                <td>
                  <span className={`badge ${activated ? 'badge-ok' : 'badge-muted'}`}>
                    {activated ? 'Ativado' : 'Virgem'}
                  </span>
                </td>
                <td>{card.batch_label || '—'}</td>
                <td className="cell-notes">{card.notes || '—'}</td>
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
                      <button
                        type="button"
                        className="btn secondary small danger"
                        onClick={() => onDeactivateCard(card)}
                      >
                        Desativar
                      </button>
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
