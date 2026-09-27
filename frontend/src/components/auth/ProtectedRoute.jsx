import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import Loading from '../ui/Loading'

export default function ProtectedRoute({ children }) {
  const { user, loading } = useAuth()
  const location = useLocation()

  if (loading) return <Loading fullPage message="Authenticating…" />
  if (!user) return <Navigate to="/login" state={{ from: location }} replace />
  return children
}
