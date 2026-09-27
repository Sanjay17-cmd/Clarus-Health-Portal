/**
 * Phase 4 — Version/File-Aware ShareModal
 * Lets patient share specific versions and files from a report group.
 *
 * Step 1: Select versions (records)
 * Step 2: Select files per version
 * Step 3: Choose doctor or specialization
 * Step 4: Choose access mode + delegation
 * Step 5: Review scope → Confirm
 */
import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { sharesApi } from '../../api'
import { reportsApi } from '../../api'
import { useToast } from '../ui/Toast'
import client from '../../api/client'

const STEPS = ['Versions', 'Files', 'Recipient', 'Access', 'Review']

function StepIndicator({ current }) {
  return (
    <div style={{ display: 'flex', gap: 0, marginBottom: '1.5rem' }}>
      {STEPS.map((label, i) => (
        <div key={i} style={{ flex: 1, textAlign: 'center' }}>
          <div style={{
            width: 28, height: 28, borderRadius: '50%', margin: '0 auto 4px',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 12, fontWeight: 700,
            background: i === current ? 'var(--brand-primary)' : i < current ? 'var(--color-teal-700)' : 'var(--bg-surface-alt)',
            color: i <= current ? '#fff' : 'var(--text-muted)',
            border: `2px solid ${i === current ? 'var(--brand-primary)' : i < current ? 'var(--color-teal-700)' : 'var(--border-subtle)'}`,
            transition: 'all 0.2s',
          }}>{i < current ? '✓' : i + 1}</div>
          <div style={{ fontSize: 10, color: i === current ? 'var(--brand-primary)' : 'var(--text-muted)', fontWeight: i === current ? 700 : 400 }}>{label}</div>
        </div>
      ))}
    </div>
  )
}

function RecordRow({ record, selected, onToggle }) {
  const fmtDate = (d) => d ? new Date(d).toLocaleDateString('en-GB') : '—'
  const TYPE_COLORS = { ORIGINAL: '#0da9a7', CORRECTION: '#3b82f6', HISTORICAL: '#6b7280' }
  return (
    <label style={{
      display: 'flex', alignItems: 'flex-start', gap: '0.75rem', padding: '0.75rem',
      borderRadius: 8, cursor: 'pointer',
      border: `2px solid ${selected ? 'var(--brand-primary)' : 'var(--border-subtle)'}`,
      background: selected ? 'rgba(13,169,167,0.04)' : 'var(--bg-surface)',
      transition: 'border-color 0.15s',
    }}>
      <input type="checkbox" checked={selected} onChange={onToggle} style={{ marginTop: 2 }} />
      <div style={{ flex: 1 }}>
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          <span style={{
            padding: '1px 8px', borderRadius: 99, fontSize: 10, fontWeight: 700,
            background: TYPE_COLORS[record.record_type] + '18',
            color: TYPE_COLORS[record.record_type],
          }}>{record.record_type}</span>
          <span style={{ fontWeight: 600, fontSize: 13 }}>{fmtDate(record.record_date)}</span>
        </div>
        {record.notes && <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>"{record.notes}"</div>}
        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
          {record.files?.length || 0} file(s)
        </div>
      </div>
    </label>
  )
}

