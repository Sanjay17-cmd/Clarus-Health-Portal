import { useState } from 'react'
import { createPortal } from 'react-dom'
import { createDispute } from '../../api'
import { useToast } from '../ui/Toast'

const REASONS = [
  { value: 'WRONG_PATIENT', label: '👤 Wrong patient — this record does not belong to me' },
  { value: 'NOT_MY_REPORT', label: '📄 Not my report — I never underwent this test' },
  { value: 'WRONG_DOCUMENT', label: '📎 Wrong document — incorrect file attached' },
  { value: 'DUPLICATE', label: '🔁 Duplicate — this record appears more than once' },
  { value: 'OTHER', label: '❓ Other — explain below' },
]

export default function DisputeModal({ record, groupTitle, onClose, onSuccess }) {
  const [reason, setReason] = useState('')
  const [explanation, setExplanation] = useState('')
  const [loading, setLoading] = useState(false)
  const toast = useToast()

  const handleSubmit = async () => {
    if (!reason) { toast.error('Please select a reason.'); return }
    if (explanation.trim().length < 5) { toast.error('Please provide an explanation.'); return }
    setLoading(true)
    try {
      await createDispute({ record_id: record.id, reason, explanation: explanation.trim() })
      toast.success('Dispute submitted. An administrator will review it.')
      onSuccess?.()
      onClose()
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to submit dispute')
    } finally {
      setLoading(false)
    }
  }

  return createPortal(
    <div style={{ position: 'fixed', inset: 0, zIndex: 9000, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
      <div className="modal" style={{ maxWidth: 500, width: '100%' }}>
        <div className="modal__header">
          <h2 className="modal__title">📋 Dispute: This Report Does Not Belong to Me</h2>
          <button className="modal__close" onClick={onClose}>✕</button>
        </div>
        <div className="modal__body">
          <div style={{ padding: '0.75rem', borderRadius: 8, background: 'var(--bg-surface-alt)', border: '1px solid var(--border-subtle)', marginBottom: '1.25rem', fontSize: 13 }}>
            <div style={{ color: 'var(--text-muted)' }}>Group</div>
            <div style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{groupTitle}</div>
            <div style={{ color: 'var(--text-muted)', marginTop: 4 }}>Record type: {record.record_type} — {new Date(record.record_date).toLocaleDateString('en-GB')}</div>
          </div>

          <div className="form-group">
            <label className="form-label">Reason *</label>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
              {REASONS.map(r => (
                <label key={r.value} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.6rem 0.75rem', borderRadius: 8, border: `2px solid ${reason === r.value ? 'var(--brand-primary)' : 'var(--border-subtle)'}`, cursor: 'pointer', background: reason === r.value ? 'rgba(13,169,167,0.06)' : 'var(--bg-surface)' }}>
                  <input type="radio" name="reason" value={r.value} checked={reason === r.value} onChange={() => setReason(r.value)} />
                  <span style={{ fontSize: 13, color: 'var(--text-primary)' }}>{r.label}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Explanation *</label>
            <textarea className="form-input" rows={4} value={explanation} onChange={e => setExplanation(e.target.value)} placeholder="Please describe the issue in detail…" />
          </div>

          <div style={{ fontSize: 12, color: 'var(--text-muted)', padding: '0.5rem 0.75rem', background: 'var(--bg-surface-alt)', borderRadius: 6 }}>
            ℹ Your dispute will be reviewed by an administrator. The original record will not be destroyed — only flagged for review.
          </div>
        </div>
        <div className="modal__footer">
          <button className="btn btn--secondary" onClick={onClose} disabled={loading}>Cancel</button>
          <button className="btn btn--primary" onClick={handleSubmit} disabled={loading || !reason || explanation.length < 5}>
            {loading ? 'Submitting…' : 'Submit Dispute'}
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}
