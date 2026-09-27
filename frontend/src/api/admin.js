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
