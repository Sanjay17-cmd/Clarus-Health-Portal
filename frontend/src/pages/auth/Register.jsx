import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { useToast } from '../../components/ui/Toast'
import { specializationApi } from '../../api/specializations'
import Input from '../../components/ui/Input'
import Select from '../../components/ui/Select'
import Button from '../../components/ui/Button'
import ThemeSwitcher from '../../components/ui/ThemeSwitcher'

const ROLES = [
  { value: 'PATIENT', label: 'Patient' },
  { value: 'DOCTOR', label: 'Doctor' },
  { value: 'LAB_TECHNICIAN', label: 'Lab Technician' },
]

export default function Register() {
  const { register } = useAuth()
  const toast = useToast()
  const navigate = useNavigate()

  const [form, setForm] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
    role: 'PATIENT',
    specialization_id: '',
  })
  const [errors, setErrors] = useState({})
  const [loading, setLoading] = useState(false)
  const [serverError, setServerError] = useState('')
  const [specializations, setSpecializations] = useState([])
  const [specsLoading, setSpecsLoading] = useState(false)

  useEffect(() => {
    if (form.role === 'DOCTOR') {
      setSpecsLoading(true)
      specializationApi.list()
        .then(data => setSpecializations(data))
        .catch(() => setSpecializations([]))
        .finally(() => setSpecsLoading(false))
    }
  }, [form.role])

  const validate = () => {
    const e = {}
    if (!form.name.trim()) e.name = 'Name is required'
    if (!form.email.trim()) e.email = 'Email is required'
    if (form.password.length < 8) e.password = 'Password must be at least 8 characters'
    if (form.password !== form.confirmPassword) e.confirmPassword = 'Passwords do not match'
    if (form.role === 'DOCTOR' && !form.specialization_id) e.specialization_id = 'Please select a specialization'
    return e
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setServerError('')
    const errs = validate()
    setErrors(errs)
    if (Object.keys(errs).length > 0) return

    setLoading(true)
    try {
      const payload = {
        name: form.name,
        email: form.email,
        password: form.password,
        role: form.role,
        ...(form.role === 'DOCTOR' ? { specialization_id: parseInt(form.specialization_id) } : {}),
      }
      await register(payload)
      toast.success('Account Created', 'Your account is pending admin approval. You will be notified when approved.')
      navigate('/login')
    } catch (err) {
      setServerError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const set = (field) => (e) => {
    setForm(f => ({ ...f, [field]: e.target.value }))
    setErrors(prev => ({ ...prev, [field]: undefined }))
  }

  return (
    <div className="auth-page">
      <div className="auth-card" style={{ maxWidth: 520 }}>
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

        <h1 className="auth-title">Create Account</h1>
        <p className="auth-subtitle">
          New accounts require admin approval before access is granted.
        </p>

        {serverError && (
          <div className="alert alert-error" style={{ marginBottom: '1rem' }}>
            <span>⚠️</span><span>{serverError}</span>
          </div>
        )}

        <form className="auth-form" onSubmit={handleSubmit} id="register-form">
          <Input
            id="reg-name"
            label="Full Name"
            type="text"
            placeholder="Dr. Jane Smith"
            value={form.name}
            onChange={set('name')}
            error={errors.name}
            required
          />

          <Input
            id="reg-email"
            label="Email Address"
            type="email"
            placeholder="you@example.com"
            value={form.email}
            onChange={set('email')}
            error={errors.email}
            required
            autoComplete="email"
          />

          <Select
            id="reg-role"
            label="Account Type"
            value={form.role}
            onChange={set('role')}
          >
            {ROLES.map(r => (
              <option key={r.value} value={r.value}>{r.label}</option>
            ))}
          </Select>

          {form.role === 'DOCTOR' && (
            <Select
              id="reg-specialization"
              label="Medical Specialization"
              value={form.specialization_id}
              onChange={set('specialization_id')}
              error={errors.specialization_id}
            >
              <option value="">{specsLoading ? 'Loading…' : 'Select a specialization'}</option>
              {specializations.map(s => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </Select>
          )}

          <Input
            id="reg-password"
            label="Password"
            type="password"
            placeholder="Minimum 8 characters"
            value={form.password}
            onChange={set('password')}
            error={errors.password}
            required
            autoComplete="new-password"
          />

          <Input
            id="reg-confirm-password"
            label="Confirm Password"
            type="password"
            placeholder="Re-enter your password"
            value={form.confirmPassword}
            onChange={set('confirmPassword')}
            error={errors.confirmPassword}
            required
            autoComplete="new-password"
          />

          <div className="alert alert-info" style={{ fontSize: 'var(--text-xs)' }}>
            <span>ℹ️</span>
            <span>After registration, your account will be reviewed by an administrator before you can log in.</span>
          </div>

          <Button
            id="register-submit-btn"
            type="submit"
            variant="primary"
            full
            size="lg"
            loading={loading}
            style={{ marginTop: '0.5rem' }}
          >
            Create Account
          </Button>
        </form>

        <div className="auth-divider">or</div>

        <p style={{ textAlign: 'center', fontSize: 'var(--text-sm)', color: 'var(--text-secondary)' }}>
          Already have an account?{' '}
          <Link to="/login" style={{ fontWeight: 600 }}>Sign in</Link>
        </p>
      </div>
    </div>
  )
}
