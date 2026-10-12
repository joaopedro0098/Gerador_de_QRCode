export default function ActivatedCardMobileList({ cards, onOpenCard }) {
  if (!cards.length) {
    return null
  }

  return (
    <ul className="activated-mobile-card-list">
      {cards.map((card) => (
        <li key={card.id}>
          <button
            type="button"
            className="activated-mobile-card-main activated-mobile-card-main--code"
            onClick={() => onOpenCard?.(card)}
          >
            <span className="activated-mobile-card-name">{card.code}</span>
          </button>
        </li>
      ))}
    </ul>
  )
}
