import { Link } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { ROLE_HOME } from '../../components/auth/RoleRoute'

export default function Unauthorized() {
  const { user } = useAuth()
  const home = user ? (ROLE_HOME[user.role] || '/login') : '/login'
  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'var(--bg-page)',
      gap: '1rem',
      padding: '2rem',
      textAlign: 'center',
    }}>
      <div style={{ fontSize: '4rem' }}>🚫</div>
      <h1 style={{ fontSize: 'var(--text-3xl)', fontWeight: 800, color: 'var(--text-primary)' }}>403 — Access Denied</h1>
      <p style={{ color: 'var(--text-secondary)', maxWidth: 400 }}>
        You don't have permission to access this page. If you believe this is an error, contact your administrator.
      </p>
      <Link to={home} className="btn btn-primary" style={{ marginTop: '0.5rem' }}>
        ← Go to Dashboard
      </Link>
    </div>
  )
}
