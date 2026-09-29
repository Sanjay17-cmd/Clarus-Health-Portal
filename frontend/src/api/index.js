import client from './client'

export const adminApi = {
  getOverview: () => client.get('/admin/overview'),

  getUsers: (params) => client.get('/admin/users', { params }),
  getUser: (id) => client.get(`/admin/users/${id}`),
  approveUser: (id) => client.post(`/admin/users/${id}/approve`),
  rejectUser: (id, reason) => client.post(`/admin/users/${id}/reject`, { reason }),
  suspendUser: (id, reason) => client.post(`/admin/users/${id}/suspend`, { reason }),
  reactivateUser: (id) => client.post(`/admin/users/${id}/reactivate`),

  getSpecializations: () => client.get('/admin/specializations'),
  createSpecialization: (data) => client.post('/admin/specializations', data),
  updateSpecialization: (id, data) => client.put(`/admin/specializations/${id}`, data),

  getSpecializationRequests: (status) =>
    client.get('/admin/specialization-requests', { params: status ? { status } : {} }),
  approveSpecRequest: (id, notes) =>
    client.post(`/admin/specialization-requests/${id}/approve`, { review_notes: notes }),
  rejectSpecRequest: (id, notes) =>
    client.post(`/admin/specialization-requests/${id}/reject`, { review_notes: notes }),

  getAuditLogs: (params) => client.get('/admin/audit-logs', { params }),
}

export const getCorrections = () => client.get('/admin/corrections')
export const getDeletionRequests = (status) => client.get('/admin/deletion-requests', { params: status ? { status } : {} })
export const restoreRecord = (requestId, data) => client.post(`/admin/deletion-requests/${requestId}/restore`, data)
export const permanentlyDeleteRecord = (requestId, data) => client.post(`/admin/deletion-requests/${requestId}/permanently-delete`, data)
export const getExports = () => client.get('/admin/exports')
export const getImports = () => client.get('/admin/imports')

export const getAdminPermissionRequests = () => client.get('/admin/permissions')
export const decideAdminPermissionRequest = (id, approve, notes) =>
  client.post(`/admin/permissions/${id}/decision`, { approve, notes })
export const requestDownloadPermission = (group_id, justification) =>
  client.post('/permissions/download-request', { group_id, justification })
export const searchEmergencyPatients = (search) =>
  client.get('/break-glass/patients', { params: search ? { search } : {} })
export const requestBreakGlass = (data) => client.post('/break-glass/request', data)
export const getEmergencyDoctors = () => client.get('/break-glass/doctors')
export const shareDuringEmergency = (data) => client.post('/break-glass/share', data)

export const exportZip = (groupId, recordIds) => {
  const params = {}
  if (recordIds?.length) params.record_ids = recordIds.join(',')
  return client.get(`/archive/export/${groupId}`, { params, responseType: 'arraybuffer' })
}

export const importZip = (formData) => client.post('/archive/import', formData, {
  headers: { 'Content-Type': 'multipart/form-data' },
})

export const authApi = {
  register: (data) => client.post('/auth/register', data),
  login: (data) => client.post('/auth/login', data),
  me: () => client.get('/auth/me'),
}

export const createDispute = (data) => client.post('/disputes', data)
export const myDisputes = () => client.get('/disputes/my')

export const adminListDisputes = (status) => client.get('/admin/disputes', { params: status ? { status } : {} })
export const adminActOnDispute = (disputeId, data) => client.post(`/admin/disputes/${disputeId}/action`, data)
export const adminDisputeAudit = (disputeId) => client.get(`/admin/disputes/${disputeId}/audit`)

export const doctorApi = {
  getProfile: () => client.get('/doctor/profile'),
  requestSpecChange: (data) => client.post('/doctor/specialization-request', data),
  getMySpecRequests: () => client.get('/doctor/specialization-requests'),
}

export const notificationsApi = {
  list: () => client.get('/notifications'),
  markRead: (id) => client.post(`/notifications/${id}/read`),
  markAllRead: () => client.post('/notifications/read-all'),
}

export const patientApi = {
  getProfile: () => client.get('/patient/profile'),
}

export const getMyActivity = (limit = 100) => client.get('/patient/activity', { params: { limit } })


export const getGroups = (patientId) => client.get('/reports/groups', { params: patientId ? { patient_id: patientId } : {} })
export const createGroup = (formData) => client.post('/reports/groups', formData)
export const getRecords = (groupId) => client.get(`/reports/groups/${groupId}/records`)
export const createRecord = (groupId, formData) => client.post(`/reports/groups/${groupId}/records`, formData)
export const getRecord = (recordId) => client.get(`/reports/records/${recordId}`)
export const viewFile = (fileId) => client.get(`/reports/files/${fileId}/view`, { responseType: 'arraybuffer' })
export const downloadFile = (fileId) => client.get(`/reports/files/${fileId}/download`, { responseType: 'arraybuffer' })
export const listPatients = (search) => client.get('/reports/patients', { params: search ? { search } : {} })
export const requestDeletion = (recordId, reason) => client.post(`/reports/records/${recordId}/delete-request`, { record_id: recordId, reason })
export const getTechnicianUploads = () => client.get('/reports/technician/uploads')

export const reportsApi = {
  getGroups,
  createGroup,
  getRecords,
  createRecord,
  getRecord,
  viewFile,
  downloadFile,
  listPatients,
  requestDeletion,
  getTechnicianUploads
}

export const grantPermission = (data) => client.post('/shares/internal', data)
export const listPermissions = (recordId) => client.get(`/shares/internal/${recordId}`)
export const updatePermission = (permId, data) => client.patch(`/shares/internal/perm/${permId}`, data)
export const revokePermission = (permId) => client.delete(`/shares/internal/perm/${permId}`)

export const createExternalShare = (data) => client.post('/shares/external', data)
export const listExternalShares = (recordId) => client.get(`/shares/external/${recordId}`)
export const revokeExternalShare = (shareId) => client.delete(`/shares/external/${shareId}`)

export const createGroupShare = (data) => client.post('/shares/group', data)
export const listGroupShares = (groupId) => client.get(`/shares/group/${groupId}`)
export const updateGroupShare = (shareId, data) => client.patch(`/shares/group/${shareId}`, data)
export const revokeGroupShare = (shareId) => client.delete(`/shares/group/${shareId}`)

export const myShares = () => client.get('/shares/my')
export const acceptShare = (shareId) => client.post(`/shares/group/${shareId}/accept`)
export const delegateShare = (shareId, data) => client.post(`/shares/group/${shareId}/delegate`, data)

export const getPublicRecord = (token) => client.get(`/public/shared/${token}`)
export const getPublicFile = (token, fileId) => client.get(`/public/shared/${token}/files/${fileId}/view`, { responseType: 'arraybuffer' })

export const sharesApi = {
  grantPermission,
  listPermissions,
  updatePermission,
  revokePermission,
  createExternalShare,
  listExternalShares,
  revokeExternalShare,
  createGroupShare,
  listGroupShares,
  updateGroupShare,
  revokeGroupShare,
  myShares,
  acceptShare,
  delegateShare,
  getPublicRecord,
  getPublicFile,
}

export const specializationApi = {
  list: () => client.get('/specializations'),
}

export const technicianApi = {
  getProfile: () => client.get('/technician/profile'),
}


