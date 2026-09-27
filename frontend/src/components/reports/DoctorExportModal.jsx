import { useState } from 'react'
import { createPortal } from 'react-dom'
import { exportZip } from '../../api'
import { useToast } from '../ui/Toast'

/**
 * DoctorExportModal
 * Props:
 *   group    — the selected ReportGroup { id, title, test_type, patient_id, record_count }
 *   records  — array of ReportRecord
 *   onClose  — fn
 */
export default function DoctorExportModal({ group, records = [], onClose }) {
  const [selectedIds, setSelectedIds] = useState([]) // empty = all
  const [selectAll, setSelectAll] = useState(true)
  const [exporting, setExporting] = useState(false)
  const toast = useToast()

  const toggleRecord = (id) => {
    setSelectAll(false)
    setSelectedIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    )
  }

  const handleSelectAll = () => {
    setSelectAll(true)
    setSelectedIds([])
  }

  const handleExport = async () => {
    setExporting(true)
    try {
      const ids = selectAll ? null : selectedIds
      // exportZip returns arraybuffer directly (interceptor unwraps res.data for arraybuffer)
      const buffer = await exportZip(group.id, ids)
      const blob = new Blob([buffer], { type: 'application/zip' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `clarus_${group.title.replace(/\s+/g, '_')}_${group.id}.zip`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
      toast.success('ZIP downloaded', 'Patient has been notified of this download.')
      onClose()
    } catch (err) {
      toast.error('Export failed', err.message || 'You may not have download permission for this group.')
    } finally {
      setExporting(false)
    }
  }

  const scopeCount = selectAll ? records.length : selectedIds.length

  return createPortal(
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9500,
      background: 'rgba(0,0,0,0.72)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: '1rem',
    }}>
      <div style={{
        background: 'var(--bg-surface)',
        border: '1px solid var(--border-subtle)',
        borderRadius: 16,
        maxWidth: 520, width: '100%',
        maxHeight: '90vh',
        display: 'flex', flexDirection: 'column',
        boxShadow: '0 25px 60px rgba(0,0,0,0.4)',
      }}>
        {/* Header */}
        <div style={{
          padding: '1.25rem 1.5rem',
          borderBottom: '1px solid var(--border-subtle)',
          display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
        }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span style={{ fontSize: '1.3rem' }}>📦</span>
              <span style={{ fontWeight: 700, fontSize: '1rem', color: 'var(--text-primary)' }}>Download Report ZIP</span>
            </div>
            <div style={{ color: 'var(--text-muted)', fontSize: 12, marginTop: 3 }}>
              {group.title} · {group.test_type}
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: '1.2rem', cursor: 'pointer', padding: '0.25rem' }}>✕</button>
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '1.25rem 1.5rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>

          {/* Info box */}
          <div style={{
            padding: '0.875rem 1rem', borderRadius: 10,
            background: 'rgba(13,169,167,0.06)',
            border: '1px solid rgba(13,169,167,0.2)',
            fontSize: 13, color: 'var(--text-primary)',
          }}>
            <div style={{ fontWeight: 600, marginBottom: 6, color: 'var(--brand-primary)' }}>
              ℹ️ What happens when you download
            </div>
            <ul style={{ margin: 0, paddingLeft: '1.2rem', color: 'var(--text-muted)', lineHeight: 1.7 }}>
              <li>A ZIP archive is generated with all selected records and their files</li>
              <li>A <strong>metadata.json</strong> is included for import verification</li>
              <li><strong>The patient is automatically notified</strong> of this download</li>
              <li>This action is permanently audited</li>
              <li>The ZIP can be imported by another doctor in Clarus</li>
            </ul>
          </div>

          {/* Record selection */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.6rem' }}>
              <div style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: 14 }}>
                Select Records to Include
              </div>
              <button
                onClick={handleSelectAll}
                style={{
                  background: selectAll ? 'rgba(13,169,167,0.12)' : 'transparent',
                  border: '1px solid rgba(13,169,167,0.3)',
                  borderRadius: 6, padding: '3px 10px',
                  color: 'var(--brand-primary)', fontSize: 12, cursor: 'pointer', fontWeight: 600,
                }}
              >
                All Records ({records.length})
              </button>
            </div>

            {records.length === 0 ? (
              <div style={{ color: 'var(--text-muted)', fontSize: 13, padding: '0.75rem', textAlign: 'center' }}>
                No records found in this group.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                {records.map(rec => {
                  const checked = selectAll || selectedIds.includes(rec.id)
                  const fileCount = (rec.files || []).length
                  return (
                    <label
                      key={rec.id}
                      style={{
                        display: 'flex', alignItems: 'center', gap: '0.75rem',
                        padding: '0.65rem 0.75rem', borderRadius: 8, cursor: 'pointer',
                        border: `1px solid ${checked ? 'var(--brand-primary)' : 'var(--border-subtle)'}`,
                        background: checked ? 'rgba(13,169,167,0.04)' : 'transparent',
                        transition: 'all 0.15s',
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleRecord(rec.id)}
                        style={{ accentColor: 'var(--brand-primary)' }}
                      />
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--text-primary)' }}>
                          {rec.record_type}
                          {rec.corrects_record_id && (
                            <span style={{ marginLeft: 6, fontSize: 11, color: 'var(--brand-primary)', fontWeight: 400 }}>CORRECTION</span>
                          )}
                        </div>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                          {new Date(rec.record_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                          &nbsp;·&nbsp;{fileCount} file{fileCount !== 1 ? 's' : ''}
                          {rec.lab_technician_name && ` · By ${rec.lab_technician_name}`}
                        </div>
                      </div>
                    </label>
                  )
                })}
              </div>
            )}
          </div>

          {/* Summary */}
          <div style={{
            padding: '0.75rem 1rem', borderRadius: 8,
            background: scopeCount > 0 ? 'rgba(13,169,167,0.06)' : 'rgba(255,255,255,0.03)',
            border: '1px solid var(--border-subtle)',
            fontSize: 13, color: 'var(--text-muted)',
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          }}>
            <span>
              {scopeCount > 0
                ? `${scopeCount} record${scopeCount !== 1 ? 's' : ''} will be included`
                : 'Select at least one record'}
            </span>
            {scopeCount > 0 && (
              <span style={{ color: 'var(--brand-primary)', fontWeight: 600 }}>
                {records
                  .filter(r => selectAll || selectedIds.includes(r.id))
                  .reduce((sum, r) => sum + (r.files || []).length, 0)} files total
              </span>
            )}
          </div>

          {/* Patient notification notice */}
          <div style={{
            padding: '0.65rem 0.875rem', borderRadius: 8,
            background: 'rgba(245,158,11,0.06)',
            border: '1px solid rgba(245,158,11,0.2)',
            fontSize: 12, color: 'rgba(245,158,11,0.9)',
            display: 'flex', alignItems: 'center', gap: '0.5rem',
          }}>
            <span>🔔</span>
            <span>The patient will receive an automatic notification: <em>"Dr. [Name] exported your records as a ZIP archive."</em></span>
          </div>
        </div>

        {/* Footer */}
        <div style={{
          padding: '1rem 1.5rem',
          borderTop: '1px solid var(--border-subtle)',
          display: 'flex', gap: '0.75rem', justifyContent: 'flex-end',
        }}>
          <button
            onClick={onClose}
            disabled={exporting}
            style={{
              padding: '0.6rem 1.25rem', borderRadius: 8,
              border: '1px solid var(--border-subtle)',
              background: 'transparent', color: 'var(--text-muted)',
              cursor: 'pointer', fontSize: 14,
            }}
          >
            Cancel
          </button>
          <button
            onClick={handleExport}
            disabled={exporting || scopeCount === 0}
            style={{
              padding: '0.6rem 1.5rem', borderRadius: 8,
              background: exporting || scopeCount === 0
                ? 'rgba(13,169,167,0.4)'
                : 'var(--brand-primary)',
              border: 'none', color: '#fff',
              cursor: exporting || scopeCount === 0 ? 'not-allowed' : 'pointer',
              fontWeight: 700, fontSize: 14,
              display: 'flex', alignItems: 'center', gap: '0.5rem',
              transition: 'opacity 0.15s',
            }}
          >
            {exporting ? (
              <>
                <span style={{ display: 'inline-block', animation: 'spin 0.8s linear infinite' }}>⏳</span>
                Generating ZIP…
              </>
            ) : (
              <>📦 Download ZIP</>
            )}
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}
