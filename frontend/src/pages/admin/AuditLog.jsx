import { useState, useEffect } from 'react'
import Layout from '../../components/layout/Layout'
import Card from '../../components/ui/Card'
import { adminApi } from '../../api/admin'
import { StatusBadge } from '../../components/ui/Badge'

const EVENT_TYPES = [
  'LOGIN_SUCCESS', 'LOGIN_FAILED', 'USER_CREATED', 'USER_UPDATED', 'USER_APPROVED', 'USER_REJECTED',
  'USER_SUSPENDED', 'USER_REACTIVATED',
  'REPORT_GROUP_CREATED', 'REPORT_RECORD_CREATED', 'FILE_VIEWED', 'FILE_DOWNLOADED',
  'SHARE_CREATED', 'EXTERNAL_SHARE_CREATED', 'SHARE_REVOKED',
  'RECORD_DELETION_REQUESTED', 'RECORD_RESTORED', 'RECORD_PERMANENTLY_DELETED',
  'GROUP_SHARE_CREATED', 'GROUP_SHARE_UPDATED', 'GROUP_SHARE_REVOKED',
  'ZIP_EXPORTED', 'ZIP_IMPORTED',
  'BREAK_GLASS_REQUESTED', 'BREAK_GLASS_REVOKED', 'ABUSE_SUSPENSION',
  'DISPUTE_CREATED', 'DISPUTE_RESOLVED',
]

