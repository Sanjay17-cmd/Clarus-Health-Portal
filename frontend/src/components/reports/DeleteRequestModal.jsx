import { useState } from 'react'
import { createPortal } from 'react-dom'
import { requestDeletion } from '../../api'
import { useToast } from '../ui/Toast'

export default function DeleteRequestModal({ record, groupTitle, onClose, onSuccess }) {
  const [reason, setReason] = useState('')
  const [loading, setLoading] = useState(false)
  const toast = useToast()

  const handleSubmit = async () => {
    if (reason.trim().length < 5) { toast.error('Please provide a reason (min 5 characters)'); return }
    setLoading(true)
    try {
      await requestDeletion(record.id, reason.trim())
      toast.success('Deletion request submitted. Record suspended pending admin review.')
      onSuccess?.()
      onClose()
    } catch (e) {
      toast.error(e.message)
    } finally {
      setLoading(false)
    }
  }

  const fmt = (d) => d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'

  return createPortal(
    <div style={{ position: 'fixed', inset: 0, zIndex: 9000, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
      <div className="modal" style={{ maxWidth: 480, width: '100%' }}>
        <div className="modal__header">
          <h2 className="modal__title" style={{ color: 'var(--color-red-500,#ef4444)' }}>🗑 Request Record Deletion</h2>
          <button className="modal__close" onClick={onClose}>✕</button>
        </div>
        <div className="modal__body">
          <div style={{ padding: '0.75rem', borderRadius: 8, background: 'rgba(239,68,68,0.07)', border: '1px solid rgba(239,68,68,0.2)', marginBottom: '1rem' }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--color-red-500,#ef4444)', marginBottom: 4 }}>⚠ This will SUSPEND the record, not delete it</div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>The record will be hidden from all listings and an Administrator will review your request. They may restore or permanently delete it.</div>
          </div>

          <div className="form-group">
            <label className="form-label">Record</label>
            <div style={{ padding: '0.5rem 0.75rem', borderRadius: 8, background: 'var(--bg-surface-alt)', border: '1px solid var(--border-subtle)', fontSize: 13, color: 'var(--text-primary)' }}>
              <strong>{groupTitle}</strong> — {record.record_type} — {fmt(record.record_date)}
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Reason for deletion request *</label>
            <textarea className="form-input" rows={4} placeholder="Explain why this record should be deleted…" value={reason} onChange={e => setReason(e.target.value)} />
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>{reason.length} / 500 characters</div>
          </div>
        </div>
        <div className="modal__footer">
          <button className="btn btn--secondary" onClick={onClose} disabled={loading}>Cancel</button>
          <button className="btn" onClick={handleSubmit} disabled={loading || reason.trim().length < 5} style={{ background: 'var(--color-red-500,#ef4444)', color: '#fff' }}>
            {loading ? 'Submitting…' : 'Submit Request'}
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}
