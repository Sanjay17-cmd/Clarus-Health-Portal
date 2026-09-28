import { useState, useEffect, useRef } from 'react'
import Layout from '../../components/layout/Layout'
import Card from '../../components/ui/Card'
import Button from '../../components/ui/Button'
import { StatusBadge } from '../../components/ui/Badge'
import EmptyState from '../../components/ui/EmptyState'
import RecordTypeTag from '../../components/reports/RecordTypeTag'
import SecureViewer from '../../components/reports/SecureViewer'
import DoctorExportModal from '../../components/reports/DoctorExportModal'
import {
  reportsApi, importZip, exportZip, searchEmergencyPatients, requestBreakGlass,
  getEmergencyDoctors, shareDuringEmergency, requestDownloadPermission,
} from '../../api'
import { useToast } from '../../components/ui/Toast'

export default function DoctorDashboard() {
  const [groups, setGroups] = useState([])
  const [selectedGroup, setSelectedGroup] = useState(null)
  const [records, setRecords] = useState([])
  const [loading, setLoading] = useState(true)
  const [viewFileId, setViewFileId] = useState(null)
  const [showExportModal, setShowExportModal] = useState(false)
  
  // Import state
  const [patients, setPatients] = useState([])
  const [importPatientId, setImportPatientId] = useState('')
  const [importPatientSearch, setImportPatientSearch] = useState('')
  const [importFile, setImportFile] = useState(null)
  const [importing, setImporting] = useState(false)
  const [showImport, setShowImport] = useState(false)
  const fileInputRef = useRef(null)
  const [patientSearch, setPatientSearch] = useState('')
  const [patientMatches, setPatientMatches] = useState([])
  const [emergencyPatient, setEmergencyPatient] = useState(null)
  const [emergencyJustification, setEmergencyJustification] = useState('')
  const [emergencyPassword, setEmergencyPassword] = useState('')
  const [emergencyRequest, setEmergencyRequest] = useState(null)
  const [emergencyGroups, setEmergencyGroups] = useState([])
  const [emergencyDoctors, setEmergencyDoctors] = useState([])
  const [shareDoctorIds, setShareDoctorIds] = useState([])
  const [downloadReason, setDownloadReason] = useState('')
  const [downloadingRecordId, setDownloadingRecordId] = useState(null)

  const toast = useToast()

  useEffect(() => {
    reportsApi.getGroups().then(items => setGroups(items.map(group => ({
      ...group,
      emergency: group.emergency_access,
      emergencyRequestId: group.break_glass_request_id,
    })))).catch(console.error).finally(() => setLoading(false))
    searchEmergencyPatients().then(setPatients).catch(console.error)
  }, [])

  const handleSelectGroup = (group) => {
    setSelectedGroup(group)
    reportsApi.getRecords(group.id).then(setRecords).catch(console.error)
  }

  const handlePatientSearch = async (event) => {
    event.preventDefault()
    try {
      setPatientMatches(await searchEmergencyPatients(patientSearch.trim()))
    } catch (error) {
      toast.error(error.message || 'Could not search patients')
    }
  }

  const handleEmergencyRequest = async (event) => {
    event.preventDefault()
    try {
      const request = await requestBreakGlass({
        patient_id: emergencyPatient.id,
        justification: emergencyJustification,
        password: emergencyPassword,
      })
      const patientGroups = await reportsApi.getGroups(emergencyPatient.id)
      setEmergencyRequest(request)
      setEmergencyGroups(patientGroups.map(group => ({ ...group, emergency: true, can_emergency_share: true, emergencyRequestId: request.id, break_glass_doctor_id: request.doctor_id })))
      setEmergencyDoctors(await getEmergencyDoctors())
      setEmergencyPatient(null)
      setPatientMatches([])
      setEmergencyJustification('')
      setEmergencyPassword('')
      toast.success(`Emergency view access granted until ${new Date(request.expires_at).toLocaleTimeString()}`)
    } catch (error) {
      toast.error(error.message || 'Emergency access was denied')
    }
  }

  const handleEmergencyShare = async (event) => {
    event.preventDefault()
    try {
      const result = await shareDuringEmergency({
        request_id: selectedGroup.emergencyRequestId,
        group_id: selectedGroup.id,
        doctor_ids: shareDoctorIds.map(Number),
      })
      toast.success(result.status === 'PENDING_ADMIN_APPROVAL'
        ? 'Admin approval requested for this larger emergency share'
        : 'View-only emergency access shared; patient notified')
      setShareDoctorIds([])
    } catch (error) {
      toast.error(error.message || 'Could not share emergency access')
    }
  }

  const handleDownloadApprovalRequest = async (event) => {
    event.preventDefault()
    try {
      await requestDownloadPermission(selectedGroup.id, downloadReason)
      toast.success('Download approval request sent to an administrator')
      setDownloadReason('')
    } catch (error) {
      toast.error(error.message || 'Could not request download approval')
    }
  }

  const handleRecordZip = async (group, record) => {
    setDownloadingRecordId(record.id)
    try {
      const bytes = await exportZip(group.id, [record.id])
      const url = URL.createObjectURL(new Blob([bytes], { type: 'application/zip' }))
      const anchor = document.createElement('a')
      anchor.href = url
      anchor.download = `clarus_${group.title.replace(/\s+/g, '_')}_record_${record.id}.zip`
      anchor.click()
      URL.revokeObjectURL(url)
      toast.success('Report ZIP downloaded', 'The patient has been notified.')
    } catch (error) {
      toast.error(error.message || 'Administrator approval is required before downloading')
    } finally {
      setDownloadingRecordId(null)
    }
  }

  const handleImport = async (e) => {
    e.preventDefault()
    if (!importPatientId || !importFile) return
    setImporting(true)
    const fd = new FormData()
    fd.append('patient_id', importPatientId)
    fd.append('file', importFile)
    try {
      await importZip(fd)
      toast.success('ZIP successfully imported')
      setShowImport(false)
      setImportFile(null)
      // Refresh groups
      reportsApi.getGroups().then(setGroups)
    } catch (err) {
      toast.error(err.response?.data?.detail || err.message)
    } finally {
      setImporting(false)
    }
  }

  const handleImportPatientSearch = async () => {
    try {
      setPatients(await searchEmergencyPatients(importPatientSearch.trim()))
    } catch (error) {
      toast.error(error.message || 'Could not search patients')
    }
  }

  const fmtDate = (d) => d ? new Date(d).toLocaleDateString('en-GB') : '—'
  const visibleGroups = [...emergencyGroups, ...groups]

  return (
    <Layout>
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 className="page-title">Doctor Dashboard</h1>
          <p className="page-subtitle">Access patient reports shared with you and import external archives.</p>
        </div>
        <Button variant="primary" onClick={() => setShowImport(!showImport)}>
          {showImport ? 'Cancel Import' : '📥 Import ZIP Archive'}
        </Button>
      </div>

      <Card title="Emergency patient access" className="mb-4">
        <form onSubmit={handlePatientSearch} style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-end', flexWrap: 'wrap' }}>
          <div className="form-group" style={{ marginBottom: 0, flex: 1, minWidth: 220 }}>
            <label className="form-label">Search patient</label>
            <input className="form-input" value={patientSearch} onChange={e => setPatientSearch(e.target.value)} placeholder="Patient name or email" />
          </div>
          <Button type="submit" variant="secondary" disabled={!patientSearch.trim()}>Search</Button>
        </form>
        {patientMatches.length > 0 && (
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 12 }}>
            {patientMatches.map(patient => <Button key={patient.id} size="sm" variant="secondary" onClick={() => { setEmergencyPatient(patient); setPatientMatches([]) }}>{patient.name} · {patient.email}</Button>)}
          </div>
        )}
        {emergencyPatient && (
          <form onSubmit={handleEmergencyRequest} style={{ display: 'grid', gap: 10, marginTop: 14, maxWidth: 680 }}>
            <strong>Emergency access for {emergencyPatient.name}</strong>
            <textarea className="form-input" rows={3} minLength={10} required value={emergencyJustification} onChange={e => setEmergencyJustification(e.target.value)} placeholder="Medical justification (at least 10 characters)" />
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <input className="form-input" style={{ flex: 1, minWidth: 200 }} type="password" required autoComplete="current-password" value={emergencyPassword} onChange={e => setEmergencyPassword(e.target.value)} placeholder="Re-enter your password" />
              <Button type="submit" variant="danger">Grant emergency view access</Button>
              <Button type="button" variant="ghost" onClick={() => setEmergencyPatient(null)}>Cancel</Button>
            </div>
            <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>Access expires after four hours. The patient is notified and the session is audited.</span>
          </form>
        )}
        {emergencyRequest && <div style={{ marginTop: 12, color: '#b45309', fontSize: 13 }}>Emergency session active until {new Date(emergencyRequest.expires_at).toLocaleTimeString()}.</div>}
      </Card>

      {showImport && (
        <Card title="Import Records from ZIP" className="mb-4">
          <form onSubmit={handleImport} style={{ display: 'flex', gap: '1rem', alignItems: 'flex-end' }}>
            <div className="form-group" style={{ marginBottom: 0, flex: 1 }}>
              <label className="form-label">Target Patient</label>
              <div style={{ display: 'flex', gap: 6, marginBottom: 6 }}>
                <input className="form-input" value={importPatientSearch} onChange={e => setImportPatientSearch(e.target.value)} placeholder="Search by name or email" />
                <Button type="button" variant="secondary" onClick={handleImportPatientSearch}>Find</Button>
              </div>
              <select className="form-input" value={importPatientId} onChange={e => setImportPatientId(e.target.value)} required>
                <option value="">Select patient to attach records to...</option>
                {patients.map(p => <option key={p.id} value={p.id}>{p.name} ({p.email})</option>)}
              </select>
            </div>
            <div className="form-group" style={{ marginBottom: 0, flex: 1 }}>
              <label className="form-label">ZIP Archive</label>
              <input type="file" className="form-input" accept=".zip" required onChange={e => setImportFile(e.target.files[0])} ref={fileInputRef} />
            </div>
            <Button type="submit" variant="primary" disabled={importing || !importPatientId || !importFile}>
              {importing ? 'Importing...' : 'Upload & Import'}
            </Button>
          </form>
          <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '0.5rem' }}>
            The patient selected here must match the patient inside the ZIP's <code>metadata.json</code>.
          </div>
        </Card>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '1.5rem', alignItems: 'start' }}>
        
        {/* Left Column: Groups */}
        <Card title="Accessible Report Groups">
          {loading ? <div className="text-center p-4">Loading...</div> : 
              visibleGroups.length === 0 ? <EmptyState icon="📂" title="No Access" description="No patient has shared reports with you yet." /> :
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {visibleGroups.map(g => (
                <div 
                  key={g.id} 
                  onClick={() => handleSelectGroup(g)}
                  style={{ 
                    padding: '1rem', 
                    borderRadius: '8px', 
                    border: `2px solid ${selectedGroup?.id === g.id ? 'var(--brand-primary)' : 'var(--border-subtle)'}`,
                    background: selectedGroup?.id === g.id ? 'rgba(13, 169, 167, 0.05)' : 'var(--bg-surface)',
                    cursor: 'pointer'
                  }}
                >
                  <div style={{ fontWeight: 600, marginBottom: '0.25rem' }}>{g.title} {g.emergency && <StatusBadge status="PENDING" label="EMERGENCY · VIEW ONLY" />}</div>
                  <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                    Patient ID: {g.patient_id} • {g.record_count} Records
                  </div>
                </div>
              ))}
            </div>
          }
        </Card>

        {/* Right Column: Records */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          {!selectedGroup ? (
            <Card><EmptyState icon="📄" title="Select a Group" description="Choose a report group from the left to view records." /></Card>
          ) : (
            <Card 
              title={`${selectedGroup.title} Records`}
              action={
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <Button
                    variant="secondary"
                    onClick={() => setShowExportModal(true)}
                  >📦 Download ZIP</Button>
                </div>
              }
            >
              <div style={{ marginBottom: '1.5rem', padding: '1rem', background: 'var(--bg-surface-alt)', borderRadius: 8, fontSize: '0.9rem' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                  <div><strong>Test Type:</strong> {selectedGroup.test_type}</div>
                  <div><strong>Patient ID:</strong> {selectedGroup.patient_id}</div>
                  <div style={{ gridColumn: 'span 2' }}><strong>Description:</strong> {selectedGroup.description || '—'}</div>
                </div>
              </div>

              <form onSubmit={handleDownloadApprovalRequest} style={{ display: 'flex', gap: 8, alignItems: 'flex-end', flexWrap: 'wrap', marginBottom: 16 }}>
                <div className="form-group" style={{ flex: 1, minWidth: 220, marginBottom: 0 }}>
                  <label className="form-label">Admin approval required for each download</label>
                  <input className="form-input" minLength={10} required value={downloadReason} onChange={e => setDownloadReason(e.target.value)} placeholder="Reason for requesting a download" />
                </div>
                <Button type="submit" variant="secondary">Request approval</Button>
              </form>

              {selectedGroup.can_emergency_share && (
                <form onSubmit={handleEmergencyShare} style={{ display: 'flex', gap: 8, alignItems: 'flex-end', flexWrap: 'wrap', marginBottom: 16, padding: 12, border: '1px solid var(--border-subtle)', borderRadius: 8 }}>
                  <div className="form-group" style={{ flex: 1, minWidth: 240, marginBottom: 0 }}>
                    <label className="form-label">Share emergency access (view only)</label>
                    <select className="form-input" multiple value={shareDoctorIds} onChange={e => setShareDoctorIds(Array.from(e.target.selectedOptions, option => option.value))}>
                      {emergencyDoctors.filter(doctor => String(doctor.id) !== String(selectedGroup.break_glass_doctor_id)).map(doctor => <option key={doctor.id} value={doctor.id}>{doctor.name} · {doctor.email}</option>)}
                    </select>
                  </div>
                  <Button type="submit" variant="secondary" disabled={!shareDoctorIds.length}>Share view-only</Button>
                </form>
              )}

              {records.length === 0 ? <div className="text-muted p-4">No records accessible in this group.</div> : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  {records.map(r => (
                    <div key={r.id} style={{ border: '1px solid var(--border-subtle)', borderRadius: 8, padding: '1rem', background: 'var(--bg-surface)' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
                        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                          <RecordTypeTag type={r.record_type} />
                          <span style={{ fontWeight: 600, fontSize: '1.1rem' }}>{fmtDate(r.record_date)}</span>
                        </div>
                        {r.suspension_status === 'SUSPENDED' && <StatusBadge status="PENDING" label="SUSPENDED" />}
                        <Button size="sm" variant="secondary" disabled={downloadingRecordId === r.id} onClick={() => handleRecordZip(selectedGroup, r)}>
                          {downloadingRecordId === r.id ? 'Preparing ZIP…' : 'Download report ZIP'}
                        </Button>
                      </div>
                      
                      <div style={{ fontSize: '0.9rem', color: 'var(--text-muted)', marginBottom: '1.5rem' }}>
                        Uploaded by {r.lab_technician_name}
                        {r.corrects_record_id && <div style={{ color: 'var(--brand-primary)', marginTop: 2 }}>↳ Corrects record from {fmtDate(r.corrects_record_date)}</div>}
                        {r.notes && <div style={{ marginTop: '0.5rem', color: 'var(--text-primary)', background: 'var(--bg-surface-alt)', padding: '0.5rem', borderRadius: 4 }}><em>"{r.notes}"</em></div>}
                      </div>

                      {r.archive_metadata && (
                        <details style={{ marginBottom: '1rem', border: '1px solid var(--border-subtle)', borderRadius: 8, background: 'var(--bg-surface-alt)' }}>
                          <summary style={{ padding: '0.65rem 0.8rem', cursor: 'pointer', fontWeight: 600 }}>Original ZIP details</summary>
                          <pre style={{ margin: 0, padding: '0.8rem', maxHeight: 280, overflow: 'auto', whiteSpace: 'pre-wrap', overflowWrap: 'anywhere', fontSize: 12, color: 'var(--text-muted)' }}>{JSON.stringify(r.archive_metadata, null, 2)}</pre>
                        </details>
                      )}

                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                        {r.files?.map(f => (
                          <button 
                            key={f.id} 
                            onClick={() => setViewFileId({ files: r.files, idx: r.files.findIndex(x => x.id === f.id) })}
                            className="btn btn--sm btn--secondary" 
                            style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}
                          >
                            📄 {f.original_name}
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          )}
        </div>
      </div>

      {viewFileId && (
        <SecureViewer 
          files={viewFileId.files} 
          initialIndex={viewFileId.idx} 
          onClose={() => setViewFileId(null)} 
          canDownload={false}
        />
      )}
      {showExportModal && selectedGroup && (
        <DoctorExportModal
          group={selectedGroup}
          records={records}
          onClose={() => setShowExportModal(false)}
        />
      )}
    </Layout>
  )
}
