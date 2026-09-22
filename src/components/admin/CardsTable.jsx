function formatDate(value) {
  if (!value) return '—'
  return new Date(value).toLocaleString('pt-BR')
}

export default function CardsTable({ cards, onSelectCard }) {
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
            <th>Lote</th>
            <th>Observações</th>
            <th>Criado em</th>
            <th>Ativado em</th>
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
                <td>{formatDate(card.created_at)}</td>
                <td>{formatDate(card.activated_at)}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
