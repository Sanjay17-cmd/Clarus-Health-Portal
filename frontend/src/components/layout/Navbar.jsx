import { useState, useRef, useEffect } from 'react'
import { useAuth } from '../../context/AuthContext'
import { notificationsApi } from '../../api/notifications'
import ThemeSwitcher from '../ui/ThemeSwitcher'

function timeAgo(dateStr) {
  const diff = Date.now() - new Date(dateStr).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 1) return 'Just now'
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  return `${Math.floor(h / 24)}d ago`
}

export default function Navbar({ title, onMenuClick }) {
  const { user } = useAuth()
  const [notifOpen, setNotifOpen] = useState(false)
  const [notifications, setNotifications] = useState([])
  const [unread, setUnread] = useState(0)
  const panelRef = useRef(null)

  const loadNotifications = () => {
    if (!user) return
    notificationsApi.list()
      .then(data => {
        setNotifications(data.items || [])
        setUnread(data.unread_count || 0)
      })
      .catch(() => {})
  }

  useEffect(() => {
    loadNotifications()
    // Poll every 30s for new notifications
    const interval = setInterval(loadNotifications, 30000)
    return () => clearInterval(interval)
  }, [user])

  // Close panel on outside click
  useEffect(() => {
    const handler = (e) => {
      if (panelRef.current && !panelRef.current.contains(e.target)) {
        setNotifOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const handleMarkRead = async (id) => {
    try {
      await notificationsApi.markRead(id)
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n))
      setUnread(prev => Math.max(0, prev - 1))
    } catch {}
  }

  const handleMarkAllRead = async () => {
    try {
      await notificationsApi.markAllRead()
      setNotifications(prev => prev.map(n => ({ ...n, is_read: true })))
      setUnread(0)
    } catch {}
  }

  const initials = user?.name
    ? user.name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)
    : '?'

  const pageName = user?.role === 'ADMIN' ? 'Admin Portal'
    : user?.role === 'DOCTOR' ? 'Doctor Dashboard'
    : user?.role === 'PATIENT' ? 'Patient Portal'
    : user?.role === 'LAB_TECHNICIAN' ? 'Lab Dashboard'
    : 'Clarus Health'

  return (
    <header className="navbar">
      {/* Mobile menu toggle */}
      <button
        className="navbar__menu-btn"
        onClick={onMenuClick}
        aria-label="Toggle sidebar"
      >
        ☰
      </button>

      <h1 className="navbar__title">{title || pageName}</h1>

      <div className="navbar__actions">
        <ThemeSwitcher />

        {/* Notifications */}
        <div style={{ position: 'relative' }} ref={panelRef}>
          <button
            id="notifications-btn"
            className="notification-btn"
            onClick={() => setNotifOpen(v => !v)}
            aria-label={`Notifications${unread > 0 ? ` — ${unread} unread` : ''}`}
          >
            🔔
            {unread > 0 && (
              <span className="notification-badge">{unread > 9 ? '9+' : unread}</span>
            )}
          </button>

          {notifOpen && (
            <div className="notif-panel">
              <div className="notif-panel__header">
                <span style={{ fontWeight: 700, fontSize: 'var(--text-sm)' }}>
                  Notifications {unread > 0 && <span className="badge badge-info">{unread} new</span>}
                </span>
                {unread > 0 && (
                  <button
                    style={{ fontSize: 'var(--text-xs)', color: 'var(--brand-primary)', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600 }}
                    onClick={handleMarkAllRead}
                  >
                    Mark all read
                  </button>
                )}
              </div>
              <div style={{ maxHeight: '360px', overflowY: 'auto' }}>
                {notifications.length === 0 ? (
                  <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: 'var(--text-sm)' }}>
                    <div style={{ fontSize: '2rem', marginBottom: 8 }}>🔔</div>
                    No notifications
                  </div>
                ) : (
                  notifications.map(n => (
                    <div
                      key={n.id}
                      className={`notif-item ${!n.is_read ? 'unread' : ''}`}
                      onClick={() => !n.is_read && handleMarkRead(n.id)}
                      style={{ display: 'flex', gap: '0.5rem', alignItems: 'flex-start', cursor: n.is_read ? 'default' : 'pointer' }}
                    >
                      <div style={{ flex: 1 }}>
                        <div className="notif-item__title">{n.title}</div>
                        <div className="notif-item__message">{n.message}</div>
                        <div className="notif-item__time">{timeAgo(n.created_at)}</div>
                      </div>
                      {!n.is_read && <div className="notif-unread-dot" />}
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        {/* User avatar */}
        <div className="user-avatar" title={user?.name}>{initials}</div>
      </div>
    </header>
  )
}
