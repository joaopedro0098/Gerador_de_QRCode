import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext.jsx'

export default function AdminLayout() {
  const { signOut } = useAuth()
  const navigate = useNavigate()

  async function handleSignOut() {
    await signOut()
    navigate('/admin/login', { replace: true })
  }

  return (
    <div className="admin-shell">
      <header className="admin-topbar">
        <div className="admin-brand">Cards QR · Admin</div>
        <nav className="admin-nav">
          <NavLink to="/admin" end>
            Códigos
          </NavLink>
          <NavLink to="/admin/lote">Gerar lote</NavLink>
          <NavLink to="/admin/ativar">Ativar</NavLink>
        </nav>
        <button type="button" className="btn secondary small" onClick={handleSignOut}>
          Sair
        </button>
      </header>
      <main className="admin-main">
        <Outlet />
      </main>
    </div>
  )
}
