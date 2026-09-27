import { Navigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import Loading from '../ui/Loading'

const ROLE_HOME = {
  ADMIN: '/admin',
  DOCTOR: '/doctor',
  PATIENT: '/patient',
  LAB_TECHNICIAN: '/technician',
}

export default function RoleRoute({ role, children }) {
  const { user, loading } = useAuth()

  if (loading) return <Loading fullPage />

  if (!user) return <Navigate to="/login" replace />

  if (user.role !== role) {
    // Redirect to their own dashboard
    const home = ROLE_HOME[user.role] || '/login'
    return <Navigate to={home} replace />
  }

  return children
}

export { ROLE_HOME }
