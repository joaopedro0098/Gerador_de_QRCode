import { useParams } from 'react-router-dom'
import ActivateForm from '../../components/admin/ActivateForm.jsx'
import { normalizeCode } from '../../utils/codes.js'

export default function ActivatePage() {
  const { codigo } = useParams()
  const initialCode = codigo ? normalizeCode(codigo) : ''

  return (
    <div className="admin-page narrow">
      <header className="page-header">
        <h1>{initialCode ? `Ativar · ${initialCode}` : 'Ativar card'}</h1>
        <p className="muted">
          Cole o link HTTPS da página de avaliação do Google Meu Negócio.
        </p>
      </header>
      <ActivateForm initialCode={initialCode} />
    </div>
  )
}
