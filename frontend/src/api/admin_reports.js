import client from './client'

export const getCorrections = () => client.get('/admin/corrections')
export const getDeletionRequests = (status) => client.get('/admin/deletion-requests', { params: status ? { status } : {} })
export const restoreRecord = (requestId, data) => client.post(`/admin/deletion-requests/${requestId}/restore`, data)
export const permanentlyDeleteRecord = (requestId, data) => client.post(`/admin/deletion-requests/${requestId}/permanently-delete`, data)
export const getExports = () => client.get('/admin/exports')
export const getImports = () => client.get('/admin/imports')
