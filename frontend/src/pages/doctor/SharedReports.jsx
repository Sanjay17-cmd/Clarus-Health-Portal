/**
 * SharedReports — Doctor's incoming shares panel (Phase 4)
 * Shows PENDING shares (Accept button) and ACCEPTED shares (Delegate, View)
 */
import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import Layout from '../../components/layout/Layout'
import Card from '../../components/ui/Card'
import { sharesApi } from '../../api/shares'
import { useToast } from '../../components/ui/Toast'
import client from '../../api/client'

const STATUS_PILL = {
  PENDING:  { bg: 'rgba(245,158,11,0.12)', color: '#d97706', label: '⏳ Pending' },
  ACCEPTED: { bg: 'rgba(34,197,94,0.12)',  color: '#16a34a', label: '✅ Accepted' },
  REVOKED:  { bg: 'rgba(239,68,68,0.12)',  color: '#ef4444', label: '🚫 Revoked' },
}

function ScopeTag({ share }) {
  const versions = share.allowed_record_ids
    ? `${share.allowed_record_ids.length} version(s)`
    : share.max_versions > 0
    ? `Latest ${share.max_versions}`
    : 'All versions'
  return (
    <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', marginTop: '0.35rem' }}>
      <span style={{ padding: '2px 8px', borderRadius: 99, fontSize: 11, fontWeight: 700, background: 'rgba(13,169,167,0.1)', color: 'var(--brand-primary)' }}>
        👁 {versions}
      </span>
      {share.can_download && (
        <span style={{ padding: '2px 8px', borderRadius: 99, fontSize: 11, fontWeight: 700, background: 'rgba(59,130,246,0.1)', color: '#3b82f6' }}>⬇ Download</span>
      )}
      {share.can_delegate && (
        <span style={{ padding: '2px 8px', borderRadius: 99, fontSize: 11, fontWeight: 700, background: 'rgba(245,158,11,0.1)', color: '#d97706' }}>🔄 Can Delegate</span>
      )}
      {share.parent_share_id && (
        <span style={{ padding: '2px 8px', borderRadius: 99, fontSize: 11, fontWeight: 700, background: 'rgba(139,92,246,0.1)', color: '#7c3aed' }}>↗ Delegated</span>
      )}
    </div>
  )
}

