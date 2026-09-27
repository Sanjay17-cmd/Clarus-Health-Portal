import { useState, useCallback, useRef } from 'react'
import { createPortal } from 'react-dom'
import { reportsApi } from '../../api/reports'
import { useToast } from '../ui/Toast'
import Button from '../ui/Button'

const ALLOWED_TYPES = ['application/pdf', 'image/png', 'image/jpeg', 'image/jpg']
const MAX_MB = 20

function FileRow({ file, index, onRemove }) {
  const isPdf = file.type === 'application/pdf'
  const sizeMb = (file.size / 1024 / 1024).toFixed(2)
  return (
    <div className="upload-file-row">
      <span className="upload-file-row__icon">{isPdf ? '📄' : '🖼️'}</span>
      <div className="upload-file-row__info">
        <div className="upload-file-row__name">{file.name}</div>
        <div className="upload-file-row__meta">{isPdf ? 'PDF' : 'Image'} · {sizeMb} MB</div>
      </div>
      <button
        className="upload-file-row__remove"
        onClick={() => onRemove(index)}
        title="Remove file"
        type="button"
      >✕</button>
    </div>
  )
}

export default function UploadModal({ open, onClose, groupId, groups = [], patients = [], onSuccess }) {
  const toast = useToast()
  const dropRef = useRef()
  const fileInputRef = useRef()

  const [selectedPatientId, setSelectedPatientId] = useState('')
  const [selectedGroupId, setSelectedGroupId] = useState(groupId || '')
  const [newGroupTitle, setNewGroupTitle] = useState('')
  const [newGroupTestType, setNewGroupTestType] = useState('')
  const [createNewGroup, setCreateNewGroup] = useState(!groupId)
  const [recordType, setRecordType] = useState('ORIGINAL')
  const [recordDate, setRecordDate] = useState(() => new Date().toISOString().slice(0, 16))
  const [correctsRecordId, setCorrectsRecordId] = useState('')
  const [notes, setNotes] = useState('')
  const [files, setFiles] = useState([])
  const [dragging, setDragging] = useState(false)
  const [uploading, setUploading] = useState(false)

  const addFiles = useCallback((incoming) => {
    const valid = []
    for (const f of incoming) {
      if (!ALLOWED_TYPES.includes(f.type)) {
        toast.error('Invalid file type', `${f.name}: only PDF, PNG, JPEG allowed`)
        continue
      }
      if (f.size > MAX_MB * 1024 * 1024) {
        toast.error('File too large', `${f.name}: max ${MAX_MB} MB`)
        continue
      }
      valid.push(f)
    }
    setFiles(prev => [...prev, ...valid])
  }, [toast])

  const onDrop = useCallback((e) => {
    e.preventDefault()
    setDragging(false)
    addFiles(Array.from(e.dataTransfer.files))
  }, [addFiles])

  const onDragOver = (e) => { e.preventDefault(); setDragging(true) }
  const onDragLeave = () => setDragging(false)

  const removeFile = (idx) => setFiles(prev => prev.filter((_, i) => i !== idx))

  const handleSubmit = async () => {
    if (files.length === 0) {
      toast.error('No files', 'Please add at least one file')
      return
    }
    setUploading(true)
    try {
      let gid = selectedGroupId || groupId

      // Create group if needed
      if (createNewGroup || !gid) {
        if (!selectedPatientId && !groupId) {
          toast.error('Missing patient', 'Please select a patient')
          setUploading(false)
          return
        }
        if (!newGroupTitle || !newGroupTestType) {
          toast.error('Missing info', 'Group title and test type are required')
          setUploading(false)
          return
        }
        const gfd = new FormData()
        gfd.append('patient_id', selectedPatientId)
        gfd.append('title', newGroupTitle)
        gfd.append('test_type', newGroupTestType)
        const newGroup = await reportsApi.createGroup(gfd)
        gid = newGroup.id
      }

      const fd = new FormData()
      fd.append('record_type', recordType)
      fd.append('record_date', new Date(recordDate).toISOString())
      if (notes) fd.append('notes', notes)
      if (recordType === 'CORRECTION' && correctsRecordId) {
        fd.append('corrects_record_id', correctsRecordId)
      }
      for (const f of files) fd.append('files', f)

      await reportsApi.createRecord(gid, fd)
      toast.success('Upload successful', `${files.length} file(s) uploaded`)
      onSuccess?.()
      onClose()
    } catch (err) {
      toast.error('Upload failed', err.message)
    } finally {
      setUploading(false)
    }
  }

  if (!open) return null

  return createPortal(
    <div className="modal-overlay" onClick={onClose} role="dialog" aria-modal="true" aria-label="Upload Report">
      <div
        className="modal-box modal-box-lg upload-modal"
        onClick={e => e.stopPropagation()}
        style={{ maxWidth: 680, width: '95vw', maxHeight: '90vh', overflowY: 'auto' }}
      >
        <div className="modal-header">
          <h2 className="modal-title">📤 Upload Medical Report</h2>
          <button className="modal-close" onClick={onClose} aria-label="Close">✕</button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {/* Patient + Group */}
          {!groupId && (
            <>
              {patients.length > 0 && (
                <div className="form-group">
                  <label className="form-label">Patient *</label>
                  <select
                    className="form-input"
                    value={selectedPatientId}
                    onChange={e => setSelectedPatientId(e.target.value)}
                  >
                    <option value="">Select patient…</option>
                    {patients.map(p => (
                      <option key={p.id} value={p.id}>{p.name} — {p.email}</option>
                    ))}
                  </select>
                </div>
              )}

              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', cursor: 'pointer', fontSize: 'var(--text-sm)' }}>
                  <input type="radio" checked={createNewGroup} onChange={() => setCreateNewGroup(true)} />
                  Create new report group
                </label>
                {groups.length > 0 && (
                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', cursor: 'pointer', fontSize: 'var(--text-sm)' }}>
                    <input type="radio" checked={!createNewGroup} onChange={() => setCreateNewGroup(false)} />
                    Add to existing group
                  </label>
                )}
              </div>

              {createNewGroup ? (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                  <div className="form-group">
                    <label className="form-label">Report Title *</label>
                    <input className="form-input" placeholder="e.g. Blood Sugar" value={newGroupTitle} onChange={e => setNewGroupTitle(e.target.value)} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Test Type *</label>
                    <input className="form-input" placeholder="e.g. Biochemistry" value={newGroupTestType} onChange={e => setNewGroupTestType(e.target.value)} />
                  </div>
                </div>
              ) : (
                <div className="form-group">
                  <label className="form-label">Report Group *</label>
                  <select className="form-input" value={selectedGroupId} onChange={e => setSelectedGroupId(e.target.value)}>
                    <option value="">Select group…</option>
                    {groups.map(g => <option key={g.id} value={g.id}>{g.title} — {g.test_type}</option>)}
                  </select>
                </div>
              )}
            </>
          )}

          {/* Record info */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
            <div className="form-group">
              <label className="form-label">Record Type</label>
              <select className="form-input" value={recordType} onChange={e => setRecordType(e.target.value)}>
                <option value="ORIGINAL">Original</option>
                <option value="HISTORICAL">Historical</option>
                <option value="CORRECTION">Correction</option>
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Record Date & Time *</label>
              <input className="form-input" type="datetime-local" value={recordDate} onChange={e => setRecordDate(e.target.value)} />
            </div>
          </div>

          {recordType === 'CORRECTION' && (
            <div className="form-group">
              <label className="form-label">Corrects Record ID</label>
              <input className="form-input" type="number" placeholder="ID of the record being corrected" value={correctsRecordId} onChange={e => setCorrectsRecordId(e.target.value)} />
            </div>
          )}

          <div className="form-group">
            <label className="form-label">Notes (optional)</label>
            <textarea className="form-input" rows={2} style={{ resize: 'vertical' }} value={notes} onChange={e => setNotes(e.target.value)} placeholder="Any clinical notes for this record…" />
          </div>

          {/* Drop zone */}
          <div
            ref={dropRef}
            className={`dropzone ${dragging ? 'dropzone--active' : ''}`}
            onDrop={onDrop}
            onDragOver={onDragOver}
            onDragLeave={onDragLeave}
            onClick={() => fileInputRef.current?.click()}
          >
            <div className="dropzone__icon">📁</div>
            <div className="dropzone__text">
              <strong>Drag & drop files here</strong> or click to browse
            </div>
            <div className="dropzone__hint">PDF, PNG, JPEG · Max {MAX_MB} MB each</div>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept=".pdf,.png,.jpg,.jpeg"
              style={{ display: 'none' }}
              onChange={e => addFiles(Array.from(e.target.files))}
            />
          </div>

          {/* Selected files */}
          {files.length > 0 && (
            <div className="upload-file-list">
              <div style={{ fontSize: 'var(--text-sm)', fontWeight: 600, marginBottom: '0.5rem', color: 'var(--text-secondary)' }}>
                {files.length} file(s) selected
              </div>
              {files.map((f, i) => (
                <FileRow key={i} file={f} index={i} onRemove={removeFile} />
              ))}
            </div>
          )}

          <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
            <Button variant="ghost" onClick={onClose} disabled={uploading}>Cancel</Button>
            <Button variant="primary" onClick={handleSubmit} loading={uploading} disabled={files.length === 0}>
              Upload {files.length > 0 ? `(${files.length} file${files.length > 1 ? 's' : ''})` : ''}
            </Button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  )
}
