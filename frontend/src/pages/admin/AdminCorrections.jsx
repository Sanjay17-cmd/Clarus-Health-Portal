import { useState, useEffect } from 'react'
import Layout from '../../components/layout/Layout'
import { getCorrections } from '../../api'

const fmt = (d) => d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—'

export default function AdminCorrections() {
  const [corrections, setCorrections] = useState([])
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState(null)

  useEffect(() => {
    getCorrections().then(setCorrections).catch(console.error).finally(() => setLoading(false))
  }, [])

  return (
    <Layout>
      <div className="page-header">
        <h1 className="page-title">Corrections Review</h1>
        <p className="page-subtitle">View correction records and their originals. No file content is accessible here.</p>
      </div>

      {loading ? <div className="card animate-pulse" style={{ height: 200 }} /> : (
        corrections.length === 0 ? (
          <div className="card" style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>✅ No correction records found</div>
        ) : (
          <div className="card" style={{ overflow: 'hidden' }}>
            <table className="table">
              <thead><tr>
                <th>Patient</th><th>Group</th><th>Technician</th><th>Correction Date</th><th>Files</th><th>Status</th><th>Details</th>
              </tr></thead>
              <tbody>
                {corrections.map(c => (<>
                  <tr key={c.correction_id} style={{ cursor: 'pointer' }} onClick={() => setExpanded(expanded === c.correction_id ? null : c.correction_id)}>
                    <td>{c.patient_name || `ID ${c.patient_id}`}</td>
                    <td><strong>{c.group_title}</strong></td>
                    <td>{c.technician_name}</td>
                    <td>{fmt(c.correction_date)}</td>
                    <td>{c.file_count} file(s)</td>
                    <td><span className={`badge ${c.suspension_status === 'ACTIVE' ? 'badge--success' : 'badge--warning'}`}>{c.suspension_status}</span></td>
                    <td><button className="btn btn--sm btn--secondary">{expanded === c.correction_id ? '▲ Hide' : '▼ Show'}</button></td>
                  </tr>
                  {expanded === c.correction_id && (
                    <tr key={`detail-${c.correction_id}`}>
                      <td colSpan={7} style={{ background: 'var(--bg-surface-alt)', padding: '1rem' }}>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                          <div style={{ padding: '1rem', borderRadius: 8, background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)' }}>
                            <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', marginBottom: '0.5rem', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Original Record</div>
                            <div><span style={{ color: 'var(--text-muted)', fontSize: 12 }}>Date:</span> <strong>{fmt(c.original_record_date)}</strong></div>
                            <div><span style={{ color: 'var(--text-muted)', fontSize: 12 }}>Type:</span> {c.original_record_type}</div>
                            <div><span style={{ color: 'var(--text-muted)', fontSize: 12 }}>Technician:</span> {c.original_technician_name}</div>
                            <div><span style={{ color: 'var(--text-muted)', fontSize: 12 }}>Notes:</span> {c.original_notes || '—'}</div>
                            <div><span style={{ color: 'var(--text-muted)', fontSize: 12 }}>Uploaded:</span> {fmt(c.original_created_at)}</div>
                          </div>
                          <div style={{ padding: '1rem', borderRadius: 8, background: 'var(--bg-surface)', border: '2px solid rgba(13,169,167,0.3)' }}>
                            <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--brand-primary)', marginBottom: '0.5rem', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Correction</div>
                            <div><span style={{ color: 'var(--text-muted)', fontSize: 12 }}>Date:</span> <strong>{fmt(c.correction_date)}</strong></div>
                            <div><span style={{ color: 'var(--text-muted)', fontSize: 12 }}>Technician:</span> {c.technician_name}</div>
                            <div><span style={{ color: 'var(--text-muted)', fontSize: 12 }}>Notes:</span> {c.correction_notes || '—'}</div>
                            <div><span style={{ color: 'var(--text-muted)', fontSize: 12 }}>Files:</span> {c.file_names?.join(', ') || '—'}</div>
                            <div><span style={{ color: 'var(--text-muted)', fontSize: 12 }}>Submitted:</span> {fmt(c.correction_created_at)}</div>
                          </div>
                        </div>
                        <div style={{ marginTop: '0.5rem', fontSize: 12, color: 'var(--text-muted)', fontStyle: 'italic' }}>
                          ℹ Admin cannot view or download the medical file contents.
                        </div>
                      </td>
                    </tr>
                  )}
                </>))}
              </tbody>
            </table>
          </div>
        )
      )}
    </Layout>
  )
}
