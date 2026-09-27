import { useState, useEffect } from 'react'
import Layout from '../../components/layout/Layout'
import {
  adminListBreakGlass, adminListSuspensions, adminRestoreFromSuspension,
  adminListBgDownloadRequests, adminReviewBgDownload,
  adminListBgShareRequests, adminReviewBgShare,
} from '../../api/break_glass'
import { useToast } from '../../components/ui/Toast'

const fmt = (d) => d ? new Date(d).toLocaleString('en-GB') : '—'
const STATUS_COLORS = { ACTIVE: '#22c55e', EXPIRED: '#6b7280', REVOKED: '#ef4444' }
const REQ_COLORS = { PENDING: '#f59e0b', APPROVED: '#22c55e', REJECTED: '#ef4444' }

function ReviewModal({ title, item, onClose, onReview }) {
  const [notes, setNotes] = useState('')
  const [loading, setLoading] = useState(false)
  const toast = useToast()

  const handle = async (approved) => {
    setLoading(true)
    try {
      await onReview(item.id, { approved, review_notes: notes || null })
      toast.success(approved ? 'Approved.' : 'Rejected.')
      onClose()
    } catch (err) {
      toast.error(err?.response?.data?.detail || 'Action failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 9000, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
      <div className="modal" style={{ maxWidth: 480, width: '100%' }}>
        <div className="modal__header">
          <h2 className="modal__title">🚨 {title}</h2>
          <button className="modal__close" onClick={onClose}>✕</button>
        </div>
        <div className="modal__body">
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem 1rem', fontSize: 13, marginBottom: '1rem' }}>
            <div><span style={{ color: 'var(--text-muted)' }}>Doctor:</span> <strong>{item.doctor_name || item.requesting_doctor_name || `#${item.doctor_id || item.requesting_doctor_id}`}</strong></div>
            <div><span style={{ color: 'var(--text-muted)' }}>Patient:</span> <strong>{item.patient_name || `#${item.patient_id}`}</strong></div>
            {item.recipient_doctor_name && <div><span style={{ color: 'var(--text-muted)' }}>Recipient:</span> <strong>{item.recipient_doctor_name}</strong></div>}
            <div><span style={{ color: 'var(--text-muted)' }}>Group:</span> {item.group_title || `#${item.group_id}`}</div>
            <div><span style={{ color: 'var(--text-muted)' }}>BG Event:</span> #{item.bg_request_id}</div>
            {item.share_count != null && <div><span style={{ color: 'var(--text-muted)' }}>Share #:</span> <strong style={{ color: '#f59e0b' }}>{item.share_count}</strong></div>}
            <div><span style={{ color: 'var(--text-muted)' }}>Submitted:</span> {fmt(item.created_at)}</div>
          </div>

          {(item.record_ids || []).length > 0 && (
            <div style={{ padding: '0.5rem 0.75rem', borderRadius: 8, background: 'var(--bg-surface-alt)', fontSize: 12, marginBottom: '0.75rem' }}>
              <div style={{ color: 'var(--text-muted)', marginBottom: 3 }}>Scope — Records: {(item.record_ids || []).join(', ')} · Files: {(item.file_ids || []).join(', ')}</div>
            </div>
          )}

          {(item.reason || item.justification) && (
            <div style={{ padding: '0.5rem 0.75rem', borderRadius: 8, background: 'rgba(248,113,113,0.05)', border: '1px solid rgba(248,113,113,0.15)', fontSize: 13, marginBottom: '0.75rem' }}>
              <div style={{ color: 'var(--text-muted)', fontSize: 11 }}>Reason</div>
              {item.reason || item.justification}
            </div>
          )}

          <div style={{ padding: '0.5rem 0.75rem', borderRadius: 8, background: 'rgba(239,68,68,0.04)', border: '1px solid rgba(239,68,68,0.15)', fontSize: 12, marginBottom: '1rem', color: 'var(--text-muted)' }}>
            ⚠️ Admin cannot view medical file contents. Review metadata only.
          </div>

          <div className="form-group">
            <label className="form-label">Review notes (optional)</label>
            <textarea className="form-input" rows={2} value={notes} onChange={e => setNotes(e.target.value)} placeholder="Notes visible to doctor and patient…" />
          </div>
        </div>
        <div className="modal__footer">
          <button className="btn btn--secondary" onClick={onClose} disabled={loading}>Cancel</button>
          <button onClick={() => handle(false)} disabled={loading} style={{ padding: '0.5rem 1rem', borderRadius: 8, background: '#dc2626', color: '#fff', border: 'none', cursor: 'pointer', fontWeight: 600 }}>
            {loading ? '…' : '✕ Reject'}
          </button>
          <button onClick={() => handle(true)} disabled={loading} style={{ padding: '0.5rem 1rem', borderRadius: 8, background: '#16a34a', color: '#fff', border: 'none', cursor: 'pointer', fontWeight: 600 }}>
            {loading ? '…' : '✓ Approve'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default function AdminEmergency() {
  const [tab, setTab] = useState('requests')
  const [requests, setRequests] = useState([])
  const [suspensions, setSuspensions] = useState([])
  const [dlRequests, setDlRequests] = useState([])
  const [srRequests, setSrRequests] = useState([])
  const [loading, setLoading] = useState(true)
  const [restoreModal, setRestoreModal] = useState(null)
  const [reviewDl, setReviewDl] = useState(null)
  const [reviewSr, setReviewSr] = useState(null)
  const [restoreNotes, setRestoreNotes] = useState('')
  const [restoring, setRestoring] = useState(false)
  const toast = useToast()

  const load = () => {
    setLoading(true)
    Promise.all([
      adminListBreakGlass(),
      adminListSuspensions(),
      adminListBgDownloadRequests(),
      adminListBgShareRequests(),
    ])
      .then(([r, s, dl, sr]) => {
        setRequests(Array.isArray(r) ? r : [])
        setSuspensions(Array.isArray(s) ? s : [])
        setDlRequests(Array.isArray(dl) ? dl : [])
        setSrRequests(Array.isArray(sr) ? sr : [])
      })
      .catch(err => {
        console.error('Emergency load failed:', err.message)
        setRequests([]); setSuspensions([]); setDlRequests([]); setSrRequests([])
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
      setRestoreModal(null); setRestoreNotes(''); load()
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Restore failed')
    } finally { setRestoring(false) }
  }

  const pendingDl = dlRequests.filter(r => r.status === 'PENDING').length
  const pendingSr = srRequests.filter(r => r.status === 'PENDING').length

  return (
    <Layout>
      <div className="page-header">
        <h1 className="page-title">🚨 Emergency Security</h1>
        <p className="page-subtitle">Break-Glass access, download approvals, share chain approvals and abuse suspensions. All actions are permanently audited.</p>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
        {[
          { key: 'requests', label: `Emergency Requests (${requests.length})` },
          { key: 'downloads', label: `📥 Download Approvals${pendingDl ? ` 🔴 ${pendingDl}` : ` (${dlRequests.length})`}` },
          { key: 'shares', label: `🔗 Share Approvals${pendingSr ? ` 🔴 ${pendingSr}` : ` (${srRequests.length})`}` },
          { key: 'suspensions', label: `🔴 Abuse Suspensions (${suspensions.filter(s => !s.restored_at).length} pending)` },
        ].map(t => (
          <button key={t.key}
            className={`btn btn--sm ${tab === t.key ? 'btn--primary' : 'btn--secondary'}`}
            style={t.key === 'suspensions' && tab === t.key ? { background: '#dc2626' } : {}}
            onClick={() => setTab(t.key)}
          >{t.label}</button>
        ))}
      </div>

      {loading ? <div className="card animate-pulse" style={{ height: 200 }} /> : (

        tab === 'requests' ? (
          <div className="card" style={{ overflow: 'hidden' }}>
            {requests.length === 0
              ? <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>No Break-Glass requests yet</div>
              : <table className="table">
                  <thead><tr><th>Doctor</th><th>Patient</th><th>Granted</th><th>Expires</th><th>Status</th><th>Justification</th></tr></thead>
                  <tbody>
                    {requests.map(r => (
                      <tr key={r.id}>
                        <td><strong>{r.doctor_name || `#${r.doctor_id}`}</strong></td>
                        <td>{r.patient_name || `#${r.patient_id}`}</td>
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
            }
          </div>

        ) : tab === 'downloads' ? (
          <div className="card" style={{ overflow: 'hidden' }}>
            {dlRequests.length === 0
              ? <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>No download requests yet</div>
              : <table className="table">
                  <thead><tr><th>Doctor</th><th>Patient</th><th>Group</th><th>Records</th><th>Files</th><th>Status</th><th>Submitted</th><th>Action</th></tr></thead>
                  <tbody>
                    {dlRequests.map(r => (
                      <tr key={r.id} style={{ background: r.status === 'PENDING' ? 'rgba(245,158,11,0.03)' : undefined }}>
                        <td><strong>{r.doctor_name || `#${r.doctor_id}`}</strong></td>
                        <td>{r.patient_name || `#${r.patient_id}`}</td>
                        <td style={{ fontSize: 12 }}>{r.group_title || `#${r.group_id}`}</td>
                        <td style={{ fontSize: 12 }}>{(r.record_ids || []).length} record(s)</td>
                        <td style={{ fontSize: 12 }}>{(r.file_ids || []).length} file(s)</td>
                        <td><span style={{ padding: '2px 8px', borderRadius: 99, fontSize: 11, fontWeight: 700, background: REQ_COLORS[r.status] + '22', color: REQ_COLORS[r.status] }}>{r.status}</span>
                          {r.download_performed ? <span style={{ fontSize: 10, color: '#6b7280', display: 'block' }}>Downloaded {fmt(r.downloaded_at)}</span> : null}
                        </td>
                        <td style={{ fontSize: 12, whiteSpace: 'nowrap' }}>{fmt(r.created_at)}</td>
                        <td>
                          {r.status === 'PENDING' && (
                            <button className="btn btn--sm btn--primary" onClick={() => setReviewDl(r)}>Review</button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
            }
          </div>

        ) : tab === 'shares' ? (
          <div className="card" style={{ overflow: 'hidden' }}>
            {srRequests.length === 0
              ? <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>No pending share approval requests</div>
              : <table className="table">
                  <thead><tr><th>Doctor</th><th>Recipient</th><th>Patient</th><th>Share #</th><th>Group</th><th>Status</th><th>Submitted</th><th>Action</th></tr></thead>
                  <tbody>
                    {srRequests.map(r => (
                      <tr key={r.id} style={{ background: r.status === 'PENDING' ? 'rgba(245,158,11,0.03)' : undefined }}>
                        <td><strong>{r.requesting_doctor_name || `#${r.requesting_doctor_id}`}</strong></td>
                        <td>{r.recipient_doctor_name || `#${r.recipient_doctor_id}`}</td>
                        <td>{r.patient_name || `#${r.patient_id}`}</td>
                        <td><span style={{ fontWeight: 700, color: '#f59e0b' }}>#{r.share_count}</span></td>
                        <td style={{ fontSize: 12 }}>{r.group_title || `#${r.group_id}`}</td>
                        <td><span style={{ padding: '2px 8px', borderRadius: 99, fontSize: 11, fontWeight: 700, background: REQ_COLORS[r.status] + '22', color: REQ_COLORS[r.status] }}>{r.status}</span></td>
                        <td style={{ fontSize: 12, whiteSpace: 'nowrap' }}>{fmt(r.created_at)}</td>
                        <td>
                          {r.status === 'PENDING' && (
                            <button className="btn btn--sm btn--primary" onClick={() => setReviewSr(r)}>Review</button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
            }
          </div>

        ) : (
          <div className="card" style={{ overflow: 'hidden' }}>
            {suspensions.length === 0
              ? <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>No abuse suspensions</div>
              : <table className="table">
                  <thead><tr><th>Doctor</th><th>Patients Accessed</th><th>Window</th><th>Suspended</th><th>Status</th><th>Action</th></tr></thead>
                  <tbody>
                    {suspensions.map(s => (
                      <tr key={s.id} style={{ background: !s.restored_at ? 'rgba(239,68,68,0.04)' : undefined }}>
                        <td><strong>{s.doctor_name || `#${s.doctor_id}`}</strong></td>
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
                            <button className="btn btn--sm btn--success" onClick={() => { setRestoreModal(s); setRestoreNotes('') }}>Restore</button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
            }
          </div>
        )
      )}

      {/* Restore Modal */}
      {restoreModal && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 9000, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
          <div className="modal" style={{ maxWidth: 440, width: '100%' }}>
            <div className="modal__header">
              <h2 className="modal__title" style={{ color: '#22c55e' }}>✅ Restore Doctor Account</h2>
              <button className="modal__close" onClick={() => setRestoreModal(null)}>✕</button>
            </div>
            <div className="modal__body">
              <div style={{ fontSize: 14, color: 'var(--text-primary)', marginBottom: '1rem' }}>
                Restore <strong>Dr. {restoreModal.doctor_name}</strong>'s account?
              </div>
              <div className="form-group">
                <label className="form-label">Admin restoration notes (optional)</label>
                <textarea className="form-input" rows={3} value={restoreNotes} onChange={e => setRestoreNotes(e.target.value)} placeholder="Reason for restoration…" />
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

      {/* Download Review Modal */}
      {reviewDl && (
        <ReviewModal
          title="Review Emergency Download Request"
          item={reviewDl}
          onClose={() => { setReviewDl(null); load() }}
          onReview={adminReviewBgDownload}
        />
      )}

      {/* Share Review Modal */}
      {reviewSr && (
        <ReviewModal
          title="Review Emergency Share #4+ Request"
          item={reviewSr}
          onClose={() => { setReviewSr(null); load() }}
          onReview={adminReviewBgShare}
        />
      )}
    </Layout>
  )
}
