import { useState } from 'react'
import { createPortal } from 'react-dom'
import { createBgDownloadRequest } from '../../api/break_glass'
import { useToast } from '../ui/Toast'

const GLASS = {
  background: 'rgba(15,30,50,0.88)',
  backdropFilter: 'blur(20px)',
  WebkitBackdropFilter: 'blur(20px)',
  border: '1px solid rgba(248,113,113,0.25)',
  borderRadius: 16,
}

/**
 * BgDownloadModal
 * Props:
 *   bgRequest   — the active BreakGlassRequest object (must have .id, .patient_name)
 *   group       — the ReportGroup
 *   records     — array of ReportRecord (with .files)
 *   onClose     — fn
 *   onSuccess   — fn(downloadRequest)
 */
export default function BgDownloadModal({ bgRequest, group, records = [], onClose, onSuccess }) {
  const [selectedRecords, setSelectedRecords] = useState([])
  const [selectedFiles, setSelectedFiles] = useState([])
  const [reason, setReason] = useState('')
  const [loading, setLoading] = useState(false)
  const toast = useToast()

  const toggleRecord = (rec) => {
    setSelectedRecords(prev =>
      prev.includes(rec.id) ? prev.filter(id => id !== rec.id) : [...prev, rec.id]
    )
    // also deselect files of deselected record
    const fids = (rec.files || []).map(f => f.id)
    setSelectedFiles(prev =>
      selectedRecords.includes(rec.id)
        ? prev.filter(id => !fids.includes(id))
        : prev
    )
  }

  const toggleFile = (fileId) => {
    setSelectedFiles(prev =>
      prev.includes(fileId) ? prev.filter(id => id !== fileId) : [...prev, fileId]
    )
  }

  const handleSubmit = async () => {
    if (selectedRecords.length === 0) { toast.error('Select at least one record.'); return }
    if (selectedFiles.length === 0) { toast.error('Select at least one file.'); return }
    if (reason.trim().length < 5) { toast.error('Please provide a reason (min 5 chars).'); return }
    setLoading(true)
    try {
      const result = await createBgDownloadRequest({
        bg_request_id: bgRequest.id,
        group_id: group.id,
        record_ids: selectedRecords,
        file_ids: selectedFiles,
        reason: reason.trim(),
      })
      toast.success('Download request submitted. Pending admin approval.')
      onSuccess?.(result)
      onClose()
    } catch (err) {
      toast.error(err?.response?.data?.detail || 'Failed to submit request')
    } finally {
      setLoading(false)
    }
  }

  const visibleRecords = records.filter(r => selectedRecords.includes(r.id))

  return createPortal(
    <div style={{
      position: 'fixed', inset: 0, zIndex: 10000,
      background: 'rgba(0,0,0,0.75)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: '1rem',
    }}>
      <div style={{ ...GLASS, maxWidth: 560, width: '100%', maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}>
        {/* Header */}
        <div style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid rgba(248,113,113,0.2)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span style={{ fontSize: '1.25rem' }}>🚨</span>
              <span style={{ color: '#f87171', fontWeight: 700, fontSize: '1rem' }}>Request Emergency Download</span>
            </div>
            <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: 12, marginTop: 2 }}>
              Patient: <strong style={{ color: 'rgba(255,255,255,0.7)' }}>{bgRequest.patient_name}</strong>
              · BG #{bgRequest.id} · Admin approval required
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.4)', fontSize: '1.25rem', cursor: 'pointer' }}>✕</button>
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '1.25rem 1.5rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>

          {/* Warning banner */}
          <div style={{ padding: '0.75rem 1rem', borderRadius: 10, background: 'rgba(248,113,113,0.08)', border: '1px solid rgba(248,113,113,0.2)', fontSize: 13, color: 'rgba(255,255,255,0.7)' }}>
            ⚠️ This action will be permanently audited. Admin must approve before download occurs.
            Patient will be notified of this request and any approval.
          </div>

          {/* Step 1: Select records */}
          <div>
            <div style={{ fontWeight: 600, color: '#fff', fontSize: 14, marginBottom: '0.5rem' }}>
              Step 1: Select Records
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
              {records.map(rec => (
                <label key={rec.id} style={{
                  display: 'flex', alignItems: 'flex-start', gap: '0.75rem',
                  padding: '0.6rem 0.75rem', borderRadius: 8, cursor: 'pointer',
                  border: `1px solid ${selectedRecords.includes(rec.id) ? 'rgba(248,113,113,0.4)' : 'rgba(255,255,255,0.08)'}`,
                  background: selectedRecords.includes(rec.id) ? 'rgba(248,113,113,0.06)' : 'rgba(255,255,255,0.03)',
                }}>
                  <input type="checkbox" checked={selectedRecords.includes(rec.id)} onChange={() => toggleRecord(rec)} />
                  <div>
                    <div style={{ color: '#fff', fontSize: 13 }}>{rec.record_type} — {new Date(rec.record_date).toLocaleDateString('en-GB')}</div>
                    <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: 11 }}>{(rec.files || []).length} file(s)</div>
                  </div>
                </label>
              ))}
              {records.length === 0 && (
                <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: 13, padding: '0.5rem' }}>No records available for this group.</div>
              )}
            </div>
          </div>

          {/* Step 2: Select files */}
          {visibleRecords.length > 0 && (
            <div>
              <div style={{ fontWeight: 600, color: '#fff', fontSize: 14, marginBottom: '0.5rem' }}>
                Step 2: Select Files
              </div>
              {visibleRecords.map(rec => (
                <div key={rec.id} style={{ marginBottom: '0.75rem' }}>
                  <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: 12, marginBottom: '0.3rem' }}>
                    {rec.record_type} · {new Date(rec.record_date).toLocaleDateString('en-GB')}
                  </div>
                  {(rec.files || []).map(f => (
                    <label key={f.id} style={{
                      display: 'flex', alignItems: 'center', gap: '0.5rem',
                      padding: '0.4rem 0.75rem', borderRadius: 6, cursor: 'pointer',
                      border: `1px solid ${selectedFiles.includes(f.id) ? 'rgba(248,113,113,0.35)' : 'rgba(255,255,255,0.06)'}`,
                      background: selectedFiles.includes(f.id) ? 'rgba(248,113,113,0.05)' : 'transparent',
                      marginBottom: '0.25rem',
                    }}>
                      <input type="checkbox" checked={selectedFiles.includes(f.id)} onChange={() => toggleFile(f.id)} />
                      <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.8)' }}>
                        {f.mime_type?.includes('pdf') ? '📄' : '🖼'} {f.original_name}
                      </span>
                    </label>
                  ))}
                </div>
              ))}
            </div>
          )}

          {/* Step 3: Reason */}
          <div>
            <div style={{ fontWeight: 600, color: '#fff', fontSize: 14, marginBottom: '0.5rem' }}>
              Step 3: Download Justification *
            </div>
            <textarea
              value={reason}
              onChange={e => setReason(e.target.value)}
              placeholder="Explain why you need to download this record..."
              rows={3}
              style={{
                width: '100%', borderRadius: 8, padding: '0.75rem',
                background: 'rgba(255,255,255,0.05)',
                border: '1px solid rgba(255,255,255,0.12)',
                color: '#fff', resize: 'vertical', fontSize: 13, boxSizing: 'border-box',
              }}
            />
          </div>

          <div style={{ padding: '0.6rem 0.75rem', borderRadius: 8, background: 'rgba(13,169,167,0.06)', border: '1px solid rgba(13,169,167,0.15)', fontSize: 12, color: 'rgba(255,255,255,0.5)' }}>
            🔒 Once submitted: Admin will review. You cannot download until they approve.<br/>
            Approval is scoped exactly to the records and files selected above.
          </div>
        </div>

        {/* Footer */}
        <div style={{ padding: '1rem 1.5rem', borderTop: '1px solid rgba(255,255,255,0.06)', display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
          <button
            onClick={onClose}
            disabled={loading}
            style={{ padding: '0.6rem 1.25rem', borderRadius: 8, border: '1px solid rgba(255,255,255,0.15)', background: 'transparent', color: 'rgba(255,255,255,0.7)', cursor: 'pointer', fontSize: 14 }}
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={loading || selectedRecords.length === 0 || selectedFiles.length === 0 || reason.trim().length < 5}
            style={{
              padding: '0.6rem 1.25rem', borderRadius: 8,
              background: loading ? 'rgba(248,113,113,0.4)' : 'rgba(248,113,113,0.85)',
              border: 'none', color: '#fff', cursor: 'pointer', fontWeight: 600, fontSize: 14,
              opacity: (selectedRecords.length === 0 || selectedFiles.length === 0 || reason.trim().length < 5) ? 0.5 : 1,
            }}
          >
            {loading ? 'Submitting…' : '🚨 Submit Download Request'}
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}
