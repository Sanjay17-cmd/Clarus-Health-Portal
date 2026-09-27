import { useState, useEffect } from 'react'
import Layout from '../../components/layout/Layout'
import { getMyActivity } from '../../api/patient_activity'

const EVENT_ICONS = {
  VIEWED: '👁',
  DOWNLOADED: '⬇️',
  SHARED: '🤝',
  ZIP_EXPORTED: '📤',
  ZIP_IMPORTED: '📥',
  EXTERNAL_SHARE_CREATED: '🔗',
  EXTERNAL_SHARE_ACCESSED: '🌐',
  CORRECTION_CREATED: '✏️',
  DELETION_REQUESTED: '🗑',
  DISPUTE_CREATED: '📋',
  BREAK_GLASS: '🚨',
  RECORD_SUSPENDED: '🔒',
  RECORD_RESTORED: '♻️',
  DEFAULT: '📌',
}

const EVENT_COLORS = {
  BREAK_GLASS: '#f87171',
  DOWNLOADED: '#60a5fa',
  ZIP_EXPORTED: '#60a5fa',
  ZIP_IMPORTED: '#a78bfa',
  DELETION_REQUESTED: '#f97316',
  DISPUTE_CREATED: '#fbbf24',
  SHARED: '#34d399',
  VIEWED: 'var(--text-muted)',
}

function EventItem({ ev }) {
  const icon = EVENT_ICONS[ev.event_type] || EVENT_ICONS.DEFAULT
  const color = EVENT_COLORS[ev.event_type] || 'var(--text-primary)'
  const isEmergency = ev.event_type === 'BREAK_GLASS' || ev.break_glass_request_id

  const describe = () => {
    const actor = ev.actor_name ? (ev.actor_role === 'DOCTOR' ? `Dr. ${ev.actor_name}` : ev.actor_name) : 'Someone'
    const grp = ev.group_title ? ` in "${ev.group_title}"` : ''
    switch (ev.event_type) {
      case 'VIEWED': return `${actor} viewed your record${grp}`
      case 'DOWNLOADED': return `${actor} downloaded your record${grp}`
      case 'SHARED': return `Your record${grp} was shared`
      case 'ZIP_EXPORTED': return `${actor} exported your records as a ZIP archive${grp}`
      case 'ZIP_IMPORTED': return `Records${grp} were imported — originally exported by ${ev.details?.original_exporter || 'another doctor'}`
      case 'EXTERNAL_SHARE_CREATED': return `A public share link was created for your record${grp}`
      case 'EXTERNAL_SHARE_ACCESSED': return `Your shared record${grp} was accessed by an external viewer`
      case 'CORRECTION_CREATED': return `A correction was uploaded for your record${grp}`
      case 'DELETION_REQUESTED': return `A deletion was requested for your record${grp}`
      case 'DISPUTE_CREATED': return `You filed a dispute for a record${grp}`
      case 'BREAK_GLASS': return `${actor} requested emergency access to your records`
      case 'RECORD_SUSPENDED': return `A record${grp} was suspended pending review`
      case 'RECORD_RESTORED': return `A suspended record${grp} was restored`
      default: return `${ev.event_type.replace(/_/g, ' ')} on your record${grp}`
    }
  }

  return (
    <div style={{
      display: 'flex', gap: '1rem', padding: '0.875rem 1rem',
      borderRadius: 10, border: `1px solid ${isEmergency ? 'rgba(248,113,113,0.3)' : 'var(--border-subtle)'}`,
      background: isEmergency ? 'rgba(248,113,113,0.04)' : 'var(--bg-surface)',
      alignItems: 'flex-start'
    }}>
      <div style={{ fontSize: '1.4rem', flexShrink: 0, marginTop: 2 }}>{icon}</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ color, fontWeight: isEmergency ? 700 : 500, fontSize: 14 }}>{describe()}</div>
        {ev.details?.notes && <div style={{ color: 'var(--text-muted)', fontSize: 12, marginTop: 2, fontStyle: 'italic' }}>{ev.details.notes}</div>}
        {isEmergency && ev.break_glass_request_id && (
          <div style={{ fontSize: 11, color: '#f87171', marginTop: 2 }}>Emergency Request #{ev.break_glass_request_id}</div>
        )}
      </div>
      <div style={{ color: 'var(--text-muted)', fontSize: 12, whiteSpace: 'nowrap', flexShrink: 0 }}>
        {new Date(ev.created_at).toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
      </div>
    </div>
  )
}

export default function PatientActivity() {
  const [events, setEvents] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('')

  useEffect(() => {
    getMyActivity(200).then(r => setEvents(Array.isArray(r) ? r : [])).catch(console.error).finally(() => setLoading(false))
  }, [])

  const filtered = filter ? events.filter(e => e.event_type === filter) : events
  const uniqueTypes = [...new Set(events.map(e => e.event_type))]

  return (
    <Layout>
      <div className="page-header">
        <h1 className="page-title">📊 Record Activity</h1>
        <p className="page-subtitle">Everything Clarus can observe about who accessed your medical records.</p>
      </div>

      {events.some(e => e.event_type === 'BREAK_GLASS') && (
        <div style={{ padding: '1rem', borderRadius: 10, background: 'rgba(248,113,113,0.08)', border: '1px solid rgba(248,113,113,0.3)', marginBottom: '1.5rem', display: 'flex', gap: '1rem', alignItems: 'center' }}>
          <div style={{ fontSize: '2rem' }}>🚨</div>
          <div>
            <div style={{ fontWeight: 700, color: '#f87171' }}>Emergency Access Recorded</div>
            <div style={{ fontSize: 13, color: 'rgba(248,113,113,0.8)' }}>One or more doctors have used emergency Break-Glass access to view your records. These events are permanently audited.</div>
          </div>
        </div>
      )}

      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
        <button className={`btn btn--sm ${!filter ? 'btn--primary' : 'btn--secondary'}`} onClick={() => setFilter('')}>All ({events.length})</button>
        {uniqueTypes.map(t => (
          <button key={t} className={`btn btn--sm ${filter === t ? 'btn--primary' : 'btn--secondary'}`} onClick={() => setFilter(t)} style={t === 'BREAK_GLASS' ? { borderColor: '#f87171', color: filter === t ? '#fff' : '#f87171' } : {}}>
            {EVENT_ICONS[t] || '📌'} {t.replace(/_/g, ' ')}
          </button>
        ))}
      </div>

      {loading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          {[...Array(5)].map((_, i) => <div key={i} className="card animate-pulse" style={{ height: 70 }} />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="card" style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
          <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>📊</div>
          <div>No activity events to display</div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          {filtered.map(ev => <EventItem key={ev.id} ev={ev} />)}
        </div>
      )}
    </Layout>
  )
}
