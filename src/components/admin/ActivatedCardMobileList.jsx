export default function ActivatedCardMobileList({ cards, onOpenCard }) {
  if (!cards.length) {
    return null
  }

  return (
    <ul className="activated-explorer-card-list">
      {cards.map((card) => {
        const label = card.notes?.trim() || card.code
        return (
          <li key={card.id}>
            <button
              type="button"
              className="btn secondary small activated-explorer-card-btn"
              aria-label={label === card.code ? label : `${label} (${card.code})`}
              onClick={() => onOpenCard?.(card)}
            >
              {label}
            </button>
          </li>
        )
      })}
    </ul>
  )
}
