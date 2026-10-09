export function LeafIcon({ className }) {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      className={className}
      aria-hidden
    >
      <path d="M6 3c6 8 10 12 16 14-2-6-6-10-14-16 1 4 2 8 0 12-4-2-8-4-12-2 4 6 8 10 10z" />
    </svg>
  )
}

export default function AnnotationLeafButton({ card, onClick, className = '' }) {
  return (
    <button
      type="button"
      className={`btn-icon annotation-leaf-btn ${className}`.trim()}
      aria-label="Anotações"
      title="Anotações"
      onClick={(e) => {
        e.stopPropagation()
        onClick?.(card)
      }}
    >
      <LeafIcon />
    </button>
  )
}
