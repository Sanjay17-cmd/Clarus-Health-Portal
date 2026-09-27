import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import Layout from '../../components/layout/Layout'
import Card from '../../components/ui/Card'
import Button from '../../components/ui/Button'
import { StatusBadge, RoleBadge } from '../../components/ui/Badge'
import Loading from '../../components/ui/Loading'
import { adminApi } from '../../api'
import { useToast } from '../../components/ui/Toast'

function InfoRow({ label, value }) {
  return (
    <div className="info-row">
      <span className="info-row__label">{label}</span>
      <span className="info-row__value">{value || '—'}</span>
    </div>
  )
}

function fmtDate(d) {
  if (!d) return null
  return new Date(d).toLocaleString('en-GB')
}

export default function UserDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const toast = useToast()
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    adminApi.getUser(id)
      .then(setUser)
      .catch(() => toast.error('Error', 'User not found'))
      .finally(() => setLoading(false))
  }, [id])

  if (loading) return <Layout title="User Detail"><Loading /></Layout>
  if (!user) return <Layout title="User Detail"><p>User not found</p></Layout>

  return (
    <Layout title={`User: ${user.name}`}>
      <div style={{ marginBottom: '1rem' }}>
        <Button variant="ghost" size="sm" onClick={() => navigate('/admin/users')}>← Back to Users</Button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
        {/* Identity */}
        <Card>
          <h3 className="section-title">Account Information</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <InfoRow label="Full Name" value={user.name} />
            <InfoRow label="Email" value={user.email} />
            <div className="info-row">
              <span className="info-row__label">Role</span>
              <RoleBadge role={user.role} />
            </div>
            <div className="info-row">
              <span className="info-row__label">Status</span>
              <StatusBadge status={user.status} />
            </div>
            {user.specialization && (
              <InfoRow label="Specialization" value={user.specialization.name} />
            )}
          </div>
        </Card>

        {/* Timestamps */}
        <Card>
          <h3 className="section-title">Activity</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <InfoRow label="Registered" value={fmtDate(user.created_at)} />
            <InfoRow label="Last Updated" value={fmtDate(user.updated_at)} />
            <InfoRow label="Last Login" value={fmtDate(user.last_login_at)} />
          </div>
        </Card>

        {/* Approval */}
        {(user.approved_at || user.rejected_at) && (
          <Card>
            <h3 className="section-title">
              {user.approved_at ? '✅ Approval Information' : '❌ Rejection Information'}
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {user.approved_at && <InfoRow label="Approved At" value={fmtDate(user.approved_at)} />}
              {user.rejected_at && <InfoRow label="Rejected At" value={fmtDate(user.rejected_at)} />}
              {user.rejection_reason && <InfoRow label="Rejection Reason" value={user.rejection_reason} />}
            </div>
          </Card>
        )}

        {/* Suspension */}
        {user.suspended_at && (
          <Card>
            <h3 className="section-title">🚫 Suspension Information</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <InfoRow label="Suspended At" value={fmtDate(user.suspended_at)} />
              <InfoRow label="Reason" value={user.suspension_reason} />
            </div>
          </Card>
        )}
      </div>
    </Layout>
  )
}
