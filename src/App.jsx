import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext.jsx'
import AdminLayout from './components/admin/AdminLayout.jsx'
import ProtectedRoute from './routes/ProtectedRoute.jsx'
import RootRedirect from './routes/RootRedirect.jsx'
import BatchGeneratePage from './pages/admin/BatchGeneratePage.jsx'
import CardsListPage from './pages/admin/CardsListPage.jsx'
import LoginPage from './pages/admin/LoginPage.jsx'
import RedirectPage from './pages/public/RedirectPage.jsx'

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<RootRedirect />} />
          <Route path="/c/:codigo" element={<RedirectPage />} />
          <Route path="/admin/login" element={<LoginPage />} />
          <Route element={<ProtectedRoute />}>
            <Route path="/admin" element={<AdminLayout />}>
              <Route index element={<CardsListPage />} />
              <Route path="lote" element={<BatchGeneratePage />} />
              <Route path="ativar/*" element={<Navigate to="/admin" replace />} />
            </Route>
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}
