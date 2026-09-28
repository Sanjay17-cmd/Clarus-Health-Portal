import { useEffect, useState } from 'react'
import Layout from '../../components/layout/Layout'
import Button from '../../components/ui/Button'
import { decideAdminPermissionRequest, getAdminPermissionRequests } from '../../api'
import { useToast } from '../../components/ui/Toast'

const fmt = (value) => value ? new Date(value).toLocaleString() : '—'

export default function AdminApprovals() {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState(null)
  const toast = useToast()

  const load = () => {
    setLoading(true)
    getAdminPermissionRequests().then(setItems).catch(() => toast.error('Could not load permission requests')).finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [])

  const decide = async (item, approve) => {
    setBusyId(item.id)
    try {
      await decideAdminPermissionRequest(item.id, approve)
      toast.success(approve ? 'Permission approved' : 'Permission rejected')
      load()
    } catch (error) {
      toast.error(error.message || 'Could not update request')
    } finally {
      setBusyId(null)
    }
  }

  const pending = items.filter(item => item.status === 'PENDING')
  return (
    <Layout>
      <div className="page-header">
        <h1 className="page-title">Permission Requests</h1>
        <p className="page-subtitle">Review doctor download requests and emergency shares to more than three doctors.</p>
      </div>
      {loading ? <div className="card animate-pulse" style={{ height: 180 }} /> : pending.length === 0 ? (
        <div className="card" style={{ padding: '2.5rem', textAlign: 'center', color: 'var(--text-muted)' }}>No pending requests.</div>
      ) : pending.map(item => (
        <section className="card" key={item.id} style={{ marginBottom: '1rem', padding: '1.25rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', alignItems: 'flex-start', flexWrap: 'wrap' }}>
            <div>
              <strong>{item.action === 'DOWNLOAD' ? 'Report download' : 'Emergency view-only share'}</strong>
              <div style={{ color: 'var(--text-muted)', fontSize: 13, marginTop: 6 }}>
                Dr. {item.requester_name} · {item.patient_name} · {item.group_title} · {fmt(item.created_at)}
              </div>
              <p style={{ margin: '0.75rem 0 0', whiteSpace: 'pre-wrap' }}>{item.justification}</p>
              {item.doctor_ids?.length > 0 && <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 6 }}>Additional doctors: {item.doctor_ids.join(', ')}</div>}
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <Button variant="danger" size="sm" disabled={busyId === item.id} onClick={() => decide(item, false)}>Reject</Button>
              <Button variant="success" size="sm" disabled={busyId === item.id} onClick={() => decide(item, true)}>Approve</Button>
            </div>
          </div>
        </section>
      ))}
      {!loading && items.some(item => item.status !== 'PENDING') && (
        <details style={{ marginTop: '1.5rem' }}>
          <summary style={{ cursor: 'pointer', color: 'var(--text-muted)' }}>Previously decided requests</summary>
          <div style={{ marginTop: '0.75rem', display: 'grid', gap: 8 }}>
            {items.filter(item => item.status !== 'PENDING').map(item => (
              <div className="card" key={item.id} style={{ padding: '0.75rem 1rem', fontSize: 13 }}>
                {item.status} · {item.action} · Dr. {item.requester_name} · {item.patient_name} · {fmt(item.created_at)}
              </div>
            ))}
          </div>
        </details>
      )}
    </Layout>
  )
}