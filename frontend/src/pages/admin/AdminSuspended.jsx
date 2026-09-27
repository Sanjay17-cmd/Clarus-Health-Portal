import { useState, useEffect } from 'react'
import Layout from '../../components/layout/Layout'
import { getDeletionRequests, restoreRecord, permanentlyDeleteRecord } from '../../api'
import { useToast } from '../../components/ui/Toast'

const fmt = (d) => d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'

export default function AdminSuspended() {
  const [requests, setRequests] = useState([])
  const [filter, setFilter] = useState('PENDING')
  const [loading, setLoading] = useState(true)
  const [reviewModal, setReviewModal] = useState(null) // { req, action }
  const [notes, setNotes] = useState('')
  const [acting, setActing] = useState(false)
  const toast = useToast()

  const load = () => {
    setLoading(true)
    getDeletionRequests(filter || undefined).then(setRequests).catch(console.error).finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [filter])

  const handleAction = async () => {
    if (!reviewModal) return
    setActing(true)
    try {
      if (reviewModal.action === 'RESTORE') {
        await restoreRecord(reviewModal.req.id, { decision: 'RESTORE', review_notes: notes })
        toast.success('Record restored successfully')
      } else {
        await permanentlyDeleteRecord(reviewModal.req.id, { decision: 'PERMANENTLY_DELETE', review_notes: notes })
        toast.success('Record permanently deleted (moved to recycle bin)')
      }
      setReviewModal(null)
      setNotes('')
      load()
    } catch (e) {
      toast.error(e.message)
    } finally {
      setActing(false)
    }
  }

  return (
    <Layout>
      <div className="page-header">
        <h1 className="page-title">Suspended Records</h1>
        <p className="page-subtitle">Review deletion requests. Restore records or permanently move to recycle bin.</p>
      </div>

      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem' }}>
        {['PENDING','RESTORED','PERMANENTLY_DELETED'].map(s => (
          <button key={s} className={`btn btn--sm ${filter === s ? 'btn--primary' : 'btn--secondary'}`} onClick={() => setFilter(s)}>{s.replace('_',' ')}</button>
        ))}
        <button className="btn btn--sm btn--secondary" onClick={() => setFilter('')}>All</button>
      </div>

      {loading ? <div className="card animate-pulse" style={{ height: 200 }} /> : (
        requests.length === 0 ? (
          <div className="card" style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>No {filter} requests</div>
        ) : (
          <div className="card" style={{ overflow: 'hidden' }}>
            <table className="table">
              <thead><tr>
                <th>Patient</th><th>Group</th><th>Record Type</th><th>Record Date</th><th>Requester</th><th>Reason</th><th>Status</th><th>Actions</th>
              </tr></thead>
              <tbody>
                {requests.map(r => (
                  <tr key={r.id}>
                    <td>{r.patient_name}</td>
                    <td><strong>{r.group_title}</strong></td>
                    <td>{r.record_type}</td>
                    <td>{fmt(r.record_date)}</td>
                    <td>{r.requester_name}</td>
                    <td style={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={r.reason}>{r.reason}</td>
                    <td><span className={`badge ${r.status === 'PENDING' ? 'badge--warning' : r.status === 'RESTORED' ? 'badge--success' : 'badge--danger'}`}>{r.status}</span></td>
                    <td>
                      {r.status === 'PENDING' && (
                        <div style={{ display: 'flex', gap: '0.4rem' }}>
                          <button className="btn btn--sm btn--success" onClick={() => { setReviewModal({ req: r, action: 'RESTORE' }); setNotes('') }}>Restore</button>
                          <button className="btn btn--sm btn--danger" onClick={() => { setReviewModal({ req: r, action: 'PERMANENTLY_DELETE' }); setNotes('') }}>Delete</button>
                        </div>
                      )}
                      {r.status !== 'PENDING' && <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{fmt(r.reviewed_at)}</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      )}

      {reviewModal && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 9000, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
          <div className="modal" style={{ maxWidth: 440, width: '100%' }}>
            <div className="modal__header">
              <h2 className="modal__title" style={{ color: reviewModal.action === 'RESTORE' ? 'var(--color-green-600,#16a34a)' : 'var(--color-red-500,#ef4444)' }}>
                {reviewModal.action === 'RESTORE' ? '✅ Restore Record' : '🗑 Permanently Delete'}
              </h2>
              <button className="modal__close" onClick={() => setReviewModal(null)}>✕</button>
            </div>
            <div className="modal__body">
              {reviewModal.action === 'PERMANENTLY_DELETE' && (
                <div style={{ padding: '0.75rem', borderRadius: 8, background: 'rgba(239,68,68,0.07)', border: '1px solid rgba(239,68,68,0.2)', marginBottom: '1rem', fontSize: 13, color: 'var(--color-red-500,#ef4444)' }}>
                  ⚠ Files will be moved to the recycle bin. This action cannot be undone through the UI.
                </div>
              )}
              <div className="form-group">
                <label className="form-label">Admin review notes (optional)</label>
                <textarea className="form-input" rows={3} value={notes} onChange={e => setNotes(e.target.value)} placeholder="Add internal notes…" />
              </div>
            </div>
            <div className="modal__footer">
              <button className="btn btn--secondary" onClick={() => setReviewModal(null)} disabled={acting}>Cancel</button>
              <button className="btn" onClick={handleAction} disabled={acting} style={{ background: reviewModal.action === 'RESTORE' ? 'var(--color-green-600,#16a34a)' : 'var(--color-red-500,#ef4444)', color: '#fff' }}>
                {acting ? 'Processing…' : reviewModal.action === 'RESTORE' ? 'Confirm Restore' : 'Confirm Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </Layout>
  )
}
