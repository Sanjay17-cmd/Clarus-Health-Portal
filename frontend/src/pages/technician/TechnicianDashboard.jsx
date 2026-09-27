import { useState, useEffect } from 'react'
import Layout from '../../components/layout/Layout'
import Card from '../../components/ui/Card'
import Button from '../../components/ui/Button'
import Modal from '../../components/ui/Modal'
import { StatusBadge } from '../../components/ui/Badge'
import EmptyState from '../../components/ui/EmptyState'
import { listPatients, getGroups, getRecords, createGroup, createRecord, getTechnicianUploads } from '../../api/reports'
import { useToast } from '../../components/ui/Toast'
import RecordTypeTag from '../../components/reports/RecordTypeTag'
import SecureViewer from '../../components/reports/SecureViewer'
import CorrectionModal from '../../components/reports/CorrectionModal'
import UploadModal from '../../components/reports/UploadModal'

export default function TechnicianDashboard() {
  const [patients, setPatients] = useState([])
  const [selectedPatient, setSelectedPatient] = useState(null)
  const [groups, setGroups] = useState([])
  const [selectedGroup, setSelectedGroup] = useState(null)
  const [records, setRecords] = useState([])
  const [myUploads, setMyUploads] = useState([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(false)
  const [viewFileId, setViewFileId] = useState(null)
  const [showGroupModal, setShowGroupModal] = useState(false)
  const [showCorrectionModal, setShowCorrectionModal] = useState(false)
  const [showUploadModal, setShowUploadModal] = useState(false)

  const toast = useToast()

  const loadUploads = () => {
    getTechnicianUploads().then(setMyUploads).catch(console.error)
  }

  useEffect(() => {
    setLoading(true)
    listPatients(search).then(setPatients).catch(console.error).finally(() => setLoading(false))
  }, [search])

  useEffect(() => { loadUploads() }, [])

  const handleSelectPatient = (patient) => {
    setSelectedPatient(patient)
    setSelectedGroup(null)
    setRecords([])
    getGroups(patient.id).then(setGroups).catch(console.error)
  }

  const handleSelectGroup = (group) => {
    setSelectedGroup(group)
    getRecords(group.id).then(setRecords).catch(console.error)
  }

  const handleCreateGroup = async (e) => {
    e.preventDefault()
    const fd = new FormData(e.target)
    fd.append('patient_id', selectedPatient.id)
    try {
      const group = await createGroup(fd)
      toast.success('Report group created')
      setShowGroupModal(false)
      setGroups([group, ...groups])
      handleSelectGroup(group)
    } catch (err) {
      toast.error(err.response?.data?.detail || err.message)
    }
  }

  const handleCreateCorrection = async (formData) => {
    try {
      await createRecord(selectedGroup.id, formData)
      toast.success('Correction uploaded successfully')
      setShowCorrectionModal(false)
      getRecords(selectedGroup.id).then(setRecords)
      loadUploads()
    } catch (err) {
      toast.error(err.response?.data?.detail || err.message)
    }
  }

  const handleUploadSuccess = () => {
    if (selectedGroup) getRecords(selectedGroup.id).then(setRecords)
    if (selectedPatient) getGroups(selectedPatient.id).then(setGroups)
    loadUploads()
  }

  const fmtDate = (d) => d ? new Date(d).toLocaleDateString('en-GB') : '—'

  return (
    <Layout>
      <div className="page-header">
        <div>
          <h1 className="page-title">Lab Technician Dashboard</h1>
          <p className="page-subtitle">Upload original records and process corrections</p>
        </div>
        <Button variant="primary" onClick={() => setShowUploadModal(true)} disabled={!selectedPatient}>
          📤 Upload New Record
        </Button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '1.5rem', alignItems: 'start' }}>
        
        {/* Left Column: Patients & My Recent Uploads */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          <Card title="Patient Lookup">
            <input 
              type="text" 
              className="form-input mb-4" 
              placeholder="Search by name or email..." 
              value={search} 
              onChange={e => setSearch(e.target.value)} 
            />
            <div style={{ maxHeight: '300px', overflowY: 'auto' }}>
              {loading ? <div className="text-center p-4">Loading...</div> : 
                patients.length === 0 ? <div className="text-center p-4 text-muted">No patients found</div> :
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  {patients.map(p => (
                    <div 
                      key={p.id} 
                      onClick={() => handleSelectPatient(p)}
                      style={{ 
                        padding: '0.75rem', 
                        borderRadius: '8px', 
                        border: `1px solid ${selectedPatient?.id === p.id ? 'var(--brand-primary)' : 'var(--border-subtle)'}`,
                        background: selectedPatient?.id === p.id ? 'rgba(13, 169, 167, 0.05)' : 'var(--bg-surface)',
                        cursor: 'pointer'
                      }}
                    >
                      <div style={{ fontWeight: 600 }}>{p.name}</div>
                      <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>{p.email}</div>
                    </div>
                  ))}
                </div>
              }
            </div>
          </Card>

          <Card title="My Recent Uploads">
            {myUploads.length === 0 ? <div className="text-muted p-4">No recent uploads</div> : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {myUploads.slice(0, 8).map(r => (
                  <div key={r.id} style={{ padding: '0.5rem', border: '1px solid var(--border-subtle)', borderRadius: 6, cursor: 'pointer' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontWeight: 500, fontSize: '0.9rem' }}>{r.group?.title || '—'}</span>
                      <RecordTypeTag type={r.record_type} />
                    </div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{fmtDate(r.record_date)} · {r.files?.length || 0} file(s)</div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>

        {/* Right Column: Groups & Records */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          {!selectedPatient ? (
            <Card><EmptyState icon="👤" title="No Patient Selected" description="Select a patient from the list to view or upload reports." /></Card>
          ) : (
            <>
              <Card 
                title={`Report Groups — ${selectedPatient.name}`} 
                action={
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <Button variant="secondary" onClick={() => setShowUploadModal(true)}>📤 Upload</Button>
                    <Button variant="primary" onClick={() => setShowGroupModal(true)}>+ New Group</Button>
                  </div>
                }
              >
                {groups.length === 0 ? <div className="text-muted p-4">No report groups yet. Create one to start uploading.</div> : (
                  <div style={{ display: 'flex', gap: '0.5rem', overflowX: 'auto', paddingBottom: '0.5rem' }}>
                    {groups.map(g => (
                      <button 
                        key={g.id} 
                        onClick={() => handleSelectGroup(g)}
                        className={`btn ${selectedGroup?.id === g.id ? 'btn--primary' : 'btn--secondary'}`}
                        style={{ whiteSpace: 'nowrap' }}
                      >
                        {g.title} ({g.record_count || 0})
                      </button>
                    ))}
                  </div>
                )}
              </Card>

              {selectedGroup && (
                <Card 
                  title={`${selectedGroup.title} Records`}
                  action={
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      <Button variant="secondary" onClick={() => setShowCorrectionModal(true)}>✏️ Add Correction</Button>
                      <Button variant="primary" onClick={() => setShowUploadModal(true)}>📤 Upload</Button>
                    </div>
                  }
                >
                  <div style={{ marginBottom: '1rem', padding: '0.75rem', background: 'var(--bg-surface-alt)', borderRadius: 8, fontSize: '0.9rem' }}>
                    <strong>Test Type:</strong> {selectedGroup.test_type} <br/>
                    {selectedGroup.description && <><strong>Desc:</strong> {selectedGroup.description}</>}
                  </div>

                  {records.length === 0 ? <div className="text-muted p-4">No records in this group yet</div> : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                      {records.map(r => (
                        <div key={r.id} style={{ border: '1px solid var(--border-subtle)', borderRadius: 8, padding: '1rem', background: 'var(--bg-surface)' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                              <RecordTypeTag type={r.record_type} />
                              <span style={{ fontWeight: 600 }}>{fmtDate(r.record_date)}</span>
                            </div>
                            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                              {r.suspension_status === 'SUSPENDED' && <StatusBadge status="PENDING" label="SUSPENDED" />}
                              {r.corrects_record_id && <span style={{ fontSize: 11, background: 'rgba(59,130,246,0.12)', color: '#60a5fa', padding: '2px 8px', borderRadius: 99, fontWeight: 700 }}>CORRECTION</span>}
                            </div>
                          </div>
                          
                          <div style={{ fontSize: '0.9rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>
                            Uploaded by {r.lab_technician_name} • {fmtDate(r.created_at)}
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
                                {f.mime_type?.includes('pdf') ? '📄' : '🖼️'} {f.original_name}
                              </button>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </Card>
              )}
            </>
          )}
        </div>
      </div>

      {/* Create Group Modal */}
      {showGroupModal && (
        <Modal title="Create Report Group" onClose={() => setShowGroupModal(false)}>
          <form onSubmit={handleCreateGroup}>
            <div className="form-group">
              <label className="form-label">Title *</label>
              <input name="title" className="form-input" required placeholder="e.g. Complete Blood Count" />
            </div>
            <div className="form-group">
              <label className="form-label">Test Type *</label>
              <input name="test_type" className="form-input" required placeholder="e.g. Hematology" />
            </div>
            <div className="form-group">
              <label className="form-label">Description (Optional)</label>
              <textarea name="description" className="form-input" rows={3} />
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '1rem' }}>
              <Button type="button" variant="secondary" onClick={() => setShowGroupModal(false)}>Cancel</Button>
              <Button type="submit" variant="primary">Create Group</Button>
            </div>
          </form>
        </Modal>
      )}

      {/* Upload New Record Modal */}
      {showUploadModal && selectedPatient && (
        <UploadModal
          open={showUploadModal}
          onClose={() => setShowUploadModal(false)}
          groupId={selectedGroup?.id || null}
          groups={groups}
          patients={[selectedPatient]}
          onSuccess={handleUploadSuccess}
        />
      )}

      {/* Correction Modal */}
      {showCorrectionModal && selectedGroup && (
        <CorrectionModal 
          group={selectedGroup}
          records={records}
          onClose={() => setShowCorrectionModal(false)}
          onSubmit={handleCreateCorrection}
        />
      )}

      {/* Secure Viewer */}
      {viewFileId && (
        <SecureViewer 
          files={viewFileId.files} 
          initialIndex={viewFileId.idx} 
          onClose={() => setViewFileId(null)} 
          canDownload={true} 
        />
      )}
    </Layout>
  )
}
