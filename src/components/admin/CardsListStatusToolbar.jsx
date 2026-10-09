import { memo } from 'react'
import { Link } from 'react-router-dom'

const STATUS_FILTERS = [
  { value: 'virgin', label: 'Virgens' },
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
      </div>

      <div className="toolbar-codes-search" data-active={isActivated ? 'true' : 'false'}>
        <input
          type="search"
          className="toolbar-search"
          placeholder="Buscar ID, estabelecimento, cidade, distrito ou bairro…"
          value={searchInput}
          onChange={(e) => onSearchInputChange(e.target.value)}
          aria-label="Buscar"
          tabIndex={isActivated ? 0 : -1}
          aria-hidden={!isActivated}
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
        <div
          className={`toolbar-codes-trailing-slot toolbar-codes-trailing-slot--virgin${
            !isActivated ? '' : ' toolbar-codes-trailing-slot--inactive'
          }`}
        >
          <button type="button" className="btn secondary small" onClick={onGerarClick}>
            Gerar mais
          </button>
          <Link to="/admin/arte" className="btn secondary small">
            Upload
          </Link>
        </div>
      </div>
    </div>
  )
}

export default memo(CardsListStatusToolbar)
