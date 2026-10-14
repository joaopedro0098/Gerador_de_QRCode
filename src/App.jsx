import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext.jsx'
import AdminLayout from './components/admin/AdminLayout.jsx'
import ProtectedRoute from './routes/ProtectedRoute.jsx'
import RootRedirect from './routes/RootRedirect.jsx'
import CardsListPage from './pages/admin/CardsListPage.jsx'
import LoginPage from './pages/admin/LoginPage.jsx'
import RedirectPage from './pages/public/RedirectPage.jsx'
import LinkUnavailablePage from './pages/public/LinkUnavailablePage.jsx'
import ShortRedirectPage from './pages/public/ShortRedirectPage.jsx'

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<RootRedirect />} />
          <Route path="/c/:codigo" element={<RedirectPage />} />
          <Route path="/r/:code" element={<ShortRedirectPage />} />
          <Route path="/api/redirect/:code" element={<ShortRedirectPage />} />
          <Route path="/link-indisponivel" element={<LinkUnavailablePage />} />
          <Route path="/admin/login" element={<LoginPage />} />
          <Route element={<ProtectedRoute />}>
            <Route path="/admin" element={<AdminLayout />}>
              <Route index element={<CardsListPage />} />
              <Route path="lote" element={<Navigate to="/admin?gerar=1" replace />} />
              <Route path="arte" element={<Navigate to="/admin" replace />} />
              <Route path="ativar/*" element={<Navigate to="/admin" replace />} />
            </Route>
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}
