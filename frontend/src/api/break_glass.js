import client from './client'

export const requestBreakGlass = (data) => client.post('/break-glass/request', data)
export const checkBreakGlassStatus = (patientId) => client.get(`/break-glass/status/${patientId}`)
export const myBreakGlassHistory = () => client.get('/break-glass/my')

export const adminListBreakGlass = () => client.get('/admin/break-glass')
export const adminListSuspensions = () => client.get('/admin/break-glass/suspensions')
export const adminRestoreFromSuspension = (eventId, data) => client.post(`/admin/break-glass/suspensions/${eventId}/restore`, data)
