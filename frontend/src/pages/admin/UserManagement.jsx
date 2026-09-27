import { useState, useEffect, useCallback } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import Layout from '../../components/layout/Layout'
import Loading from '../../components/ui/Loading'
import Button from '../../components/ui/Button'
import Modal from '../../components/ui/Modal'
import Input from '../../components/ui/Input'
import Select from '../../components/ui/Select'
import { StatusBadge, RoleBadge } from '../../components/ui/Badge'
import EmptyState from '../../components/ui/EmptyState'
import { adminApi } from '../../api/admin'
import { useToast } from '../../components/ui/Toast'

const ROLES = ['', 'PATIENT', 'DOCTOR', 'LAB_TECHNICIAN', 'ADMIN']
const STATUSES = ['', 'PENDING_APPROVAL', 'ACTIVE', 'SUSPENDED', 'REJECTED', 'DISABLED']

function fmtDate(d) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
}

export default function UserManagement() {
  const toast = useToast()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()

  const [users, setUsers] = useState([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const PAGE_SIZE = 20

  const [search, setSearch] = useState(searchParams.get('search') || '')
  const [roleFilter, setRoleFilter] = useState(searchParams.get('role') || '')
  const [statusFilter, setStatusFilter] = useState(searchParams.get('status') || '')

  const [actionModal, setActionModal] = useState(null) // { type, user }
  const [reason, setReason] = useState('')
  const [actionLoading, setActionLoading] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const params = { page, page_size: PAGE_SIZE }
      if (search) params.search = search
      if (roleFilter) params.role = roleFilter
      if (statusFilter) params.status = statusFilter
      const data = await adminApi.getUsers(params)
      setUsers(data.items)
      setTotal(data.total)
    } catch {
      toast.error('Error', 'Failed to load users')
    } finally {
      setLoading(false)
    }
  }, [search, roleFilter, statusFilter, page])

  useEffect(() => { load() }, [load])

  const openAction = (type, user) => {
    setActionModal({ type, user })
    setReason('')
  }
  const closeAction = () => setActionModal(null)

  const doAction = async () => {
    if (!actionModal) return
    setActionLoading(true)
    const { type, user } = actionModal
    try {
      if (type === 'approve') await adminApi.approveUser(user.id)
      else if (type === 'reject') await adminApi.rejectUser(user.id, reason || null)
      else if (type === 'suspend') await adminApi.suspendUser(user.id, reason || null)
      else if (type === 'reactivate') await adminApi.reactivateUser(user.id)
      toast.success('Done', `User ${type}d successfully`)
      closeAction()
      load()
    } catch (err) {
      toast.error('Error', err.message)
    } finally {
      setActionLoading(false)
    }
  }

  const totalPages = Math.ceil(total / PAGE_SIZE)

  return (
    <Layout title="User Management">
      <div className="page-header">
        <h2 className="page-header__title">User Management</h2>
        <p className="page-header__subtitle">Search, filter, and manage portal users</p>
      </div>

      {/* Filter bar */}
      <div className="filter-bar">
        <div className="search-input-wrap">
          <span className="search-icon">🔍</span>
          <input
            id="user-search"
            className="form-input"
            placeholder="Search name or email…"
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1) }}
          />
        </div>
        <select
          id="role-filter"
          className="form-select"
          style={{ maxWidth: 160 }}
          value={roleFilter}
          onChange={e => { setRoleFilter(e.target.value); setPage(1) }}
        >
          <option value="">All Roles</option>
          {ROLES.filter(Boolean).map(r => (
            <option key={r} value={r}>{r.replace('_', ' ')}</option>
          ))}
        </select>
        <select
          id="status-filter"
          className="form-select"
          style={{ maxWidth: 180 }}
          value={statusFilter}
          onChange={e => { setStatusFilter(e.target.value); setPage(1) }}
        >
          <option value="">All Statuses</option>
          {STATUSES.filter(Boolean).map(s => (
            <option key={s} value={s}>{s.replace('_', ' ')}</option>
          ))}
        </select>
        <span style={{ color: 'var(--text-muted)', fontSize: 'var(--text-sm)', marginLeft: 'auto' }}>
          {total} user{total !== 1 ? 's' : ''}
        </span>
      </div>

      {loading ? (
        <Loading />
      ) : users.length === 0 ? (
        <EmptyState icon="👥" title="No users found" message="Try adjusting your filters" />
      ) : (
        <>
          <div className="table-wrapper">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Role</th>
                  <th>Status</th>
                  <th>Specialization</th>
                  <th>Registered</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.map(u => (
                  <tr key={u.id}>
                    <td>
                      <button
                        style={{ background:'none', border:'none', cursor:'pointer', fontWeight:600, color:'var(--text-primary)', fontSize:'var(--text-sm)', padding:0, textAlign:'left' }}
                        onClick={() => navigate(`/admin/users/${u.id}`)}
                      >
                        {u.name}
                      </button>
                    </td>
                    <td style={{ color: 'var(--text-secondary)' }}>{u.email}</td>
                    <td><RoleBadge role={u.role} /></td>
                    <td><StatusBadge status={u.status} /></td>
                    <td style={{ color: 'var(--text-secondary)', fontSize: 'var(--text-xs)' }}>
                      {u.specialization?.name || '—'}
                    </td>
                    <td style={{ color: 'var(--text-secondary)' }}>{fmtDate(u.created_at)}</td>
                    <td>
                      <div style={{ display: 'flex', gap: '0.375rem', flexWrap: 'wrap' }}>
                        {u.status === 'PENDING_APPROVAL' && (
                          <>
                            <Button size="sm" variant="success" onClick={() => openAction('approve', u)}>✓ Approve</Button>
                            <Button size="sm" variant="danger" onClick={() => openAction('reject', u)}>✗ Reject</Button>
                          </>
                        )}
                        {u.status === 'ACTIVE' && u.role !== 'ADMIN' && (
                          <Button size="sm" variant="danger" onClick={() => openAction('suspend', u)}>🚫 Suspend</Button>
                        )}
                        {u.status === 'SUSPENDED' && (
                          <Button size="sm" variant="success" onClick={() => openAction('reactivate', u)}>✓ Reactivate</Button>
                        )}
                        <Button size="sm" variant="ghost" onClick={() => navigate(`/admin/users/${u.id}`)}>View</Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div style={{ display: 'flex', justifyContent: 'center', gap: '0.5rem', marginTop: '1rem' }}>
              <Button size="sm" variant="ghost" disabled={page === 1} onClick={() => setPage(p => p - 1)}>← Prev</Button>
              <span style={{ padding: '0.4rem 0.75rem', fontSize: 'var(--text-sm)', color: 'var(--text-secondary)' }}>
                Page {page} of {totalPages}
              </span>
              <Button size="sm" variant="ghost" disabled={page === totalPages} onClick={() => setPage(p => p + 1)}>Next →</Button>
            </div>
          )}
        </>
      )}

      {/* Action Modal */}
      <Modal
        open={!!actionModal}
        onClose={closeAction}
        title={
          actionModal?.type === 'approve' ? 'Approve User' :
          actionModal?.type === 'reject' ? 'Reject User' :
          actionModal?.type === 'suspend' ? 'Suspend User' :
          'Reactivate User'
        }
      >
        {actionModal && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)' }}>
              {actionModal.type === 'approve' && `Approve account for ${actionModal.user.name}?`}
              {actionModal.type === 'reject' && `Reject account for ${actionModal.user.name}? This cannot be undone.`}
              {actionModal.type === 'suspend' && `Suspend ${actionModal.user.name}'s access immediately.`}
              {actionModal.type === 'reactivate' && `Restore access for ${actionModal.user.name}?`}
            </p>

            {(actionModal.type === 'reject' || actionModal.type === 'suspend') && (
              <div className="form-group">
                <label className="form-label">Reason {actionModal.type === 'suspend' ? '(optional)' : '(optional)'}</label>
                <textarea
                  id="action-reason"
                  className="form-input"
                  style={{ minHeight: 80, resize: 'vertical' }}
                  placeholder="Enter reason…"
                  value={reason}
                  onChange={e => setReason(e.target.value)}
                />
              </div>
            )}

            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
              <Button variant="ghost" onClick={closeAction}>Cancel</Button>
              <Button
                id={`confirm-${actionModal.type}-btn`}
                variant={actionModal.type === 'approve' || actionModal.type === 'reactivate' ? 'success' : 'danger'}
                loading={actionLoading}
                onClick={doAction}
              >
                Confirm
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </Layout>
  )
}
