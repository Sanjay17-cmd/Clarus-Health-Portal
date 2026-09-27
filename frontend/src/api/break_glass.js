import client from './client'

export const requestBreakGlass = (data) => client.post('/break-glass/request', data)
export const checkBreakGlassStatus = (patientId) => client.get(`/break-glass/status/${patientId}`)
export const myBreakGlassHistory = () => client.get('/break-glass/my')

export const adminListBreakGlass = () => client.get('/admin/break-glass')
export const adminListSuspensions = () => client.get('/admin/break-glass/suspensions')
export const adminRestoreFromSuspension = (eventId, data) => client.post(`/admin/break-glass/suspensions/${eventId}/restore`, data)

// ── Download Requests ─────────────────────────────────────────────────────────
export const createBgDownloadRequest = (data) => client.post('/break-glass/download-request', data)
export const myBgDownloadRequests = () => client.get('/break-glass/download-requests')
// actual download of approved file
export const performBgDownload = (reqId, fileId) =>
  client.get(`/break-glass/download/${reqId}/file/${fileId}`, { responseType: 'arraybuffer' })

// ── Emergency Share Chain ────────────────────────────────────────────────────
export const requestEmergencyShare = (data) => client.post('/break-glass/share', data)
export const myBgShareRequests = () => client.get('/break-glass/share-requests')

// ── Admin ─────────────────────────────────────────────────────────────────────
export const adminListBgDownloadRequests = () => client.get('/admin/break-glass/download-requests')
export const adminReviewBgDownload = (reqId, data) => client.post(`/admin/break-glass/download-requests/${reqId}/review`, data)

export const adminListBgShareRequests = () => client.get('/admin/break-glass/share-requests')
export const adminReviewBgShare = (reqId, data) => client.post(`/admin/break-glass/share-requests/${reqId}/review`, data)