export default function ShareModal({ group, records: initialRecords = [], preSelectedRecordId = null, onClose, onSuccess }) {
  const [step, setStep] = useState(0)
  const toast = useToast()

  // Step 1: Versions
  const [records, setRecords] = useState(initialRecords)
  // If preSelectedRecordId given, start with specific mode + that record pre-selected
  const [selectedRecordIds, setSelectedRecordIds] = useState(preSelectedRecordId ? [preSelectedRecordId] : [])
  const [selectAllVersions, setSelectAllVersions] = useState(!preSelectedRecordId)


  // Step 2: Files per version
  const [filesByRecord, setFilesByRecord] = useState({}) // {record_id: [file_id,...]}
  const [allFilesPerRecord, setAllFilesPerRecord] = useState({}) // {record_id: true/false}

  // Step 3: Recipient
  const [granteeType, setGranteeType] = useState('USER')
  const [doctorSearch, setDoctorSearch] = useState('')
  const [doctorResults, setDoctorResults] = useState([])
  const [selectedDoctor, setSelectedDoctor] = useState(null)
  const [specializations, setSpecializations] = useState([])
  const [selectedSpecId, setSelectedSpecId] = useState('')
  const [doctorSearchLoading, setDoctorSearchLoading] = useState(false)

  // Step 4: Access
  const [canDownload, setCanDownload] = useState(false)
  const [canDelegate, setCanDelegate] = useState(false)

  // Active shares
  const [activeShares, setActiveShares] = useState([])
  const [sharesLoading, setSharesLoading] = useState(true)

  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (initialRecords.length === 0 && group?.id) {
      reportsApi.getRecords(group.id).then(r => setRecords(Array.isArray(r) ? r : [])).catch(() => {})
    }
    client.get('/specializations').then(r => setSpecializations(r)).catch(() => {})
    sharesApi.listGroupShares(group.id)
      .then(r => setActiveShares(Array.isArray(r) ? r : []))
      .catch(() => {})
      .finally(() => setSharesLoading(false))
  }, [group.id])

  // Doctor search debounce
  useEffect(() => {
    if (granteeType !== 'USER' || doctorSearch.length < 2) { setDoctorResults([]); return }
    setDoctorSearchLoading(true)
    const t = setTimeout(() => {
      client.get('/patient/doctors', { params: { search: doctorSearch } })
        .then(r => setDoctorResults(Array.isArray(r) ? r : []))
        .catch(() => setDoctorResults([]))
        .finally(() => setDoctorSearchLoading(false))
    }, 300)
    return () => clearTimeout(t)
  }, [doctorSearch, granteeType])

  // Compute effective selection for display
  const effectiveRecords = selectAllVersions ? records : records.filter(r => selectedRecordIds.includes(r.id))

  const handleToggleRecord = (id) => {
    setSelectedRecordIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])
  }

  const handleToggleFile = (recordId, fileId) => {
    setFilesByRecord(prev => {
      const existing = prev[recordId] || []
      const updated = existing.includes(fileId) ? existing.filter(x => x !== fileId) : [...existing, fileId]
      return { ...prev, [recordId]: updated }
    })
  }

  const handleToggleAllFiles = (recordId, files) => {
    const isAll = allFilesPerRecord[recordId]
    setAllFilesPerRecord(prev => ({ ...prev, [recordId]: !isAll }))
    if (!isAll) {
      setFilesByRecord(prev => ({ ...prev, [recordId]: [] })) // empty = all allowed
    } else {
      setFilesByRecord(prev => ({ ...prev, [recordId]: files.map(f => f.id) }))
    }
  }

  const canGoNext = () => {
    if (step === 0) return selectAllVersions || selectedRecordIds.length > 0
    if (step === 1) return true
    if (step === 2) return (granteeType === 'USER' ? !!selectedDoctor : !!selectedSpecId)
    if (step === 3) return true
    return true
  }

  const handleSubmit = async () => {
    setSubmitting(true)
    try {
      const body = {
        group_id: group.id,
        grantee_type: granteeType,
        grantee_user_id: granteeType === 'USER' ? selectedDoctor?.id : null,
        grantee_spec_id: granteeType === 'SPECIALIZATION' ? parseInt(selectedSpecId) : null,
        max_versions: 0,
        can_view: true,
        can_download: canDownload,
        can_share: false,
        can_delegate: canDelegate,
      }

      // Version scope
      if (!selectAllVersions && selectedRecordIds.length > 0) {
        body.record_ids = selectedRecordIds
      }

      // File scope: build file_ids_by_record — omit records with all files selected
      const fileMap = {}
      for (const r of effectiveRecords) {
        const allFiles = allFilesPerRecord[r.id]
        if (!allFiles) {
          // "all files" mode → don't restrict
        } else {
          const selected = filesByRecord[r.id] || []
          if (selected.length > 0) fileMap[r.id] = selected
        }
      }
      if (Object.keys(fileMap).length > 0) {
        body.file_ids_by_record = fileMap
      }

      await sharesApi.createGroupShare(body)
      toast.success('Access granted', `Share sent to ${selectedDoctor?.name || 'department'}`)
      onSuccess?.()
      onClose()
    } catch (err) {
      toast.error('Share failed', err.message)
    } finally {
      setSubmitting(false)
    }
  }

  const handleRevoke = async (shareId) => {
    try {
      await sharesApi.revokeGroupShare(shareId)
      toast.success('Access revoked')
      setActiveShares(prev => prev.filter(s => s.id !== shareId))
    } catch (err) {
      toast.error('Revoke failed', err.message)
    }
  }

  const fmtDate = (d) => d ? new Date(d).toLocaleDateString('en-GB') : '—'

  return createPortal(
    <div style={{ position: 'fixed', inset: 0, zIndex: 9000, background: 'rgba(0,0,0,0.72)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
      <div className="modal" style={{ maxWidth: 640, width: '100%', maxHeight: '92vh', display: 'flex', flexDirection: 'column' }}>
        <div className="modal__header">
          <div>
            <h2 className="modal__title">🤝 Share Report Group</h2>
            <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: '2px 0 0' }}>{group.title}</p>
          </div>
          <button className="modal__close" onClick={onClose}>✕</button>
        </div>

        <div className="modal__body" style={{ flex: 1, overflowY: 'auto' }}>
          <StepIndicator current={step} />

          {/* ── STEP 0: Select Versions ─────────────────────────────────── */}
          {step === 0 && (
            <div>
              <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: '1rem' }}>
                Choose which historical versions to share.
              </p>
              <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1rem' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', cursor: 'pointer', fontWeight: 600, fontSize: 13 }}>
                  <input type="radio" checked={selectAllVersions} onChange={() => setSelectAllVersions(true)} />
                  All versions
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', cursor: 'pointer', fontWeight: 600, fontSize: 13 }}>
                  <input type="radio" checked={!selectAllVersions} onChange={() => setSelectAllVersions(false)} />
                  Select specific versions
                </label>
              </div>
              {!selectAllVersions && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', maxHeight: 320, overflowY: 'auto' }}>
                  {records.length === 0 ? (
                    <div style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '2rem', fontSize: 13 }}>No records found</div>
                  ) : records.map(r => (
                    <RecordRow key={r.id} record={r} selected={selectedRecordIds.includes(r.id)} onToggle={() => handleToggleRecord(r.id)} />
                  ))}
                </div>
              )}
              {selectAllVersions && (
                <div style={{ padding: '0.75rem', borderRadius: 8, background: 'rgba(13,169,167,0.06)', border: '1px solid rgba(13,169,167,0.2)', fontSize: 13, color: 'var(--text-muted)' }}>
                  ✅ All {records.length} version(s) will be shared.
                </div>
              )}
            </div>
          )}

          {/* ── STEP 1: Select Files per version ────────────────────────── */}
          {step === 1 && (
            <div>
              <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: '1rem' }}>
                For each selected version, choose which files to include.
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', maxHeight: 380, overflowY: 'auto' }}>
                {effectiveRecords.map(r => (
                  <div key={r.id} style={{ border: '1px solid var(--border-subtle)', borderRadius: 10, overflow: 'hidden' }}>
                    <div style={{ padding: '0.6rem 0.875rem', background: 'var(--bg-surface-alt)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-subtle)' }}>
                      <span style={{ fontWeight: 600, fontSize: 13 }}>{fmtDate(r.record_date)} — {r.record_type}</span>
                      <label style={{ fontSize: 12, display: 'flex', gap: '0.3rem', alignItems: 'center', cursor: 'pointer' }}>
                        <input type="checkbox" checked={!!allFilesPerRecord[r.id] === false} onChange={() => handleToggleAllFiles(r.id, r.files || [])} />
                        All files
                      </label>
                    </div>
                    <div style={{ padding: '0.625rem 0.875rem', display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                      {(r.files || []).map(f => (
                        <label key={f.id} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: 13, cursor: 'pointer', opacity: allFilesPerRecord[r.id] === false ? 1 : 0.5 }}>
                          <input
                            type="checkbox"
                            disabled={allFilesPerRecord[r.id] === false}
                            checked={allFilesPerRecord[r.id] === false || (filesByRecord[r.id] || []).includes(f.id)}
                            onChange={() => handleToggleFile(r.id, f.id)}
                          />
                          {f.mime_type?.includes('pdf') ? '📄' : '🖼️'} {f.original_name}
                        </label>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── STEP 2: Recipient ─────────────────────────────────────────── */}
          {step === 2 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                {[['USER', '👤 Specific Doctor'], ['SPECIALIZATION', '🏥 Department']].map(([t, label]) => (
                  <label key={t} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.5rem 0.875rem', borderRadius: 99, border: `2px solid ${granteeType === t ? 'var(--brand-primary)' : 'var(--border-subtle)'}`, background: granteeType === t ? 'rgba(13,169,167,0.08)' : 'var(--bg-surface)', cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>
                    <input type="radio" style={{ display: 'none' }} checked={granteeType === t} onChange={() => setGranteeType(t)} />
                    {label}
                  </label>
                ))}
              </div>

              {granteeType === 'USER' && (
                <div className="form-group" style={{ marginBottom: 0, position: 'relative' }}>
                  <label className="form-label">Search Doctor *</label>
                  {selectedDoctor ? (
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.625rem 0.875rem', border: '2px solid var(--brand-primary)', borderRadius: 8, background: 'rgba(13,169,167,0.06)' }}>
                      <div>
                        <div style={{ fontWeight: 600, fontSize: 14 }}>Dr. {selectedDoctor.name}</div>
                        <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{selectedDoctor.email}</div>
                      </div>
                      <button type="button" onClick={() => { setSelectedDoctor(null); setDoctorSearch('') }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: 18 }}>✕</button>
                    </div>
                  ) : (
                    <div style={{ position: 'relative' }}>
                      <input type="text" className="form-input" placeholder="Type doctor's name to search…" value={doctorSearch} onChange={e => setDoctorSearch(e.target.value)} autoComplete="off" />
                      {(doctorResults.length > 0 || doctorSearchLoading) && (
                        <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 999, background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: 8, boxShadow: '0 8px 24px rgba(0,0,0,0.2)', marginTop: 4, maxHeight: 200, overflowY: 'auto' }}>
                          {doctorSearchLoading && <div style={{ padding: '0.75rem', color: 'var(--text-muted)', fontSize: 13 }}>Searching…</div>}
                          {doctorResults.map(d => (
                            <div key={d.id} onClick={() => { setSelectedDoctor(d); setDoctorSearch(''); setDoctorResults([]) }}
                              style={{ padding: '0.625rem 0.875rem', cursor: 'pointer', borderBottom: '1px solid var(--border-subtle)' }}
                              onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-surface-alt)'}
                              onMouseLeave={e => e.currentTarget.style.background = ''}>
                              <div style={{ fontWeight: 600, fontSize: 14 }}>Dr. {d.name}</div>
                              <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{d.email}</div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {granteeType === 'SPECIALIZATION' && (
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">Department / Specialization *</label>
                  <select className="form-input" value={selectedSpecId} onChange={e => setSelectedSpecId(e.target.value)}>
                    <option value="">Select specialization…</option>
                    {specializations.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                </div>
              )}
            </div>
          )}

          {/* ── STEP 3: Access mode ───────────────────────────────────────── */}
          {step === 3 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.875rem' }}>
              <div style={{ padding: '0.875rem', borderRadius: 10, background: 'var(--bg-surface-alt)', border: '1px solid var(--border-subtle)' }}>
                <div style={{ fontWeight: 700, fontSize: 14, marginBottom: '0.5rem' }}>📋 View Only</div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Recipient can view the files in the Clarus portal. Cannot download.</div>
              </div>

              <label style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem', padding: '0.875rem', borderRadius: 10, border: `2px solid ${canDownload ? 'var(--brand-primary)' : 'var(--border-subtle)'}`, background: canDownload ? 'rgba(13,169,167,0.04)' : 'var(--bg-surface)', cursor: 'pointer' }}>
                <input type="checkbox" checked={canDownload} onChange={e => setCanDownload(e.target.checked)} style={{ marginTop: 2 }} />
                <div>
                  <div style={{ fontWeight: 700, fontSize: 14 }}>⬇ Allow ZIP Download</div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Doctor can export a ZIP containing the selected files. Only the selected versions and files are included.</div>
                </div>
              </label>

              <label style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem', padding: '0.875rem', borderRadius: 10, border: `2px solid ${canDelegate ? '#f59e0b' : 'var(--border-subtle)'}`, background: canDelegate ? 'rgba(245,158,11,0.04)' : 'var(--bg-surface)', cursor: 'pointer' }}>
                <input type="checkbox" checked={canDelegate} onChange={e => setCanDelegate(e.target.checked)} style={{ marginTop: 2 }} />
                <div>
                  <div style={{ fontWeight: 700, fontSize: 14, color: canDelegate ? '#d97706' : undefined }}>🔄 Allow Delegation</div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                    Doctor may re-share access with another doctor, but only within the same scope you selected. They cannot expand the versions, files, or permissions.
                  </div>
                </div>
              </label>
            </div>
          )}

          {/* ── STEP 4: Review ────────────────────────────────────────────── */}
          {step === 4 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div style={{ padding: '1rem', background: 'var(--bg-surface-alt)', borderRadius: 10, border: '1px solid var(--border-subtle)' }}>
                <div style={{ fontWeight: 700, fontSize: 13, marginBottom: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)' }}>Sharing Summary</div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.625rem' }}>
                  <div><strong>Report:</strong> {group.title}</div>
                  <div>
                    <strong>Versions:</strong> {selectAllVersions
                      ? `All ${records.length} versions`
                      : `${selectedRecordIds.length} selected version(s)`}
                  </div>
                  {!selectAllVersions && effectiveRecords.map(r => (
                    <div key={r.id} style={{ marginLeft: '1rem', fontSize: 13, color: 'var(--text-muted)' }}>
                      ✓ {new Date(r.record_date).toLocaleDateString('en-GB')} ({r.record_type})
                      {!allFilesPerRecord[r.id] && (filesByRecord[r.id]?.length > 0) && (
                        <div style={{ marginLeft: '1rem' }}>
                          {(r.files || []).filter(f => (filesByRecord[r.id] || []).includes(f.id)).map(f => (
                            <div key={f.id}>✓ {f.original_name}</div>
                          ))}
                          {(r.files || []).filter(f => !(filesByRecord[r.id] || []).includes(f.id)).map(f => (
                            <div key={f.id} style={{ textDecoration: 'line-through', opacity: 0.5 }}>✗ {f.original_name}</div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                  <div>
                    <strong>Recipient:</strong> {granteeType === 'USER'
                      ? `Dr. ${selectedDoctor?.name}`
                      : `Specialization #${selectedSpecId}`}
                  </div>
                  <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                    <span style={{ padding: '2px 10px', borderRadius: 99, fontSize: 11, fontWeight: 700, background: 'rgba(13,169,167,0.12)', color: 'var(--brand-primary)' }}>👁 View</span>
                    {canDownload && <span style={{ padding: '2px 10px', borderRadius: 99, fontSize: 11, fontWeight: 700, background: 'rgba(59,130,246,0.12)', color: '#3b82f6' }}>⬇ Download</span>}
                    {canDelegate && <span style={{ padding: '2px 10px', borderRadius: 99, fontSize: 11, fontWeight: 700, background: 'rgba(245,158,11,0.12)', color: '#d97706' }}>🔄 Delegation Allowed</span>}
                    {!canDownload && !canDelegate && <span style={{ padding: '2px 10px', borderRadius: 99, fontSize: 11, fontWeight: 700, background: 'rgba(107,114,128,0.12)', color: '#6b7280' }}>🔒 View Only</span>}
                  </div>
                </div>
              </div>

              <div style={{ fontSize: 12, color: 'var(--text-muted)', padding: '0.5rem', borderRadius: 6, background: 'rgba(239,68,68,0.04)', border: '1px solid rgba(239,68,68,0.15)' }}>
                ⚠ Once confirmed, the recipient receives a notification and can view these records in their Shared Reports panel.
              </div>
            </div>
          )}

          {/* Navigation */}
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '1.5rem', paddingTop: '1rem', borderTop: '1px solid var(--border-subtle)' }}>
            <button className="btn btn--secondary" onClick={() => step === 0 ? onClose() : setStep(s => s - 1)}>
              {step === 0 ? 'Cancel' : '← Back'}
            </button>
            {step < 4 ? (
              <button className="btn btn--primary" onClick={() => setStep(s => s + 1)} disabled={!canGoNext()}>
                Next →
              </button>
            ) : (
              <button className="btn btn--primary" onClick={handleSubmit} disabled={submitting}>
                {submitting ? 'Sharing…' : '✅ Confirm Share'}
              </button>
            )}
          </div>
        </div>

        {/* Active Shares panel below */}
        {!sharesLoading && activeShares.length > 0 && (
          <div style={{ borderTop: '1px solid var(--border-subtle)', padding: '1rem' }}>
            <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)', marginBottom: '0.75rem' }}>Active Shares</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', maxHeight: 200, overflowY: 'auto' }}>
              {activeShares.map(s => (
                <div key={s.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.625rem 0.75rem', background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: 8 }}>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 13 }}>
                      {s.grantee_type === 'USER' ? `Dr. ${s.grantee_name || s.grantee_user_id}` : `🏥 ${s.grantee_name || `Dept #${s.grantee_spec_id}`}`}
                      {s.parent_share_id && <span style={{ fontSize: 10, marginLeft: 6, color: '#d97706', fontWeight: 700 }}>DELEGATED</span>}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                      {s.allowed_record_ids ? `${s.allowed_record_ids.length} version(s)` : s.max_versions > 0 ? `Latest ${s.max_versions}` : 'All versions'}
                      {' · '}{s.can_download ? 'View + Download' : 'View Only'}
                      {s.can_delegate ? ' · Delegation ON' : ''}
                      {' · '}<span style={{ color: s.status === 'ACCEPTED' ? '#22c55e' : s.status === 'PENDING' ? '#f59e0b' : '#ef4444', fontWeight: 700 }}>{s.status}</span>
                    </div>
                  </div>
                  {!s.parent_share_id && (
                    <button className="btn btn--sm btn--secondary" style={{ color: '#ef4444' }} onClick={() => handleRevoke(s.id)}>Revoke</button>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>,
    document.body
  )
}
