import { memo, useState } from 'react'
import GeneratePlaceLinkModal from './GeneratePlaceLinkModal.jsx'
import { PLACE_ID_FINDER_URL } from '../../utils/placeIdLink.js'

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
  onStockCadastrarClick,
  showActivatedExplorer,
}) {
  const isActivated = filter === 'activated'
  const isStock = filter === 'stock'
  const searchEnabled = isActivated || isStock
  const [placeLinkOpen, setPlaceLinkOpen] = useState(false)

  return (
    <div className="toolbar toolbar-home toolbar-codes-top" data-filter={filter}>
      <div className="filter-group filter-group-status">
        <div className="toolbar-codes-status-tabs" role="tablist" aria-label="Filtrar por status">
          {STATUS_FILTERS.map((f) => (
            <button
              key={f.value}
              type="button"
              role="tab"
              aria-selected={filter === f.value}
              className={`btn secondary small toolbar-codes-tab toolbar-codes-status-tab ${filter === f.value ? 'active' : ''}`}
              onClick={() => onFilterChange(f.value)}
            >
              {f.label}
            </button>
          ))}
        </div>
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
        {isStock && (
          <div className="toolbar-codes-stock-actions">
            <a
              href={PLACE_ID_FINDER_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="btn secondary small toolbar-codes-tab toolbar-codes-external-link"
            >
              Place ID
            </a>
            <div className="toolbar-codes-stock-actions-stack">
              <button
                type="button"
                className="btn secondary small toolbar-codes-tab"
                onClick={() => setPlaceLinkOpen(true)}
              >
                Gerar link
              </button>
              <button
                type="button"
                className="btn secondary small toolbar-codes-tab"
                onClick={onStockCadastrarClick}
              >
                Cadastrar
              </button>
            </div>
          </div>
        )}
        <div
          className={`toolbar-codes-trailing-slot${showActivatedExplorer ? '' : ' toolbar-codes-trailing-slot--inactive'}`}
        >
          <button type="button" className="btn secondary small toolbar-codes-tab" onClick={onAdicionarClick}>
            Adicionar
          </button>
        </div>
      </div>

      <GeneratePlaceLinkModal open={placeLinkOpen} onClose={() => setPlaceLinkOpen(false)} />
    </div>
  )
}

export default memo(CardsListStatusToolbar)