function DelegateModal({ share, onClose, onSuccess }) {
  const [search, setSearch] = useState('')
  const [results, setResults] = useState([])
  const [selected, setSelected] = useState(null)
  const [canDownload, setCanDownload] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const toast = useToast()
  const [searching, setSearching] = useState(false)

  useEffect(() => {
    if (search.length < 2) { setResults([]); return }
    setSearching(true)
    const t = setTimeout(() => {
      client.get('/patient/doctors', { params: { search } })
        .then(r => setResults(Array.isArray(r) ? r : []))
        .catch(() => setResults([]))
        .finally(() => setSearching(false))
    }, 300)
    return () => clearTimeout(t)

  }, [search])

  const handleSubmit = async () => {
    if (!selected) return
    setSubmitting(true)
    try {
      await sharesApi.delegateShare(share.id, {
        grantee_user_id: selected.id,
        can_download: canDownload && share.can_download,
      })
      toast.success('Delegated', `Access shared with Dr. ${selected.name}`)
      onSuccess?.()
      onClose()
    } catch (err) {
      toast.error('Delegation failed', err.message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 9500, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
      <div className="modal" style={{ maxWidth: 460, width: '100%' }}>
        <div className="modal__header">
          <h2 className="modal__title">🔄 Delegate Access</h2>
          <button className="modal__close" onClick={onClose}>✕</button>
        </div>
        <div className="modal__body">
          <div style={{ padding: '0.75rem', background: 'rgba(245,158,11,0.06)', border: '1px solid rgba(245,158,11,0.2)', borderRadius: 8, fontSize: 13, color: 'var(--text-muted)', marginBottom: '1rem' }}>
            ⚠ You may only share within the scope granted to you. The new doctor will receive at most what you were given.
          </div>

          <div className="form-group">
            <label className="form-label">Search Doctor *</label>
            {selected ? (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.625rem 0.875rem', border: '2px solid var(--brand-primary)', borderRadius: 8, background: 'rgba(13,169,167,0.06)' }}>
                <div>
                  <div style={{ fontWeight: 600 }}>Dr. {selected.name}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{selected.email}</div>
                </div>
                <button onClick={() => { setSelected(null); setSearch('') }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: 18 }}>✕</button>
              </div>
            ) : (
              <div style={{ position: 'relative' }}>
                <input type="text" className="form-input" placeholder="Type doctor's name…" value={search} onChange={e => setSearch(e.target.value)} autoFocus />
                {(results.length > 0 || searching) && (
                  <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 10, background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: 8, boxShadow: '0 8px 24px rgba(0,0,0,0.2)', marginTop: 4, maxHeight: 200, overflowY: 'auto' }}>
                    {searching && <div style={{ padding: '0.75rem', color: 'var(--text-muted)', fontSize: 13 }}>Searching…</div>}
                    {results.map(d => (
                      <div key={d.id} onClick={() => { setSelected(d); setSearch(''); setResults([]) }}
                        style={{ padding: '0.625rem 0.875rem', cursor: 'pointer', borderBottom: '1px solid var(--border-subtle)' }}
                        onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-surface-alt)'}
                        onMouseLeave={e => e.currentTarget.style.background = ''}>
                        <div style={{ fontWeight: 600 }}>Dr. {d.name}</div>
                        <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{d.email}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {share.can_download && (
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: 13, cursor: 'pointer', marginTop: '0.5rem' }}>
              <input type="checkbox" checked={canDownload} onChange={e => setCanDownload(e.target.checked)} />
              Allow this doctor to download (you have download permission)
            </label>
          )}
        </div>
        <div className="modal__footer">
          <button className="btn btn--secondary" onClick={onClose}>Cancel</button>
          <button className="btn btn--primary" onClick={handleSubmit} disabled={!selected || submitting}>
            {submitting ? 'Delegating…' : '🔄 Delegate Access'}
          </button>
        </div>
      </div>
    </div>
  )
}

function ShareCard({ share, onAccept, onDelegate, accepting }) {
  const pill = STATUS_PILL[share.status] || STATUS_PILL.PENDING
  const fmtDate = d => d ? new Date(d).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' }) : '—'

  return (
    <div className="card" style={{
      border: `2px solid ${share.status === 'PENDING' ? 'rgba(245,158,11,0.35)' : share.status === 'ACCEPTED' ? 'rgba(34,197,94,0.25)' : 'rgba(239,68,68,0.2)'}`,
      transition: 'box-shadow 0.2s',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '1rem', flexWrap: 'wrap' }}>
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
            <span style={{ fontWeight: 700, fontSize: 16 }}>
              {share.group_title || `Group #${share.group_id}`}
            </span>
            <span style={{ padding: '2px 10px', borderRadius: 99, fontSize: 11, fontWeight: 700, background: pill.bg, color: pill.color }}>{pill.label}</span>
          </div>
          <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>
            From: <strong>{share.patient_name ? `Patient: ${share.patient_name}` : `Patient #${share.patient_id}`}</strong>
            {share.parent_share_id && <span style={{ marginLeft: 6, fontSize: 11, color: '#7c3aed' }}>(delegated share)</span>}
          </div>
          <ScopeTag share={share} />
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: '0.35rem' }}>
            Shared: {fmtDate(share.created_at)}
            {share.accepted_at && ` · Accepted: ${fmtDate(share.accepted_at)}`}
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', minWidth: 140 }}>
          {share.status === 'PENDING' && (
            <button
              className="btn btn--primary btn--sm"
              onClick={() => onAccept(share.id)}
              disabled={accepting === share.id}
              style={{ width: '100%' }}
            >
              {accepting === share.id ? 'Accepting…' : '✅ Accept Share'}
            </button>
          )}
          {share.status === 'ACCEPTED' && share.can_delegate && (
            <button className="btn btn--secondary btn--sm" onClick={() => onDelegate(share)} style={{ width: '100%' }}>
              🔄 Delegate
            </button>
          )}
          {share.status === 'ACCEPTED' && (
            <div style={{ fontSize: 11, color: '#16a34a', textAlign: 'center' }}>
              View in Dashboard
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default function SharedReports() {
  const [shares, setShares] = useState([])
  const [loading, setLoading] = useState(true)
  const [accepting, setAccepting] = useState(null)
  const [delegateTarget, setDelegateTarget] = useState(null)
  const [filter, setFilter] = useState('ALL') // ALL | PENDING | ACCEPTED
  const toast = useToast()
  const navigate = useNavigate()

  const load = () => {
    setLoading(true)
    sharesApi.myShares()
      .then(r => setShares(Array.isArray(r) ? r : []))
      .catch(err => toast.error('Failed to load shares', err.message))
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [])

  const handleAccept = async (shareId) => {
    setAccepting(shareId)
    try {
      await sharesApi.acceptShare(shareId)
      toast.success('Share accepted', 'The report group is now available in your dashboard.')
      load()
    } catch (err) {
      toast.error('Accept failed', err.message)
    } finally {
      setAccepting(null)
    }
  }

  const pending = shares.filter(s => s.status === 'PENDING')
  const accepted = shares.filter(s => s.status === 'ACCEPTED')
  const filtered = filter === 'PENDING' ? pending : filter === 'ACCEPTED' ? accepted : shares

  return (
    <Layout>
      <div className="page-header">
        <div>
          <h1 className="page-title">🤝 Shared Reports</h1>
          <p className="page-subtitle">Report groups shared with you by patients or colleagues</p>
        </div>
        <div style={{ display: 'flex', gap: '0.4rem', alignSelf: 'center' }}>
          {[['ALL', `All (${shares.length})`], ['PENDING', `⏳ Pending (${pending.length})`], ['ACCEPTED', `✅ Accepted (${accepted.length})`]].map(([v, label]) => (
            <button key={v} onClick={() => setFilter(v)}
              className={`btn btn--sm ${filter === v ? 'btn--primary' : 'btn--secondary'}`}>
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Pending alert banner */}
      {pending.length > 0 && (
        <div style={{ padding: '0.75rem 1rem', background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.3)', borderRadius: 10, marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <span style={{ fontSize: '1.25rem' }}>⏳</span>
          <div>
            <div style={{ fontWeight: 700, fontSize: 14 }}>{pending.length} pending share{pending.length > 1 ? 's' : ''} waiting for your acknowledgement</div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Accept to make these reports available in your dashboard.</div>
          </div>
        </div>
      )}

      {loading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {[1, 2, 3].map(i => <div key={i} className="card animate-pulse" style={{ height: 100 }} />)}
        </div>
      ) : filtered.length === 0 ? (
        <Card>
          <div style={{ textAlign: 'center', padding: '3rem 1rem', color: 'var(--text-muted)' }}>
            <div style={{ fontSize: '3rem', marginBottom: '0.75rem' }}>🤝</div>
            <div style={{ fontWeight: 600, fontSize: 16, marginBottom: 4 }}>No shared reports</div>
            <div style={{ fontSize: 13 }}>When patients share report groups with you, they will appear here.</div>
          </div>
        </Card>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {filtered.map(share => (
            <ShareCard
              key={share.id}
              share={share}
              onAccept={handleAccept}
              onDelegate={setDelegateTarget}
              accepting={accepting}
            />
          ))}
        </div>
      )}

      {/* Delegation modal */}
      {delegateTarget && (
        <DelegateModal
          share={delegateTarget}
          onClose={() => setDelegateTarget(null)}
          onSuccess={load}
        />
      )}
    </Layout>
  )
}
