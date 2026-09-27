import { useState, useEffect } from 'react'
import Layout from '../../components/layout/Layout'
import { adminListDisputes, adminActOnDispute, adminDisputeAudit } from '../../api/disputes'
import { useToast } from '../../components/ui/Toast'

const fmt = (d) => d ? new Date(d).toLocaleDateString('en-GB') : '—'
const STATUS_COLORS = {
  OPEN: { bg: 'rgba(251,191,36,0.15)', color: '#d97706' },
  UNDER_REVIEW: { bg: 'rgba(59,130,246,0.15)', color: '#3b82f6' },
  QUARANTINED: { bg: 'rgba(239,68,68,0.12)', color: '#ef4444' },
  REASSIGNED: { bg: 'rgba(168,85,247,0.12)', color: '#a855f7' },
  RESOLVED: { bg: 'rgba(34,197,94,0.12)', color: '#22c55e' },
  DISMISSED: { bg: 'rgba(107,114,128,0.15)', color: '#6b7280' },
}

export default function AdminDisputes() {
  const [disputes, setDisputes] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('')
  const [expanded, setExpanded] = useState(null)
  const [auditLog, setAuditLog] = useState([])
  const [actionModal, setActionModal] = useState(null)
  const [actionForm, setActionForm] = useState({ action: '', notes: '', reassign_patient_id: '' })
  const [acting, setActing] = useState(false)
  const toast = useToast()

  const load = () => {
    setLoading(true)
    adminListDisputes(filter || undefined).then(r => setDisputes(r.data)).catch(console.error).finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [filter])

  const handleExpand = async (id) => {
    if (expanded === id) { setExpanded(null); setAuditLog([]); return }
    setExpanded(id)
    try { const r = await adminDisputeAudit(id); setAuditLog(r.data) } catch { setAuditLog([]) }
  }

  const handleAction = async () => {
    if (!actionModal || !actionForm.action) return
    setActing(true)
    try {
      await adminActOnDispute(actionModal.id, {
        action: actionForm.action,
        notes: actionForm.notes || null,
        reassign_patient_id: actionForm.reassign_patient_id ? parseInt(actionForm.reassign_patient_id) : null,
      })
      toast.success('Dispute action applied')
      setActionModal(null)
      setActionForm({ action: '', notes: '', reassign_patient_id: '' })
      load()
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Action failed')
    } finally {
      setActing(false)
    }
  }

  return (
    <Layout>
      <div className="page-header">
        <h1 className="page-title">📋 Document Disputes</h1>
        <p className="page-subtitle">Patient-reported incorrect documents. All actions are audited.</p>
      </div>

      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
        {['', 'OPEN', 'UNDER_REVIEW', 'QUARANTINED', 'REASSIGNED', 'RESOLVED', 'DISMISSED'].map(s => (
          <button key={s || 'all'} className={`btn btn--sm ${filter === s ? 'btn--primary' : 'btn--secondary'}`} onClick={() => setFilter(s)}>
            {s || 'All'} {s && disputes.filter(d => d.status === s).length > 0 ? `(${disputes.filter(d => d.status === s).length})` : ''}
          </button>
        ))}
      </div>

      {loading ? <div className="card animate-pulse" style={{ height: 200 }} /> : (
        disputes.length === 0 ? (
          <div className="card" style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>No disputes found</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {disputes.map(d => {
              const sc = STATUS_COLORS[d.status] || STATUS_COLORS.OPEN
              return (
                <div key={d.id} className="card" style={{ padding: '1rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '1rem' }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap', marginBottom: '0.5rem' }}>
                        <span style={{ padding: '2px 10px', borderRadius: 99, fontSize: 11, fontWeight: 700, background: sc.bg, color: sc.color }}>{d.status}</span>
                        <span style={{ fontWeight: 700, fontSize: 14 }}>{d.patient_name}</span>
                        <span style={{ color: 'var(--text-muted)', fontSize: 13 }}>→ {d.group_title} ({d.record_type})</span>
                      </div>
                      <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                        Reason: <strong>{d.reason?.replace(/_/g, ' ')}</strong> · Filed: {fmt(d.created_at)}
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: '0.5rem', flexShrink: 0 }}>
                      <button className="btn btn--sm btn--primary" onClick={() => setActionModal(d)}>⚡ Act</button>
                      <button className="btn btn--sm btn--secondary" onClick={() => handleExpand(d.id)}>{expanded === d.id ? '▲' : '▼'}</button>
                    </div>
                  </div>

                  {expanded === d.id && (
                    <div style={{ marginTop: '1rem', borderTop: '1px solid var(--border-subtle)', paddingTop: '1rem' }}>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                        <div>
                          <div style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 700, marginBottom: 4 }}>PATIENT EXPLANATION</div>
                          <div style={{ background: 'var(--bg-surface-alt)', padding: '0.75rem', borderRadius: 6, fontSize: 13 }}>{d.explanation}</div>
                        </div>
                        <div>
                          <div style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 700, marginBottom: 4 }}>REVIEW NOTES</div>
                          <div style={{ background: 'var(--bg-surface-alt)', padding: '0.75rem', borderRadius: 6, fontSize: 13 }}>{d.review_notes || '—'}</div>
                        </div>
                      </div>
                      <div>
                        <div style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 700, marginBottom: 6 }}>AUDIT HISTORY</div>
                        {auditLog.length === 0 ? <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>No audit entries</div> : (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                            {auditLog.map(e => (
                              <div key={e.id} style={{ display: 'flex', gap: '1rem', fontSize: 12, padding: '0.4rem', borderRadius: 6, background: 'var(--bg-surface)' }}>
                                <span style={{ color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>{fmt(e.created_at)}</span>
                                <span style={{ fontWeight: 700, color: 'var(--brand-primary)' }}>{e.action.replace(/_/g, ' ')}</span>
                                <span style={{ color: 'var(--text-muted)' }}>{e.actor_name || 'System'}</span>
                                {e.notes && <span style={{ color: 'var(--text-primary)', fontStyle: 'italic' }}>{e.notes}</span>}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )
      )}

      {actionModal && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 9000, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
          <div className="modal" style={{ maxWidth: 460, width: '100%' }}>
            <div className="modal__header">
              <h2 className="modal__title">⚡ Dispute Action — {actionModal.patient_name}</h2>
              <button className="modal__close" onClick={() => setActionModal(null)}>✕</button>
            </div>
            <div className="modal__body">
              <div className="form-group">
                <label className="form-label">Action *</label>
                <select className="form-input" value={actionForm.action} onChange={e => setActionForm(f => ({...f, action: e.target.value}))}>
                  <option value="">Select action…</option>
                  <option value="REVIEW">🔍 Mark Under Review</option>
                  <option value="QUARANTINE">🔒 Quarantine Record</option>
                  <option value="REASSIGN">🔄 Reassign to Correct Patient</option>
                  <option value="RESOLVE">✅ Resolve Dispute</option>
                  <option value="DISMISS">❌ Dismiss Dispute</option>
                </select>
              </div>
              {actionForm.action === 'REASSIGN' && (
                <div className="form-group">
                  <label className="form-label">Correct Patient ID *</label>
                  <input type="number" className="form-input" placeholder="Patient user ID to reassign to…" value={actionForm.reassign_patient_id} onChange={e => setActionForm(f => ({...f, reassign_patient_id: e.target.value}))} />
                </div>
              )}
              <div className="form-group">
                <label className="form-label">Admin notes</label>
                <textarea className="form-input" rows={3} value={actionForm.notes} onChange={e => setActionForm(f => ({...f, notes: e.target.value}))} placeholder="Internal notes…" />
              </div>
            </div>
            <div className="modal__footer">
              <button className="btn btn--secondary" onClick={() => setActionModal(null)} disabled={acting}>Cancel</button>
              <button className="btn btn--primary" onClick={handleAction} disabled={acting || !actionForm.action}>
                {acting ? 'Applying…' : 'Apply Action'}
              </button>
            </div>
          </div>
        </div>
      )}
    </Layout>
  )
}
