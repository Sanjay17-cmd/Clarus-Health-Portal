import client from './client'

export const grantPermission = (data) => client.post('/shares/internal', data)
export const listPermissions = (recordId) => client.get(`/shares/internal/${recordId}`)
export const updatePermission = (permId, data) => client.patch(`/shares/internal/perm/${permId}`, data)
export const revokePermission = (permId) => client.delete(`/shares/internal/perm/${permId}`)

export const createExternalShare = (data) => client.post('/shares/external', data)
export const listExternalShares = (recordId) => client.get(`/shares/external/${recordId}`)
export const revokeExternalShare = (shareId) => client.delete(`/shares/external/${shareId}`)

// Group shares — Phase 4 version/file-aware
export const createGroupShare = (data) => client.post('/shares/group', data)
export const listGroupShares = (groupId) => client.get(`/shares/group/${groupId}`)
export const updateGroupShare = (shareId, data) => client.patch(`/shares/group/${shareId}`, data)
export const revokeGroupShare = (shareId) => client.delete(`/shares/group/${shareId}`)

// Doctor-facing share endpoints (Phase 4)
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
