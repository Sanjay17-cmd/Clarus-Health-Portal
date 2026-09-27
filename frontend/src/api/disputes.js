import client from './client'

export const createDispute = (data) => client.post('/disputes', data)
export const myDisputes = () => client.get('/disputes/my')

export const adminListDisputes = (status) => client.get('/admin/disputes', { params: status ? { status } : {} })
export const adminActOnDispute = (disputeId, data) => client.post(`/admin/disputes/${disputeId}/action`, data)
export const adminDisputeAudit = (disputeId) => client.get(`/admin/disputes/${disputeId}/audit`)
