import { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import SecureViewer from '../../components/reports/SecureViewer'
import RecordTypeTag from '../../components/reports/RecordTypeTag'
import { sharesApi } from '../../api/shares'

const GLASS = {
  background: 'rgba(255,255,255,0.07)',
  backdropFilter: 'blur(18px)',
  WebkitBackdropFilter: 'blur(18px)',
  border: '1px solid rgba(255,255,255,0.13)',
  borderRadius: 16,
}

function Spinner() {
  return (
    <div style={{ width: 40, height: 40, border: '3px solid rgba(255,255,255,0.12)', borderTopColor: '#0da9a7', borderRadius: '50%', animation: 'sv-spin 0.8s linear infinite' }}>
      <style>{`@keyframes sv-spin { to { transform: rotate(360deg) } }`}</style>
    </div>
  )
}

export default function SharedView() {
  const { token } = useParams()
  const [record, setRecord] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [viewerOpen, setViewerOpen] = useState(false)

  useEffect(() => {
    sharesApi.getPublicRecord(token)
      .then(data => {
        setRecord(data)
        setViewerOpen(true)
      })
      .catch(err => setError(err?.response?.data?.detail || err.message || 'This share link is invalid or has been revoked.'))
      .finally(() => setLoading(false))
  }, [token])

  const BG = (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 0,
      background: 'linear-gradient(135deg, #0b1e35 0%, #0d2540 50%, #091827 100%)',
    }}>
      {/* subtle grid */}
      <div style={{ position: 'absolute', inset: 0, backgroundImage: 'radial-gradient(circle, rgba(13,169,167,0.06) 1px, transparent 1px)', backgroundSize: '32px 32px' }} />
    </div>
  )

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative', fontFamily: 'Inter, sans-serif' }}>
        {BG}
        <div style={{ ...GLASS, padding: '2.5rem 3rem', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1.25rem', position: 'relative', zIndex: 1 }}>
          <div style={{ fontSize: '2rem' }}>🏥</div>
          <div style={{ color: '#fff', fontWeight: 600, fontSize: '1.05rem' }}>Loading Secure Viewer…</div>
          <Spinner />
          <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: 12 }}>Clarus Health · Encrypted Share</div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative', fontFamily: 'Inter, sans-serif', padding: '2rem' }}>
        {BG}
        <div style={{ ...GLASS, padding: '2.5rem', maxWidth: 460, width: '100%', textAlign: 'center', position: 'relative', zIndex: 1 }}>
          <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🔒</div>
          <div style={{ color: '#fff', fontSize: '1.2rem', fontWeight: 700, marginBottom: '0.75rem' }}>Share Link Unavailable</div>
          <div style={{ color: 'rgba(255,255,255,0.55)', fontSize: '0.9rem', lineHeight: 1.65, marginBottom: '1.25rem' }}>{error}</div>
          <div style={{ padding: '0.75rem 1rem', background: 'rgba(13,169,167,0.1)', border: '1px solid rgba(13,169,167,0.25)', borderRadius: 10, color: 'rgba(255,255,255,0.45)', fontSize: 12 }}>
            If you received this link from a patient, please ask them to generate a new share link.
          </div>
          <div style={{ marginTop: '1.5rem', color: 'rgba(255,255,255,0.2)', fontSize: 11 }}>Clarus Health Portal · Secure Document Sharing</div>
        </div>
      </div>
    )
  }

  if (!record) return null

  const files = record.files || []

  return (
    <>
      {/* Background landing */}
      <div style={{
        minHeight: '100vh', position: 'relative',
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        fontFamily: 'Inter, sans-serif', color: '#fff', gap: '1rem',
      }}>
        {BG}

        {/* Info card */}
        <div style={{ ...GLASS, padding: '2rem 2.5rem', textAlign: 'center', position: 'relative', zIndex: 1, maxWidth: 400 }}>
          <div style={{ fontSize: '2.25rem', marginBottom: '0.5rem' }}>🏥</div>
          <div style={{ fontWeight: 700, fontSize: '1.15rem', marginBottom: 4 }}>Clarus Health Portal</div>
          <div style={{ color: 'rgba(255,255,255,0.45)', fontSize: '0.8rem', marginBottom: '1.25rem' }}>Secure Document Viewer</div>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', marginBottom: '0.5rem', flexWrap: 'wrap' }}>
            <RecordTypeTag type={record.record_type} />
            <span style={{ color: 'rgba(255,255,255,0.65)', fontSize: '0.875rem' }}>{record.group_title}</span>
          </div>

          <div style={{ color: 'rgba(255,255,255,0.35)', fontSize: '0.75rem', marginBottom: '1.25rem' }}>
            {files.length} file{files.length !== 1 ? 's' : ''} · View only
          </div>

          {files.length > 0 && (
            <button
              className="btn btn--primary"
              style={{ width: '100%' }}
              onClick={() => setViewerOpen(true)}
            >
              📄 Open Document Viewer
            </button>
          )}
        </div>

        <div style={{ position: 'relative', zIndex: 1, color: 'rgba(255,255,255,0.18)', fontSize: 11 }}>
          Clarus Health · Encrypted · Audit-logged
        </div>
      </div>

      {/* SecureViewer — uses token for file fetching */}
      {viewerOpen && files.length > 0 && (
        <SecureViewer
          files={files}
          initialIndex={0}
          token={token}
          canDownload={false}
          onClose={() => setViewerOpen(false)}
        />
      )}
    </>
  )
}
