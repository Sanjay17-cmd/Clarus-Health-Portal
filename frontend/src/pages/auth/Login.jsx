import { useState } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { useToast } from '../../components/ui/Toast'
import Input from '../../components/ui/Input'
import Button from '../../components/ui/Button'
import ThemeSwitcher from '../../components/ui/ThemeSwitcher'
import { ROLE_HOME } from '../../components/auth/RoleRoute'

export default function Login() {
  const { login } = useAuth()
  const toast = useToast()
  const navigate = useNavigate()
  const location = useLocation()

  const [form, setForm] = useState({ email: '', password: '' })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const from = location.state?.from?.pathname || null

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const user = await login(form.email, form.password)
      toast.success('Welcome back!', `Logged in as ${user.name}`)
      const dest = from || ROLE_HOME[user.role] || '/'
      navigate(dest, { replace: true })
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.5rem' }}>
          <div className="auth-logo">
            <div className="auth-logo__mark">🏥</div>
            <div>
              <div className="auth-logo__name">Clarus Health</div>
              <div className="auth-logo__tagline">Medical Portal</div>
            </div>
          </div>
          <ThemeSwitcher />
        </div>

        <h1 className="auth-title">Sign In</h1>
        <p className="auth-subtitle">Access your secure health portal account</p>

        {error && (
          <div className="alert alert-error" style={{ marginBottom: '1rem' }}>
            <span>⚠️</span>
            <span>{error}</span>
          </div>
        )}

        <form className="auth-form" onSubmit={handleSubmit} id="login-form">
          <Input
            id="login-email"
            label="Email address"
            type="email"
            placeholder="you@example.com"
            value={form.email}
            onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
            required
            autoComplete="email"
          />
          <Input
            id="login-password"
            label="Password"
            type="password"
            placeholder="Your password"
            value={form.password}
            onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
            required
            autoComplete="current-password"
          />

          <Button
            id="login-submit-btn"
            type="submit"
            variant="primary"
            full
            size="lg"
            loading={loading}
            style={{ marginTop: '0.5rem' }}
          >
            Sign In
          </Button>
        </form>

        <div className="auth-divider">or</div>

        <p style={{ textAlign: 'center', fontSize: 'var(--text-sm)', color: 'var(--text-secondary)' }}>
          Don't have an account?{' '}
          <Link to="/register" style={{ fontWeight: 600 }}>Create account</Link>
        </p>
      </div>
    </div>
  )
}
