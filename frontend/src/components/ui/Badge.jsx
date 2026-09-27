const STATUS_CLASS = {
  PENDING_APPROVAL: 'pending',
  ACTIVE: 'active',
  SUSPENDED: 'suspended',
  REJECTED: 'rejected',
  DISABLED: 'disabled',
  PENDING: 'pending',
  APPROVED: 'approved',
}

const ROLE_CLASS = {
  PATIENT: 'role-patient',
  DOCTOR: 'role-doctor',
  LAB_TECHNICIAN: 'role-technician',
  ADMIN: 'role-admin',
}

const STATUS_LABEL = {
  PENDING_APPROVAL: 'Pending',
  ACTIVE: 'Active',
  SUSPENDED: 'Suspended',
  REJECTED: 'Rejected',
  DISABLED: 'Disabled',
  PENDING: 'Pending',
  APPROVED: 'Approved',
}

const ROLE_LABEL = {
  PATIENT: 'Patient',
  DOCTOR: 'Doctor',
  LAB_TECHNICIAN: 'Lab Technician',
  ADMIN: 'Admin',
}

export function StatusBadge({ status }) {
  const cls = STATUS_CLASS[status] || 'info'
  const label = STATUS_LABEL[status] || status
  return <span className={`badge badge-${cls}`}>{label}</span>
}

export function RoleBadge({ role }) {
  const cls = ROLE_CLASS[role] || 'info'
  const label = ROLE_LABEL[role] || role
  return <span className={`badge badge-${cls}`}>{label}</span>
}

export default function Badge({ children, variant = 'info' }) {
  return <span className={`badge badge-${variant}`}>{children}</span>
}
