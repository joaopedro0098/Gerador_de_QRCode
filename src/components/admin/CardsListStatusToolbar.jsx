import { memo } from 'react'

const STATUS_FILTERS = [
  { value: 'virgin', label: 'Virgens' },
  { value: 'stock', label: 'Estoque' },
  { value: 'activated', label: 'Ativados' },
]

function CardsListStatusToolbar({
  filter,
  searchInput,
  onSearchInputChange,
  onFilterChange,
  onAdicionarClick,
  onGerarClick,
  showActivatedExplorer,
}) {
  const isActivated = filter === 'activated'
  const isStock = filter === 'stock'
  const searchEnabled = isActivated || isStock

  return (
    <div className="toolbar toolbar-home toolbar-codes-top" data-filter={filter}>
      <div className="filter-group filter-group-status" role="tablist" aria-label="Filtrar por status">
        {STATUS_FILTERS.map((f) => (
          <button
            key={f.value}
            type="button"
            role="tab"
            aria-selected={filter === f.value}
            className={`btn secondary small toolbar-codes-tab ${filter === f.value ? 'active' : ''}`}
            onClick={() => onFilterChange(f.value)}
          >
            {f.label}
          </button>
        ))}
        {filter === 'virgin' && (
          <button
            type="button"
            className="btn secondary small toolbar-codes-gerar-mais"
            onClick={onGerarClick}
          >
            Gerar mais
          </button>
        )}
      </div>

      <div className="toolbar-codes-search" data-active={searchEnabled ? 'true' : 'false'}>
        <input
          type="search"
          className="toolbar-search"
          placeholder={
            isStock
              ? 'Buscar ID ou estabelecimento…'
              : 'Buscar ID, estabelecimento, cidade, distrito ou bairro…'
          }
          value={searchInput}
          onChange={(e) => onSearchInputChange(e.target.value)}
          aria-label="Buscar"
          tabIndex={searchEnabled ? 0 : -1}
          aria-hidden={!searchEnabled}
        />
      </div>

      <div className="toolbar-codes-trailing">
        <div
          className={`toolbar-codes-trailing-slot${showActivatedExplorer ? '' : ' toolbar-codes-trailing-slot--inactive'}`}
        >
          <button type="button" className="btn secondary small toolbar-codes-tab" onClick={onAdicionarClick}>
            Adicionar
          </button>
        </div>
      </div>
    </div>
  )
}

export default memo(CardsListStatusToolbar)
