import { useState, useEffect } from 'react'
import Layout from '../../components/layout/Layout'
import { adminListBreakGlass, adminListSuspensions, adminRestoreFromSuspension } from '../../api/break_glass'
import { useToast } from '../../components/ui/Toast'

const fmt = (d) => d ? new Date(d).toLocaleString('en-GB') : '—'
const STATUS_COLORS = { ACTIVE: '#22c55e', EXPIRED: '#6b7280', REVOKED: '#ef4444' }

export default function AdminEmergency() {
  const [tab, setTab] = useState('requests')
  const [requests, setRequests] = useState([])
  const [suspensions, setSuspensions] = useState([])
  const [loading, setLoading] = useState(true)
  const [restoreModal, setRestoreModal] = useState(null)
  const [restoreNotes, setRestoreNotes] = useState('')
  const [restoring, setRestoring] = useState(false)
  const toast = useToast()

  const load = () => {
    setLoading(true)
    Promise.all([adminListBreakGlass(), adminListSuspensions()])
      .then(([r, s]) => {
        // Client interceptor already returns res.data — no .data needed
        setRequests(Array.isArray(r) ? r : [])
        setSuspensions(Array.isArray(s) ? s : [])
      })
      .catch(err => {
        console.error('Emergency load failed:', err.message)
        setRequests([])
        setSuspensions([])
      })
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [])

  const handleRestore = async () => {
    if (!restoreModal) return
    setRestoring(true)
    try {
      await adminRestoreFromSuspension(restoreModal.id, { restore_notes: restoreNotes })
      toast.success(`Dr. ${restoreModal.doctor_name}'s account restored.`)
      setRestoreModal(null)
      setRestoreNotes('')
      load()
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Restore failed')
    } finally {
      setRestoring(false)
    }
  }

  return (
    <Layout>
      <div className="page-header">
        <h1 className="page-title">🚨 Emergency Security</h1>
        <p className="page-subtitle">Break-Glass access requests and abuse suspensions. All actions are permanently audited.</p>
      </div>

      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem' }}>
        <button className={`btn btn--sm ${tab === 'requests' ? 'btn--primary' : 'btn--secondary'}`} onClick={() => setTab('requests')}>
          Emergency Requests ({requests.length})
        </button>
        <button className={`btn btn--sm ${tab === 'suspensions' ? '' : 'btn--secondary'}`} onClick={() => setTab('suspensions')}
          style={tab === 'suspensions' ? { background: '#dc2626', color: '#fff' } : {}}>
          🔴 Abuse Suspensions ({suspensions.filter(s => !s.restored_at).length} pending)
        </button>
      </div>

      {loading ? <div className="card animate-pulse" style={{ height: 200 }} /> : tab === 'requests' ? (
        <div className="card" style={{ overflow: 'hidden' }}>
          {requests.length === 0 ? (
            <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>No Break-Glass requests yet</div>
          ) : (
            <table className="table">
              <thead><tr><th>Doctor</th><th>Patient</th><th>Granted</th><th>Expires</th><th>Status</th><th>Justification</th></tr></thead>
              <tbody>
                {requests.map(r => (
                  <tr key={r.id}>
                    <td><strong>{r.doctor_name || `ID ${r.doctor_id}`}</strong></td>
                    <td>{r.patient_name || `ID ${r.patient_id}`}</td>
                    <td style={{ whiteSpace: 'nowrap', fontSize: 12 }}>{fmt(r.granted_at)}</td>
                    <td style={{ whiteSpace: 'nowrap', fontSize: 12 }}>{fmt(r.expires_at)}</td>
                    <td><span style={{ padding: '2px 8px', borderRadius: 99, fontSize: 11, fontWeight: 700, background: STATUS_COLORS[r.status] + '22', color: STATUS_COLORS[r.status] }}>{r.status}</span></td>
                    <td style={{ maxWidth: 280, fontSize: 13 }}>
                      <details><summary style={{ cursor: 'pointer', color: 'var(--brand-primary)' }}>Show</summary>
                        <div style={{ marginTop: 4, padding: '0.5rem', background: 'var(--bg-surface-alt)', borderRadius: 6 }}>{r.justification}</div>
                      </details>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      ) : (
        <div className="card" style={{ overflow: 'hidden' }}>
          {suspensions.length === 0 ? (
            <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>No abuse suspensions</div>
          ) : (
            <table className="table">
              <thead><tr><th>Doctor</th><th>Patients Accessed</th><th>Window</th><th>Suspended</th><th>Status</th><th>Action</th></tr></thead>
              <tbody>
                {suspensions.map(s => (
                  <tr key={s.id} style={{ background: !s.restored_at ? 'rgba(239,68,68,0.04)' : undefined }}>
                    <td><strong>{s.doctor_name || `ID ${s.doctor_id}`}</strong></td>
                    <td>
                      <span style={{ fontWeight: 700, color: '#f87171' }}>{s.trigger_count} patients</span>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>IDs: {(s.patient_ids || []).join(', ')}</div>
                    </td>
                    <td style={{ fontSize: 12 }}>{fmt(s.window_start)} → {fmt(s.window_end)}</td>
                    <td style={{ fontSize: 12 }}>{fmt(s.suspended_at)}</td>
                    <td>
                      {s.restored_at
                        ? <span style={{ color: '#22c55e', fontWeight: 600, fontSize: 12 }}>✅ Restored {fmt(s.restored_at)}</span>
                        : <span style={{ color: '#f87171', fontWeight: 700 }}>🔴 SUSPENDED</span>}
                    </td>
                    <td>
                      {!s.restored_at && (
                        <div style={{ display: 'flex', gap: '0.4rem' }}>
                          <button className="btn btn--sm btn--success" onClick={() => { setRestoreModal(s); setRestoreNotes('') }}>Restore</button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {restoreModal && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 9000, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
          <div className="modal" style={{ maxWidth: 440, width: '100%' }}>
            <div className="modal__header">
              <h2 className="modal__title" style={{ color: '#22c55e' }}>✅ Restore Doctor Account</h2>
              <button className="modal__close" onClick={() => setRestoreModal(null)}>✕</button>
            </div>
            <div className="modal__body">
              <div style={{ fontSize: 14, color: 'var(--text-primary)', marginBottom: '1rem' }}>
                Restore <strong>Dr. {restoreModal.doctor_name}</strong>'s account? This will allow them to log in again.
              </div>
              <div className="form-group">
                <label className="form-label">Admin restoration notes (optional)</label>
                <textarea className="form-input" rows={3} value={restoreNotes} onChange={e => setRestoreNotes(e.target.value)} placeholder="Reason for restoration, e.g. confirmed genuine emergency..." />
              </div>
            </div>
            <div className="modal__footer">
              <button className="btn btn--secondary" onClick={() => setRestoreModal(null)} disabled={restoring}>Cancel</button>
              <button className="btn btn--success" onClick={handleRestore} disabled={restoring} style={{ background: '#16a34a', color: '#fff' }}>
                {restoring ? 'Restoring…' : 'Confirm Restore'}
              </button>
            </div>
          </div>
        </div>
      )}
    </Layout>
  )
}
