import { useState } from 'react'
import { createPortal } from 'react-dom'

export default function CorrectionModal({ group, records, onClose, onSubmit, loading }) {
  const [step, setStep] = useState(1)
  const [selectedRecord, setSelectedRecord] = useState(null)
  const [files, setFiles] = useState([])
  const [notes, setNotes] = useState('')
  const [recordDate, setRecordDate] = useState(new Date().toISOString().slice(0, 16))
  const [dragOver, setDragOver] = useState(false)

  const handleFiles = (newFiles) => {
    const valid = Array.from(newFiles).filter(f => ['application/pdf','image/png','image/jpeg'].includes(f.type))
    setFiles(prev => [...prev, ...valid])
  }

  const handleSubmit = () => {
    if (!selectedRecord || !files.length) return
    const fd = new FormData()
    fd.append('record_type', 'CORRECTION')
    fd.append('corrects_record_id', selectedRecord.id)
    fd.append('record_date', new Date(recordDate).toISOString())
    fd.append('notes', notes)
    files.forEach(f => fd.append('files', f))
    onSubmit(fd)
  }

  const fmt = (d) => d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'
  const activeRecords = records?.filter(r => r.suspension_status === 'ACTIVE' || !r.suspension_status) ?? []

  return createPortal(
    <div style={{ position: 'fixed', inset: 0, zIndex: 9000, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
      <div className="modal" style={{ maxWidth: 560, width: '100%', maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}>
        <div className="modal__header">
          <h2 className="modal__title">Create Correction — {group?.title}</h2>
          <button className="modal__close" onClick={onClose}>✕</button>
        </div>

        <div className="modal__body" style={{ flex: 1, overflowY: 'auto' }}>
          {/* Step 1: pick record */}
          <div className="form-group">
            <label className="form-label">Step 1 — Select the record being corrected *</label>
            {activeRecords.length === 0 && <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>No active records in this group.</p>}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', maxHeight: 220, overflowY: 'auto' }}>
              {activeRecords.map(r => (
                <button key={r.id} onClick={() => setSelectedRecord(r)} style={{
                  textAlign: 'left', padding: '0.6rem 0.75rem', borderRadius: 8,
                  border: `2px solid ${selectedRecord?.id === r.id ? 'var(--brand-primary)' : 'var(--border-subtle)'}`,
                  background: selectedRecord?.id === r.id ? 'rgba(13,169,167,0.08)' : 'var(--bg-surface-alt)',
                  cursor: 'pointer', transition: 'all 0.15s'
                }}>
                  <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--text-primary)' }}>
                    {r.record_type} — {fmt(r.record_date)}
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                    {r.files?.length || 0} file(s) · {r.lab_technician_name} · {r.notes?.slice(0, 60) || 'No notes'}
                  </div>
                </button>
              ))}
            </div>
          </div>

          {selectedRecord && <>
            <div style={{ padding: '0.6rem 0.75rem', borderRadius: 8, background: 'var(--color-amber-50,#fffbeb)', border: '1px solid var(--color-amber-200,#fde68a)', marginBottom: '1rem' }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#92400e', marginBottom: 2 }}>⚠ Correcting:</div>
              <div style={{ fontSize: 13, color: '#78350f' }}>Record from {fmt(selectedRecord.record_date)} by {selectedRecord.lab_technician_name}</div>
              <div style={{ fontSize: 12, color: '#a16207', marginTop: 2 }}>The original record will be preserved. A new CORRECTION record will be created referencing it.</div>
            </div>

            <div className="form-group">
              <label className="form-label">Step 2 — Correction date *</label>
              <input type="datetime-local" className="form-input" value={recordDate} onChange={e => setRecordDate(e.target.value)} />
            </div>

            <div className="form-group">
              <label className="form-label">Step 3 — Upload corrected files *</label>
              <div className={`dropzone${dragOver ? ' dropzone--active' : ''}`}
                onDragOver={e => { e.preventDefault(); setDragOver(true) }}
                onDragLeave={() => setDragOver(false)}
                onDrop={e => { e.preventDefault(); setDragOver(false); handleFiles(e.dataTransfer.files) }}
                onClick={() => document.getElementById('correction-file-input')?.click()}>
                <div className="dropzone__icon">📎</div>
                <div className="dropzone__text">Drop corrected files here or click to browse</div>
                <div className="dropzone__hint">PDF, PNG, JPEG</div>
              </div>
              <input id="correction-file-input" type="file" multiple accept=".pdf,.png,.jpg,.jpeg" style={{ display: 'none' }} onChange={e => handleFiles(e.target.files)} />
              {files.length > 0 && (
                <div className="upload-file-list" style={{ marginTop: '0.5rem' }}>
                  {files.map((f, i) => (
                    <div key={i} className="upload-file-row">
                      <span className="upload-file-row__icon">📄</span>
                      <div className="upload-file-row__info">
                        <div className="upload-file-row__name">{f.name}</div>
                        <div className="upload-file-row__meta">{(f.size / 1024).toFixed(1)} KB</div>
                      </div>
                      <button className="upload-file-row__remove" onClick={() => setFiles(files.filter((_, j) => j !== i))}>✕</button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="form-group">
              <label className="form-label">Correction notes</label>
              <textarea className="form-input" rows={3} placeholder="Describe what was corrected…" value={notes} onChange={e => setNotes(e.target.value)} />
            </div>
          </>}
        </div>

        <div className="modal__footer">
          <button className="btn btn--secondary" onClick={onClose} disabled={loading}>Cancel</button>
          <button className="btn btn--primary" onClick={handleSubmit} disabled={loading || !selectedRecord || files.length === 0}>
            {loading ? 'Uploading…' : 'Submit Correction'}
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}
