/** Destino quando o link curto NFC não existe ou o redirect falhou (público, sem admin). */
export default function LinkUnavailablePage() {
  return (
    <div className="public-page">
      <div className="public-card">
        <h1>Link indisponível</h1>
        <p className="muted">Este endereço não está ativo ou não foi encontrado.</p>
      </div>
    </div>
  )
}
