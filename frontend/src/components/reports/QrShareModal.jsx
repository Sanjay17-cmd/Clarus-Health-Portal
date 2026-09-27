import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { sharesApi } from '../../api'
import { useToast } from '../ui/Toast'
import Button from '../ui/Button'

export default function QrShareModal({ onClose, record }) {
  const toast = useToast()
  const [shares, setShares] = useState([])
  const [label, setLabel] = useState('')
  const [creating, setCreating] = useState(false)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!record) return
    setLoading(true)
    sharesApi.listExternalShares(record.id)
      .then(setShares)
      .catch(() => toast.error('Error', 'Failed to load shares'))
      .finally(() => setLoading(false))
  }, [record])

  const handleCreate = async () => {
    setCreating(true)
    try {
      const share = await sharesApi.createExternalShare({ record_id: record.id, label: label || null })
      setShares(prev => [share, ...prev])
      setLabel('')
      toast.success('Share link created', 'QR code generated.')
    } catch (err) {
      toast.error('Failed', err.message)
    } finally {
      setCreating(false)
    }
  }

  const handleRevoke = async (shareId) => {
    try {
      await sharesApi.revokeExternalShare(shareId)
      setShares(prev => prev.filter(s => s.id !== shareId))
      toast.success('Share revoked')
    } catch (err) {
      toast.error('Error', err.message)
    }
  }

  const copyLink = (url) => {
    navigator.clipboard.writeText(url)
      .then(() => toast.success('Copied!', 'Link copied to clipboard'))
      .catch(() => toast.error('Error', 'Could not copy to clipboard'))
  }

  if (!record) return null

  return createPortal(
    <div className="modal-overlay" onClick={onClose} role="dialog" aria-modal="true" aria-label="QR Share">
      <div
        className="modal-box modal-box-lg"
        onClick={e => e.stopPropagation()}
        style={{ maxWidth: 580, width: '95vw', maxHeight: '90vh', overflowY: 'auto' }}
      >
        <div className="modal-header">
          <h2 className="modal-title">📱 External Share & QR Code</h2>
          <button className="modal-close" onClick={onClose} aria-label="Close">✕</button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <div className="alert alert-warning" style={{ fontSize: 'var(--text-xs)' }}>
            <span>⚠️</span>
            <span>External links are <strong>view-only</strong>. Recipients cannot download or delegate. The link contains no patient data.</span>
          </div>

          {/* Create new share */}
          <div style={{ background: 'var(--bg-surface-alt)', borderRadius: 'var(--radius-md)', padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <div style={{ fontSize: 'var(--text-sm)', fontWeight: 600 }}>Create New Share Link</div>
            <div className="form-group">
              <label className="form-label">Label (optional)</label>
              <input className="form-input" placeholder='e.g. "For Dr. Kumar"' value={label} onChange={e => setLabel(e.target.value)} />
            </div>
            <Button variant="primary" size="sm" onClick={handleCreate} loading={creating}>
              🔗 Generate QR + Link
            </Button>
          </div>

          {/* Existing shares */}
          {loading && <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '1rem' }}>Loading…</div>}
          {!loading && shares.map(share => (
            <div key={share.id} style={{ border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md)', padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                  <div style={{ fontWeight: 600, fontSize: 'var(--text-sm)' }}>{share.label || 'Untitled share'}</div>
                  <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>
                    Accessed {share.access_count} time(s) · Created {new Date(share.created_at).toLocaleDateString('en-GB')}
                  </div>
                </div>
                <button
                  onClick={() => handleRevoke(share.id)}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-red-500)', fontSize: 'var(--text-sm)' }}
                  title="Revoke this share"
                >Revoke</button>
              </div>

              {/* QR code */}
              {share.qr_base64 && (
                <div style={{ display: 'flex', gap: '1rem', alignItems: 'flex-start' }}>
                  <img
                    src={`data:image/png;base64,${share.qr_base64}`}
                    alt="QR code"
                    style={{ width: 120, height: 120, borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)' }}
                    onContextMenu={e => e.preventDefault()}
                  />
                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', wordBreak: 'break-all', fontFamily: 'monospace', background: 'var(--bg-surface-alt)', padding: '0.4rem 0.6rem', borderRadius: 'var(--radius-sm)' }}>
                      {share.share_url}
                    </div>
                    <Button size="sm" variant="secondary" onClick={() => copyLink(share.share_url)}>
                      📋 Copy Link
                    </Button>
                  </div>
                </div>
              )}
            </div>
          ))}

          {!loading && shares.length === 0 && (
            <div style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: 'var(--text-sm)', padding: '1rem' }}>
              No external shares yet. Create one above.
            </div>
          )}

          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <Button variant="ghost" onClick={onClose}>Close</Button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  )
}
