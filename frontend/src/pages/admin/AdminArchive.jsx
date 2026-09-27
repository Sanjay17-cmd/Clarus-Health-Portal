import { useState, useEffect } from 'react'
import Layout from '../../components/layout/Layout'
import { getExports, getImports } from '../../api/admin_reports'

const fmt = (d) => d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—'

export default function AdminArchive() {
  const [tab, setTab] = useState('exports')
  const [exports_, setExports] = useState([])
  const [imports, setImports] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([getExports(), getImports()])
      .then(([e, i]) => { setExports(e); setImports(i) })
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  const data = tab === 'exports' ? exports_ : imports

  return (
    <Layout>
      <div className="page-header">
        <h1 className="page-title">Archive Provenance</h1>
        <p className="page-subtitle">Track ZIP exports and imports. File contents are not accessible from this panel.</p>
      </div>

      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem' }}>
        <button className={`btn btn--sm ${tab === 'exports' ? 'btn--primary' : 'btn--secondary'}`} onClick={() => setTab('exports')}>📤 Exports ({exports_.length})</button>
        <button className={`btn btn--sm ${tab === 'imports' ? 'btn--primary' : 'btn--secondary'}`} onClick={() => setTab('imports')}>📥 Imports ({imports.length})</button>
      </div>

      {loading ? <div className="card animate-pulse" style={{ height: 200 }} /> : (
        data.length === 0 ? (
          <div className="card" style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>No {tab} yet</div>
        ) : (
          <div className="card" style={{ overflow: 'hidden' }}>
            {tab === 'exports' ? (
              <table className="table">
                <thead><tr><th>Export ID</th><th>Exported By</th><th>Patient</th><th>Group</th><th>Records</th><th>Files</th><th>Date</th></tr></thead>
                <tbody>
                  {exports_.map(e => (
                    <tr key={e.id}>
                      <td><code style={{ fontSize: 11 }}>{e.id.slice(0, 8)}…</code></td>
                      <td>{e.exporter_name}</td>
                      <td>{e.patient_name}</td>
                      <td>{e.group_title}</td>
                      <td>{Array.isArray(e.record_ids) ? e.record_ids.length : '?'} records</td>
                      <td>{e.file_count}</td>
                      <td>{fmt(e.created_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <table className="table">
                <thead><tr><th>Import ID</th><th>Imported By</th><th>Patient</th><th>Original Exporter</th><th>Records</th><th>Files</th><th>Date</th></tr></thead>
                <tbody>
                  {imports.map(i => (
                    <tr key={i.id}>
                      <td><code style={{ fontSize: 11 }}>{i.id.slice(0, 8)}…</code></td>
                      <td>{i.importer_name}</td>
                      <td>{i.patient_name}</td>
                      <td>{i.original_exporter_name || <em style={{ color: 'var(--text-muted)' }}>Unknown</em>}</td>
                      <td>{Array.isArray(i.record_ids_imported) ? i.record_ids_imported.length : '?'}</td>
                      <td>{i.file_count}</td>
                      <td>{fmt(i.created_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )
      )}
    </Layout>
  )
}
