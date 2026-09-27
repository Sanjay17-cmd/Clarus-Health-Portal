import { useState, useEffect } from 'react'
import Layout from '../../components/layout/Layout'
import Card from '../../components/ui/Card'
import Button from '../../components/ui/Button'
import { StatusBadge } from '../../components/ui/Badge'
import EmptyState from '../../components/ui/EmptyState'
import RecordTypeTag from '../../components/reports/RecordTypeTag'
import SecureViewer from '../../components/reports/SecureViewer'
import ShareModal from '../../components/reports/ShareModal'
import QrShareModal from '../../components/reports/QrShareModal'
import DeleteRequestModal from '../../components/reports/DeleteRequestModal'
import { reportsApi } from '../../api'
import { sharesApi } from '../../api'
import { exportZip } from '../../api'
import { useToast } from '../../components/ui/Toast'
import DisputeModal from '../../components/reports/DisputeModal'

export default function PatientDashboard() {
  const [groups, setGroups] = useState([])
  const [selectedGroup, setSelectedGroup] = useState(null)
  const [records, setRecords] = useState([])
  const [loading, setLoading] = useState(true)
  const [shareCounts, setShareCounts] = useState({}) // groupId → count

  const [viewFileId, setViewFileId] = useState(null)
  const [shareGroup, setShareGroup] = useState(null)       // group-level share modal
  const [shareRecord, setShareRecord] = useState(null)     // record-level share (pre-selects 1 version)
  const [qrRecord, setQrRecord] = useState(null)
  const [deleteRequestRecord, setDeleteRequestRecord] = useState(null)
  const [disputeRecord, setDisputeRecord] = useState(null)
  const [disputedRecordIds, setDisputedRecordIds] = useState(new Set())

  const toast = useToast()

  const loadGroups = () => {
    reportsApi.getGroups()
      .then(g => {
        setGroups(Array.isArray(g) ? g : [])
        setLoading(false)
        // Load share counts for each group
        const arr = Array.isArray(g) ? g : []
        arr.forEach(grp => {
          sharesApi.listGroupShares(grp.id)
            .then(shares => {
              const active = (Array.isArray(shares) ? shares : []).filter(s => s.status !== 'REVOKED' && s.is_active)
              setShareCounts(prev => ({ ...prev, [grp.id]: active.length }))
            })
            .catch(() => {})
        })
      })
      .catch(() => setLoading(false))
  }

  useEffect(() => { loadGroups() }, [])

  const handleSelectGroup = (group) => {
    setSelectedGroup(group)
    reportsApi.getRecords(group.id).then(r => setRecords(Array.isArray(r) ? r : [])).catch(console.error)
  }

  const handleExport = async () => {
    if (!selectedGroup) return
    try {
      const res = await exportZip(selectedGroup.id)
      const url = URL.createObjectURL(new Blob([res]))
      const a = document.createElement('a')
      a.href = url
      a.download = `clarus_export_${selectedGroup.id}.zip`
      a.click()
      URL.revokeObjectURL(url)
      toast.success('ZIP Export started')
    } catch (e) {
      toast.error('Export failed', e.message)
    }
  }

  const handleDisputeSuccess = (record) => {
    setDisputedRecordIds(prev => new Set([...prev, record.id]))
    setDisputeRecord(null)
  }

  const handleShareSuccess = () => {
    // Refresh share count for current group
    if (selectedGroup) {
      sharesApi.listGroupShares(selectedGroup.id)
        .then(shares => {
          const active = (Array.isArray(shares) ? shares : []).filter(s => s.status !== 'REVOKED' && s.is_active)
          setShareCounts(prev => ({ ...prev, [selectedGroup.id]: active.length }))
        })
        .catch(() => {})
    }
  }

  const fmtDate = (d) => d ? new Date(d).toLocaleDateString('en-GB') : '—'

  return (
    <Layout>
      <div className="page-header">
        <div>
          <h1 className="page-title">My Health Reports</h1>
          <p className="page-subtitle">View, share, and manage your medical records securely.</p>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '1.5rem', alignItems: 'start' }}>

        {/* Left Column: Groups */}
        <Card title="Report Groups">
          {loading ? <div className="text-center p-4">Loading...</div> :
            groups.length === 0 ? <EmptyState icon="📋" title="No Reports" description="You don't have any reports yet." /> :
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {groups.map(g => (
                <div
                  key={g.id}
                  onClick={() => handleSelectGroup(g)}
                  style={{
                    padding: '0.875rem 1rem',
                    borderRadius: 8,
                    border: `2px solid ${selectedGroup?.id === g.id ? 'var(--brand-primary)' : 'var(--border-subtle)'}`,
                    background: selectedGroup?.id === g.id ? 'rgba(13,169,167,0.05)' : 'var(--bg-surface)',
                    cursor: 'pointer', transition: 'border-color 0.15s',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div style={{ fontWeight: 600, marginBottom: '0.2rem' }}>{g.title}</div>
                    {shareCounts[g.id] > 0 && (
                      <span style={{ padding: '1px 7px', borderRadius: 99, fontSize: 10, fontWeight: 700, background: 'rgba(13,169,167,0.12)', color: 'var(--brand-primary)', whiteSpace: 'nowrap' }}>
                        🤝 {shareCounts[g.id]} share{shareCounts[g.id] > 1 ? 's' : ''}
                      </span>
                    )}
                  </div>
                  <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                    {g.test_type} · {g.record_count ?? '?'} Records
                  </div>
                </div>
              ))}
            </div>
          }
        </Card>

        {/* Right Column: Records */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          {!selectedGroup ? (
            <Card><EmptyState icon="📋" title="Select a Group" description="Choose a report group to view records." /></Card>
          ) : (
            <Card
              title={`${selectedGroup.title} Records`}
              action={
                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                  <Button variant="primary" onClick={() => setShareGroup(selectedGroup)}>🤝 Share Group</Button>
                  <Button variant="secondary" onClick={handleExport}>📤 Export ZIP</Button>
                </div>
              }
            >
              {selectedGroup.description && (
                <div style={{ marginBottom: '1rem', padding: '0.75rem 1rem', background: 'var(--bg-surface-alt)', borderRadius: 8, fontSize: '0.9rem', color: 'var(--text-muted)' }}>
                  {selectedGroup.description}
                </div>
              )}

              {records.length === 0 ? <div style={{ color: 'var(--text-muted)', padding: '2rem', textAlign: 'center' }}>No active records in this group.</div> : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  {records.map(r => (
                    <div key={r.id} style={{
                      border: `1px solid ${disputedRecordIds.has(r.id) ? 'rgba(245,158,11,0.4)' : 'var(--border-subtle)'}`,
                      borderRadius: 10, padding: '1rem',
                      background: disputedRecordIds.has(r.id) ? 'rgba(245,158,11,0.03)' : 'var(--bg-surface)',
                    }}>
                      {/* Record header */}
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.75rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
                          <RecordTypeTag type={r.record_type} />
                          <span style={{ fontWeight: 600, fontSize: '1rem' }}>{fmtDate(r.record_date)}</span>
                          {r.suspension_status === 'SUSPENDED' && <StatusBadge status="PENDING" label="SUSPENDED" />}
                          {disputedRecordIds.has(r.id) && (
                            <span style={{ padding: '2px 8px', borderRadius: 99, fontSize: 10, fontWeight: 700, background: 'rgba(245,158,11,0.15)', color: '#d97706' }}>⚠ Disputed</span>
                          )}
                        </div>
                        {r.suspension_status === 'ACTIVE' && (
                          <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
                            {/* Share THIS specific version */}
                            <button className="btn btn--sm btn--primary" onClick={() => setShareRecord(r)} title="Share this specific version">
                              🤝 Share Version
                            </button>
                            <button className="btn btn--sm btn--secondary" onClick={() => setQrRecord(r)}>🔗 QR/Link</button>
                            <button className="btn btn--sm btn--secondary" style={{ color: '#f59e0b' }} onClick={() => setDisputeRecord(r)}>📋 Dispute</button>
                            <button className="btn btn--sm btn--secondary" style={{ color: '#ef4444' }} onClick={() => setDeleteRequestRecord(r)}>🗑 Delete</button>
                          </div>
                        )}
                      </div>

                      {/* Record metadata */}
                      <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '0.75rem' }}>
                        Uploaded by {r.lab_technician_name || 'lab'}
                        {r.corrects_record_id && (
                          <span style={{ color: 'var(--brand-primary)', marginLeft: 8 }}>↩ Corrects record from {fmtDate(r.corrects_record_date)}</span>
                        )}
                        {r.notes && <div style={{ marginTop: '0.4rem', fontStyle: 'italic' }}>"{r.notes}"</div>}
                      </div>

                      {/* Files */}
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
                        {(r.files || []).map(f => (
                          <button
                            key={f.id}
                            onClick={() => setViewFileId({ files: r.files, idx: r.files.findIndex(x => x.id === f.id) })}
                            className="btn btn--sm btn--secondary"
                            style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}
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
        </div>
      </div>

      {/* Viewers / Modals */}
      {viewFileId && (
        <SecureViewer
          files={viewFileId.files}
          initialIndex={viewFileId.idx}
          onClose={() => setViewFileId(null)}
          canDownload={true}
        />
      )}

      {/* Group-level share (all records visible, user selects versions in modal) */}
      {shareGroup && (
        <ShareModal
          group={shareGroup}
          records={records}
          onClose={() => setShareGroup(null)}
          onSuccess={handleShareSuccess}
        />
      )}

      {/* Version-level share (pre-selects this specific record) */}
      {shareRecord && selectedGroup && (
        <ShareModal
          group={selectedGroup}
          records={records}
          preSelectedRecordId={shareRecord.id}
          onClose={() => setShareRecord(null)}
          onSuccess={handleShareSuccess}
        />
      )}

      {qrRecord && (
        <QrShareModal record={qrRecord} onClose={() => setQrRecord(null)} />
      )}

      {deleteRequestRecord && (
        <DeleteRequestModal
          record={deleteRequestRecord}
          groupTitle={selectedGroup?.title}
          onClose={() => setDeleteRequestRecord(null)}
          onSuccess={() => reportsApi.getRecords(selectedGroup.id).then(r => setRecords(Array.isArray(r) ? r : []))}
        />
      )}

      {disputeRecord && (
        <DisputeModal
          record={disputeRecord}
          onClose={() => setDisputeRecord(null)}
          onSuccess={() => handleDisputeSuccess(disputeRecord)}
        />
      )}
    </Layout>
  )
}
