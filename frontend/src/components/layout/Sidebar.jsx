import { NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'

const NAV = {
  ADMIN: [
    { label: 'Overview',            icon: '📊', to: '/admin' },
    { label: 'User Management',     icon: '👥', to: '/admin/users' },
    { label: 'Specializations',     icon: '🩺', to: '/admin/specializations' },
    { label: 'Audit Log',           icon: '📋', to: '/admin/audit' },
    { label: 'Corrections',         icon: '✏️',  to: '/admin/corrections' },
    { label: 'Suspended Records',   icon: '🔒', to: '/admin/suspended' },
    { label: 'Archive Provenance',  icon: '🗃️', to: '/admin/archive' },
    { label: 'Document Disputes',   icon: '📂', to: '/admin/disputes' },
  ],
  DOCTOR: [
    { label: 'Dashboard',       icon: '🏥', to: '/doctor' },
    { label: 'Shared Reports',  icon: '🤝', to: '/doctor/shared' },
  ],

  PATIENT: [
    { label: 'Dashboard',       icon: '👤', to: '/patient' },
    { label: 'Record Activity', icon: '📊', to: '/patient/activity' },
  ],
  LAB_TECHNICIAN: [
    { label: 'Dashboard', icon: '🔬', to: '/technician' },
  ],
}

export default function Sidebar({ open, onClose }) {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const items = NAV[user?.role] || []

  const initials = user?.name
    ? user.name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)
    : '?'

  const roleLabel = {
    ADMIN: 'Administrator',
    DOCTOR: 'Doctor',
    PATIENT: 'Patient',
    LAB_TECHNICIAN: 'Lab Technician',
  }[user?.role] || user?.role || ''

  const handleLogout = () => {
    logout()
    navigate('/login')
    onClose?.()
  }

  return (
    <aside className={`sidebar${open ? ' sidebar--open' : ''}`}>
      {/* Close button (mobile only) */}
      <button
        className="sidebar__close-btn"
        onClick={onClose}
        aria-label="Close sidebar"
      >✕</button>

      {/* Logo */}
      <div className="sidebar__logo">
        <div className="sidebar__logo-mark">🏥</div>
        <div>
          <div className="sidebar__brand">Clarus Health</div>
          <div className="sidebar__subtitle">Medical Portal</div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="sidebar__nav" aria-label="Main navigation">
        <div className="sidebar__section-label">Navigation</div>
        {items.map(item => (
          <NavLink
            key={item.to}
            to={item.to}
            end={['/admin', '/doctor', '/patient', '/technician'].includes(item.to)}
            className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
            onClick={onClose}
          >
            <span className="nav-item__icon">{item.icon}</span>
            {item.label}
          </NavLink>
        ))}
      </nav>

      {/* User footer */}
      <div className="sidebar__footer">
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.5rem 0.5rem 0.75rem' }}>
          <div className="user-avatar" style={{ cursor: 'default' }}>{initials}</div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 'var(--text-sm)', fontWeight: 600, color: 'rgba(255,255,255,0.9)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{user?.name}</div>
            <div style={{ fontSize: 'var(--text-xs)', color: 'rgba(255,255,255,0.4)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{roleLabel}</div>
          </div>
        </div>
        <button
          id="logout-btn"
          onClick={handleLogout}
          className="nav-item"
          style={{ color: 'rgba(255,100,100,0.8)' }}
        >
          <span className="nav-item__icon">🚪</span>
          Sign Out
        </button>
      </div>
    </aside>
  )
}
