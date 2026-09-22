import BatchGenerateForm from '../../components/admin/BatchGenerateForm.jsx'

export default function BatchGeneratePage() {
  return (
    <div className="admin-page narrow">
      <header className="page-header">
        <h1>Gerar bairro</h1>
        <p className="muted">
          Cria códigos virgens no banco e baixa ZIP com SVGs para impressão.
        </p>
      </header>
      <BatchGenerateForm />
    </div>
  )
}
