import { useState } from 'react'
import { createPortal } from 'react-dom'
import { requestBreakGlass } from '../../api/break_glass'
import { useToast } from '../ui/Toast'

export default function BreakGlassModal({ patient, onClose, onGranted }) {
  const [password, setPassword] = useState('')
  const [justification, setJustification] = useState('')
  const [loading, setLoading] = useState(false)
  const [confirmed, setConfirmed] = useState(false)
  const toast = useToast()

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!confirmed) return
    if (justification.trim().length < 10) {
      toast.error('Justification must be at least 10 characters.')
      return
    }
    setLoading(true)
    try {
      const res = await requestBreakGlass({
        patient_id: patient.id,
        justification: justification.trim(),
        password
      })
      toast.success(`Emergency access granted until ${new Date(res.data.expires_at).toLocaleTimeString()}`)
      onGranted?.(res.data)
      onClose()
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Break-Glass denied')
    } finally {
      setLoading(false)
    }
  }

  return createPortal(
    <div style={{ position: 'fixed', inset: 0, zIndex: 9100, background: 'rgba(0,0,0,0.82)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
      <div className="modal" style={{ maxWidth: 480, width: '100%', border: '2px solid rgba(239,68,68,0.4)' }}>
        <div className="modal__header" style={{ background: 'rgba(239,68,68,0.08)', borderBottom: '1px solid rgba(239,68,68,0.2)' }}>
          <div>
            <h2 className="modal__title" style={{ color: '#f87171' }}>🚨 Break-Glass Emergency Access</h2>
            <p style={{ fontSize: 12, color: 'rgba(248,113,113,0.7)', margin: '4px 0 0' }}>This action is permanently audited and reviewed by administrators.</p>
          </div>
          <button className="modal__close" onClick={onClose}>✕</button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="modal__body" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>

            {/* Warning */}
            <div style={{ padding: '0.875rem', borderRadius: 8, background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.2)', fontSize: 13 }}>
              <div style={{ fontWeight: 700, color: '#f87171', marginBottom: 4 }}>⚠ You are requesting emergency access to:</div>
              <div style={{ color: 'var(--text-primary)', fontWeight: 600, fontSize: 15 }}>{patient.name}</div>
              <div style={{ color: 'var(--text-muted)', fontSize: 12, marginTop: 2 }}>Patient ID: {patient.id}</div>
              <div style={{ color: 'rgba(248,113,113,0.8)', fontSize: 12, marginTop: 8 }}>
                Emergency records will be <strong>view-only</strong>. Downloads are permanently blocked for emergency sessions.
              </div>
            </div>

            {/* Password */}
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Re-enter your password to confirm *</label>
              <input
                type="password"
                className="form-input"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="Your login password"
                required
                autoComplete="current-password"
              />
            </div>

            {/* Justification */}
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Medical justification (min 10 chars) *</label>
              <textarea
                className="form-input"
                rows={4}
                value={justification}
                onChange={e => setJustification(e.target.value)}
                placeholder="e.g. Patient is unconscious in A&E, immediate access to their medical history is required for safe treatment..."
                required
              />
              <div style={{ fontSize: 12, color: justification.length < 10 ? '#f87171' : 'var(--text-muted)', marginTop: 4 }}>
                {justification.length} characters {justification.length < 10 ? `(need ${10 - justification.length} more)` : '✓'}
              </div>
            </div>

            {/* Confirmation checkbox */}
            <label style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem', cursor: 'pointer', padding: '0.75rem', borderRadius: 8, border: `1px solid ${confirmed ? 'rgba(239,68,68,0.4)' : 'var(--border-subtle)'}`, background: confirmed ? 'rgba(239,68,68,0.05)' : 'transparent' }}>
              <input type="checkbox" checked={confirmed} onChange={e => setConfirmed(e.target.checked)} style={{ marginTop: 2 }} />
              <span style={{ fontSize: 13, color: 'var(--text-primary)' }}>
                I understand this action is <strong>permanently recorded</strong> and will be reviewed by administrators. I confirm this emergency access is medically necessary.
              </span>
            </label>
          </div>

          <div className="modal__footer">
            <button type="button" className="btn btn--secondary" onClick={onClose} disabled={loading}>Cancel</button>
            <button
              type="submit"
              className="btn"
              disabled={loading || !confirmed || !password || justification.length < 10}
              style={{ background: '#dc2626', color: '#fff', fontWeight: 700 }}
            >
              {loading ? 'Verifying…' : '🚨 Confirm Emergency Access'}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  )
}
