import AnnotationLeafButton from './AnnotationLeafButton.jsx'

function establishmentLabel(card) {
  const name = card?.notes?.trim()
  return name || 'Sem estabelecimento'
}

export default function ActivatedCardMobileList({ cards, onActivateCard, onAnnotationCard }) {
  if (!cards.length) {
    return null
  }

  return (
    <ul className="activated-mobile-card-list">
      {cards.map((card) => (
        <li key={card.id}>
          <div className="activated-mobile-card-item">
            <button
              type="button"
              className="activated-mobile-card-main"
              onClick={() => onActivateCard?.(card)}
            >
              <span className="activated-mobile-card-name">{establishmentLabel(card)}</span>
            </button>
            {onAnnotationCard && (
              <AnnotationLeafButton card={card} onClick={onAnnotationCard} />
            )}
          </div>
        </li>
      ))}
    </ul>
  )
}