export default function AuditLog() {
  const [logs, setLogs] = useState([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [filters, setFilters] = useState({
    action: '',
    actor_id: '',
    target_type: '',
    target_id: '',
    page: 1,
    page_size: 50,
  })

  useEffect(() => {
    setLoading(true)
    setError(null)
    // Build clean params — omit empty strings
    const params = {}
    if (filters.action) params.action = filters.action
    if (filters.actor_id) params.actor_id = filters.actor_id
    if (filters.target_type) params.target_type = filters.target_type
    if (filters.target_id) params.target_id = filters.target_id
    params.page = filters.page
    params.page_size = filters.page_size

    adminApi.getAuditLogs(params)
      .then(res => {
        // res is already unwrapped by client interceptor → {items, total}
        setLogs(res.items || [])
        setTotal(res.total || 0)
      })
      .catch(err => {
        setError(err.message || 'Failed to load audit logs')
        setLogs([])
      })
      .finally(() => setLoading(false))
  }, [filters])

  const handleFilterChange = (e) => {
    const { name, value } = e.target
    setFilters(prev => ({ ...prev, [name]: value, page: 1 }))
  }

  const fmtDate = (d) => d ? new Date(d).toLocaleString('en-GB') : '—'

  const actionColor = (action) => {
    if (action.includes('FAILED') || action.includes('DELETE') || action.includes('SUSPENDED') || action.includes('REVOKED') || action.includes('REJECTED')) return 'REJECTED'
    if (action.includes('CREATED') || action.includes('RESTORED') || action.includes('APPROVED') || action.includes('REACTIVATED')) return 'ACTIVE'
    return 'PENDING'
  }

  return (
    <Layout>
      <div className="page-header">
        <div>
          <h1 className="page-title">📋 Audit Log</h1>
          <p className="page-subtitle">System-wide activity tracking and compliance logging</p>
        </div>
        {total > 0 && <div style={{ fontSize: 13, color: 'var(--text-muted)', alignSelf: 'center' }}>{total} total entries</div>}
      </div>

      {/* Filters */}
      <Card style={{ marginBottom: '1.5rem' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', alignItems: 'end' }}>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">Action / Event Type</label>
            <select className="form-input" name="action" value={filters.action} onChange={handleFilterChange}>
              <option value="">All Actions</option>
              {EVENT_TYPES.map(t => <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>)}
            </select>
          </div>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">Actor User ID</label>
            <input type="number" className="form-input" name="actor_id" placeholder="User ID..." value={filters.actor_id} onChange={handleFilterChange} />
          </div>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">Target Type</label>
            <input type="text" className="form-input" name="target_type" placeholder="e.g. ReportRecord" value={filters.target_type} onChange={handleFilterChange} />
          </div>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">Target ID</label>
            <input type="number" className="form-input" name="target_id" placeholder="Entity ID..." value={filters.target_id} onChange={handleFilterChange} />
          </div>
        </div>
      </Card>

      <Card>
        {error && (
          <div style={{ padding: '1rem', marginBottom: '1rem', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 8, color: '#f87171', fontSize: 14 }}>
            ⚠ Error loading audit logs: {error}
          </div>
        )}
        <div className="table-responsive">
          <table className="table">
            <thead>
              <tr>
                <th>Timestamp</th>
                <th>Action</th>
                <th>Actor</th>
                <th>IP Address</th>
                <th>Target</th>
                <th>Details</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan="6" style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
                  <div style={{ fontSize: '1.5rem', marginBottom: 8 }}>⏳</div>Loading audit logs...
                </td></tr>
              ) : logs.length === 0 ? (
                <tr><td colSpan="6" style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
                  <div style={{ fontSize: '2rem', marginBottom: 8 }}>📋</div>
                  No audit logs found
                  {(filters.action || filters.actor_id || filters.target_type || filters.target_id) && (
                    <div style={{ fontSize: 13, marginTop: 8 }}>
                      Try clearing the filters above
                    </div>
                  )}
                </td></tr>
              ) : (
                logs.map(log => (
                  <tr key={log.id}>
                    <td style={{ whiteSpace: 'nowrap', fontSize: 12 }}>{fmtDate(log.created_at)}</td>
                    <td>
                      <StatusBadge status={actionColor(log.action)} label={log.action.replace(/_/g, ' ')} />
                    </td>
                    <td>
                      {log.actor_email ? (
                        <div>
                          <div style={{ fontWeight: 500, fontSize: 13 }}>{log.actor_email}</div>
                          {log.actor_id && <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>ID: {log.actor_id}</div>}
                        </div>
                      ) : <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>System</span>}
                    </td>
                    <td style={{ fontFamily: 'monospace', fontSize: 11, color: 'var(--text-muted)' }}>{log.ip_address || '—'}</td>
                    <td>
                      {log.target_type && (
                        <div>
                          <span style={{ fontSize: 11, color: 'var(--text-muted)', background: 'var(--bg-surface-alt)', padding: '1px 6px', borderRadius: 4 }}>{log.target_type}</span>
                          {log.target_id && <div style={{ fontWeight: 600, fontSize: 13, marginTop: 2 }}>#{log.target_id}</div>}
                        </div>
                      )}
                    </td>
                    <td>
                      {log.details && (
                        <details>
                          <summary style={{ cursor: 'pointer', fontSize: 12, color: 'var(--brand-primary)', userSelect: 'none' }}>View JSON</summary>
                          <pre style={{ fontSize: '0.7rem', background: 'var(--bg-surface-alt)', padding: '0.5rem', borderRadius: '4px', marginTop: '0.5rem', maxWidth: '280px', overflowX: 'auto', whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
                            {JSON.stringify(log.details, null, 2)}
                          </pre>
                        </details>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        {/* Pagination */}
        {total > filters.page_size && (
          <div style={{ display: 'flex', justifyContent: 'center', gap: '0.5rem', marginTop: '1rem', paddingTop: '1rem', borderTop: '1px solid var(--border-subtle)' }}>
            <button className="btn btn--sm btn--secondary" disabled={filters.page <= 1} onClick={() => setFilters(p => ({ ...p, page: p.page - 1 }))}>← Prev</button>
            <span style={{ fontSize: 13, color: 'var(--text-muted)', alignSelf: 'center' }}>Page {filters.page} of {Math.ceil(total / filters.page_size)}</span>
            <button className="btn btn--sm btn--secondary" disabled={filters.page >= Math.ceil(total / filters.page_size)} onClick={() => setFilters(p => ({ ...p, page: p.page + 1 }))}>Next →</button>
          </div>
        )}
      </Card>
    </Layout>
  )
}
