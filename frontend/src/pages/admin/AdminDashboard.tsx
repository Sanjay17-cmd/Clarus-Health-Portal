import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  Users, FileText, Share2, ClipboardList, TrendingUp,
  Shield, UserCheck, UserX, ChevronDown,
} from 'lucide-react';
import GlassCard from '../../components/ui/GlassCard';
import StatCard from '../../components/ui/StatCard';
import DataTable from '../../components/ui/DataTable';
import Badge from '../../components/ui/Badge';
import Button from '../../components/ui/Button';
import api from '../../api/client';

interface Metrics {
  total_users: number;
  total_reports: number;
  total_shares: number;
  active_shares: number;
  total_logs: number;
  pending_reports: number;
  verified_reports: number;
  flagged_reports: number;
  role_distribution: Array<{ role: string; count: number }>;
  department_distribution: Array<{ department: string; count: number }>;
}

export default function AdminDashboard() {
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<'overview' | 'users' | 'audit'>('overview');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [metricsRes, logsRes, usersRes] = await Promise.all([
        api.get('/admin/metrics'),
        api.get('/admin/audit-logs?limit=50'),
        api.get('/admin/users?limit=50'),
      ]);
      setMetrics(metricsRes.data.metrics);
      setAuditLogs(logsRes.data.logs);
      setUsers(usersRes.data.users);
    } catch (err) {
      console.error('Failed to fetch admin data:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleRoleChange = async (userId: number, newRole: string) => {
    try {
      await api.patch(`/admin/users/${userId}/role`, { role: newRole });
      setUsers(users.map(u => u.id === userId ? { ...u, role: newRole } : u));
    } catch (err) {
      console.error('Role update failed:', err);
    }
  };

  const handleToggleStatus = async (userId: number) => {
    try {
      await api.patch(`/admin/users/${userId}/status`);
      setUsers(users.map(u => u.id === userId ? { ...u, is_active: u.is_active ? 0 : 1 } : u));
    } catch (err) {
      console.error('Status toggle failed:', err);
    }
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleString('en-US', {
      month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
    });
  };

  const actionColors: Record<string, string> = {
    USER_LOGIN: 'text-azure-600 bg-azure-50',
    REPORT_UPLOAD: 'text-teal-600 bg-teal-50',
    REPORT_VIEW: 'text-slate-600 bg-slate-50',
    REPORT_DOWNLOAD: 'text-violet-600 bg-violet-50',
    SHARE_CREATE: 'text-amber-600 bg-amber-50',
    SHARE_ACCESS: 'text-pink-600 bg-pink-50',
    REPORT_STATUS_UPDATE: 'text-indigo-600 bg-indigo-50',
    REPORT_VERIFY: 'text-teal-600 bg-teal-50',
    USER_REGISTER: 'text-green-600 bg-green-50',
    USER_ROLE_UPDATE: 'text-orange-600 bg-orange-50',
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-3 border-azure-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <h1 className="text-2xl font-bold text-navy-500">Admin Console</h1>
        <p className="text-sm text-slate-400 mt-1">System overview, user management, and audit trails</p>
      </motion.div>

      {/* Stat Cards */}
      {metrics && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard label="Total Users"   value={metrics.total_users}   icon={<Users className="w-5 h-5" />}      color="azure" delay={0} />
          <StatCard label="Reports"       value={metrics.total_reports} icon={<FileText className="w-5 h-5" />}   color="teal"  delay={0.08} />
          <StatCard label="Active Shares" value={metrics.active_shares} icon={<Share2 className="w-5 h-5" />}     color="amber" delay={0.16} />
          <StatCard label="Audit Events"  value={metrics.total_logs}    icon={<ClipboardList className="w-5 h-5" />} color="navy" delay={0.24} />
        </div>
      )}

      {/* Report Status Row */}
      {metrics && (
        <div className="grid grid-cols-3 gap-4">
          <GlassCard variant="sm" padding="sm" className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-teal-50"><TrendingUp className="w-4 h-4 text-teal-600" /></div>
            <div>
              <p className="text-lg font-bold text-navy-500">{metrics.verified_reports}</p>
              <p className="text-[11px] text-slate-400 font-medium">Verified</p>
            </div>
          </GlassCard>
          <GlassCard variant="sm" padding="sm" className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-amber-50"><Shield className="w-4 h-4 text-amber-600" /></div>
            <div>
              <p className="text-lg font-bold text-navy-500">{metrics.pending_reports}</p>
              <p className="text-[11px] text-slate-400 font-medium">Pending Review</p>
            </div>
          </GlassCard>
          <GlassCard variant="sm" padding="sm" className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-red-50"><Shield className="w-4 h-4 text-red-500" /></div>
            <div>
              <p className="text-lg font-bold text-navy-500">{metrics.flagged_reports}</p>
              <p className="text-[11px] text-slate-400 font-medium">Flagged</p>
            </div>
          </GlassCard>
        </div>
      )}

      {/* Tab Navigation */}
      <div className="flex items-center gap-1 p-1 bg-slate-100/60 rounded-xl w-fit">
        {(['overview', 'users', 'audit'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-5 py-2 rounded-lg text-sm font-semibold transition-all duration-200 ${
              activeTab === tab
                ? 'bg-white text-navy-500 shadow-sm'
                : 'text-slate-500 hover:text-navy-400'
            }`}
          >
            {tab === 'overview' ? 'Overview' : tab === 'users' ? 'User Management' : 'Audit Logs'}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {activeTab === 'overview' && metrics && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Role Distribution */}
          <GlassCard>
            <h3 className="text-sm font-bold text-navy-500 mb-4">Role Distribution</h3>
            <div className="space-y-3">
              {metrics.role_distribution.map((item) => (
                <div key={item.role} className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-2 h-2 rounded-full bg-azure-400" />
                    <span className="text-sm text-slate-600 font-medium">{item.role}</span>
                  </div>
                  <span className="text-sm font-bold text-navy-500">{item.count}</span>
                </div>
              ))}
            </div>
          </GlassCard>

          {/* Department Distribution */}
          <GlassCard>
            <h3 className="text-sm font-bold text-navy-500 mb-4">Reports by Department</h3>
            <div className="space-y-3">
              {metrics.department_distribution.map((item, idx) => {
                const maxCount = Math.max(...metrics.department_distribution.map(d => d.count));
                const pct = (item.count / maxCount) * 100;
                return (
                  <div key={item.department}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm text-slate-600 font-medium">{item.department}</span>
                      <span className="text-xs font-bold text-navy-500">{item.count}</span>
                    </div>
                    <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${pct}%` }}
                        transition={{ delay: idx * 0.1, duration: 0.6 }}
                        className="h-full rounded-full azure-gradient-soft"
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </GlassCard>
        </div>
      )}

      {activeTab === 'users' && (
        <GlassCard>
          <DataTable
            columns={[
              { key: 'full_name', label: 'Name', sortable: true },
              { key: 'email', label: 'Email', sortable: true },
              {
                key: 'role', label: 'Role', sortable: true,
                render: (row: any) => (
                  <select
                    value={row.role}
                    onChange={(e) => handleRoleChange(row.id, e.target.value)}
                    className="bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 text-xs font-semibold text-navy-500 focus:outline-none focus:ring-2 focus:ring-azure-500/20"
                  >
                    {['Admin', 'Doctor', 'LabTechnician', 'Patient'].map(r => (
                      <option key={r} value={r}>{r}</option>
                    ))}
                  </select>
                ),
              },
              { key: 'department', label: 'Department', render: (row: any) => row.department || '—' },
              {
                key: 'is_active', label: 'Status',
                render: (row: any) => (
                  <button
                    onClick={() => handleToggleStatus(row.id)}
                    className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold transition-colors ${
                      row.is_active
                        ? 'bg-teal-50 text-teal-700 hover:bg-teal-100'
                        : 'bg-red-50 text-red-600 hover:bg-red-100'
                    }`}
                  >
                    {row.is_active ? <UserCheck className="w-3 h-3" /> : <UserX className="w-3 h-3" />}
                    {row.is_active ? 'Active' : 'Inactive'}
                  </button>
                ),
              },
              {
                key: 'created_at', label: 'Joined', sortable: true,
                render: (row: any) => <span className="text-xs text-slate-400">{formatDate(row.created_at)}</span>,
              },
            ]}
            data={users}
            searchable
            searchKeys={['full_name', 'email', 'department']}
            emptyMessage="No users found."
          />
        </GlassCard>
      )}

      {activeTab === 'audit' && (
        <GlassCard>
          <DataTable
            columns={[
              {
                key: 'action', label: 'Action',
                render: (row: any) => (
                  <span className={`px-2.5 py-1 rounded-lg text-xs font-bold ${actionColors[row.action] || 'text-slate-600 bg-slate-50'}`}>
                    {row.action.replace(/_/g, ' ')}
                  </span>
                ),
              },
              { key: 'user_name', label: 'User', render: (row: any) => row.user_name || 'System' },
              { key: 'user_role', label: 'Role', render: (row: any) => row.user_role || '—' },
              { key: 'entity_type', label: 'Entity', render: (row: any) => row.entity_type || '—' },
              { key: 'ip_address', label: 'IP', render: (row: any) => <span className="font-mono text-xs">{row.ip_address || '—'}</span> },
              {
                key: 'created_at', label: 'Time', sortable: true,
                render: (row: any) => <span className="text-xs text-slate-400">{formatDate(row.created_at)}</span>,
              },
            ]}
            data={auditLogs}
            searchable
            searchKeys={['action', 'user_name', 'entity_type']}
            emptyMessage="No audit logs found."
          />
        </GlassCard>
      )}
    </div>
  );
}
