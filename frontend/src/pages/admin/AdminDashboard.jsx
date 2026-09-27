import { useState, useEffect } from 'react'
import Layout from '../../components/layout/Layout'
import Card from '../../components/ui/Card'
import Loading from '../../components/ui/Loading'
import { adminApi } from '../../api/admin'
import { useToast } from '../../components/ui/Toast'

function StatCard({ icon, label, value, color }) {
  return (
    <div className="stat-card">
      <div className="stat-card__icon" style={{ background: color + '18', color }}>
        {icon}
      </div>
      <div>
        <div className="stat-card__value">{value ?? '—'}</div>
        <div className="stat-card__label">{label}</div>
      </div>
    </div>
  )
}

export default function AdminDashboard() {
  const toast = useToast()
  const [overview, setOverview] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    adminApi.getOverview()
      .then(setOverview)
      .catch(() => toast.error('Error', 'Failed to load overview'))
      .finally(() => setLoading(false))
  }, [])

  return (
    <Layout title="Admin Overview">
      <div className="page-header">
        <h2 className="page-header__title">Dashboard Overview</h2>
        <p className="page-header__subtitle">Live counts from the database</p>
      </div>

      {loading ? (
        <Loading />
      ) : (
        <>
          <div className="grid-cols-4" style={{ marginBottom: '2rem' }}>
            <StatCard
              icon="⏳"
              label="Pending Approvals"
              value={overview?.pending_approvals}
              color="var(--color-amber-500)"
            />
            <StatCard
              icon="✅"
              label="Active Users"
              value={overview?.active_users}
              color="var(--color-green-500)"
            />
            <StatCard
              icon="🚨"
              label="Suspended"
              value={overview?.suspended_users}
              color="var(--color-red-500)"
            />
            <StatCard
              icon="👥"
              label="Total Users"
              value={overview?.total_users}
              color="var(--color-blue-500)"
            />
          </div>

          <div className="grid-cols-3">
            <StatCard
              icon="👨‍⚕️"
              label="Doctors"
              value={overview?.doctors}
              color="var(--color-blue-500)"
            />
            <StatCard
              icon="🤒"
              label="Patients"
              value={overview?.patients}
              color="#7c3aed"
            />
            <StatCard
              icon="🔬"
              label="Lab Technicians"
              value={overview?.technicians}
              color="#c2410c"
            />
          </div>

          <div style={{ marginTop: '2rem' }}>
            <Card>
              <h3 className="section-title">Phase 1 Quick Actions</h3>
              <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
                <a href="/admin/users?status=PENDING_APPROVAL" className="btn btn-primary btn-sm">
                  ⏳ Review Pending ({overview?.pending_approvals})
                </a>
                <a href="/admin/users" className="btn btn-ghost btn-sm">
                  👥 Manage Users
                </a>
                <a href="/admin/specializations" className="btn btn-ghost btn-sm">
                  🩺 Specializations
                </a>
                <a href="/admin/audit" className="btn btn-ghost btn-sm">
                  📋 Audit Log
                </a>
              </div>
            </Card>
          </div>
        </>
      )}
    </Layout>
  )
}
