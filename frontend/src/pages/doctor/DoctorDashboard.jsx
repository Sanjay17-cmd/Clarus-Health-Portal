import { useState, useEffect, useRef } from 'react'
import Layout from '../../components/layout/Layout'
import Card from '../../components/ui/Card'
import Button from '../../components/ui/Button'
import { StatusBadge } from '../../components/ui/Badge'
import EmptyState from '../../components/ui/EmptyState'
import RecordTypeTag from '../../components/reports/RecordTypeTag'
import SecureViewer from '../../components/reports/SecureViewer'
import BreakGlassModal from '../../components/reports/BreakGlassModal'
import { reportsApi } from '../../api/reports'
import { exportZip, importZip } from '../../api/archive'
import { checkBreakGlassStatus } from '../../api/break_glass'
import { useToast } from '../../components/ui/Toast'

export default function DoctorDashboard() {
  const [groups, setGroups] = useState([])
  const [selectedGroup, setSelectedGroup] = useState(null)
  const [records, setRecords] = useState([])
  const [loading, setLoading] = useState(true)
  const [viewFileId, setViewFileId] = useState(null)
  const [breakGlassPatient, setBreakGlassPatient] = useState(null) // patient to request BG for
  const [activeEmergencies, setActiveEmergencies] = useState({}) // patientId -> BG request
  
  // Import state
  const [patients, setPatients] = useState([])
  const [importPatientId, setImportPatientId] = useState('')
  const [importFile, setImportFile] = useState(null)
  const [importing, setImporting] = useState(false)
  const [showImport, setShowImport] = useState(false)
  const fileInputRef = useRef(null)

  const toast = useToast()

  useEffect(() => {
    reportsApi.getGroups().then(setGroups).catch(console.error).finally(() => setLoading(false))
    reportsApi.listPatients().then(setPatients).catch(console.error)
  }, [])

  const handleSelectGroup = (group) => {
    setSelectedGroup(group)
    reportsApi.getRecords(group.id).then(setRecords).catch(console.error)
    // Check break-glass status for this group's patient
    if (group.patient_id) {
      checkBreakGlassStatus(group.patient_id)
        .then(r => {
          // Client interceptor unwraps res.data — r IS the response object directly
          if (r.is_active) {
            setActiveEmergencies(prev => ({ ...prev, [group.patient_id]: r.request }))
          }
        })
        .catch(() => {})

    }
  }

  const handleExport = async () => {
    if (!selectedGroup) return
    try {
      const res = await exportZip(selectedGroup.id)
      // Interceptor returns arraybuffer directly for binary responses — res IS the buffer
      const url = URL.createObjectURL(new Blob([res]))
      const a = document.createElement('a')
      a.href = url
      a.download = `clarus_export_${selectedGroup.id}.zip`
      a.click()
      URL.revokeObjectURL(url)
      toast.success('ZIP Export started')
    } catch (e) {
      toast.error('Export failed: You may not have download permission for this group.')
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

  const fmtDate = (d) => d ? new Date(d).toLocaleDateString('en-GB') : '—'

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

      {showImport && (
        <Card title="Import Records from ZIP" className="mb-4">
          <form onSubmit={handleImport} style={{ display: 'flex', gap: '1rem', alignItems: 'flex-end' }}>
            <div className="form-group" style={{ marginBottom: 0, flex: 1 }}>
              <label className="form-label">Target Patient</label>
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
            groups.length === 0 ? <EmptyState icon="📂" title="No Access" description="No patient has shared reports with you yet." /> :
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {groups.map(g => (
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
                  <div style={{ fontWeight: 600, marginBottom: '0.25rem' }}>{g.title}</div>
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
                  <Button variant="secondary" onClick={handleExport}>📤 Export ZIP</Button>
                  <button
                    className="btn"
                    style={{ background: '#dc2626', color: '#fff', fontWeight: 700, fontSize: '0.85rem' }}
                    onClick={() => setBreakGlassPatient({ id: selectedGroup.patient_id, name: `Patient ${selectedGroup.patient_id}` })}
                  >🚨 Break-Glass</button>
                </div>
              }
            >
              {/* Emergency access badge */}
              {activeEmergencies[selectedGroup.patient_id] && (
                <div style={{ marginBottom: '1rem', padding: '0.75rem', borderRadius: 8, background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.3)', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <span style={{ fontSize: '1.5rem' }}>🚨</span>
                  <div>
                    <div style={{ fontWeight: 700, color: '#f87171', fontSize: 14 }}>Emergency Override Active</div>
                    <div style={{ fontSize: 12, color: 'rgba(248,113,113,0.7)' }}>View only — Downloads blocked. Expires: {new Date(activeEmergencies[selectedGroup.patient_id].expires_at).toLocaleTimeString()}</div>
                  </div>
                </div>
              )}
              <div style={{ marginBottom: '1.5rem', padding: '1rem', background: 'var(--bg-surface-alt)', borderRadius: 8, fontSize: '0.9rem' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                  <div><strong>Test Type:</strong> {selectedGroup.test_type}</div>
                  <div><strong>Patient ID:</strong> {selectedGroup.patient_id}</div>
                  <div style={{ gridColumn: 'span 2' }}><strong>Description:</strong> {selectedGroup.description || '—'}</div>
                </div>
              </div>

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
                      </div>
                      
                      <div style={{ fontSize: '0.9rem', color: 'var(--text-muted)', marginBottom: '1.5rem' }}>
                        Uploaded by {r.lab_technician_name}
                        {r.corrects_record_id && <div style={{ color: 'var(--brand-primary)', marginTop: 2 }}>↳ Corrects record from {fmtDate(r.corrects_record_date)}</div>}
                        {r.notes && <div style={{ marginTop: '0.5rem', color: 'var(--text-primary)', background: 'var(--bg-surface-alt)', padding: '0.5rem', borderRadius: 4 }}><em>"{r.notes}"</em></div>}
                      </div>

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
          canDownload={!activeEmergencies[selectedGroup?.patient_id]}
        />
      )}

      {breakGlassPatient && (
        <BreakGlassModal
          patient={breakGlassPatient}
          onClose={() => setBreakGlassPatient(null)}
          onGranted={(req) => {
            setActiveEmergencies(prev => ({ ...prev, [req.patient_id]: req }))
            // Reload records
            if (selectedGroup) reportsApi.getRecords(selectedGroup.id).then(setRecords)
          }}
        />
      )}
    </Layout>
  )
}
