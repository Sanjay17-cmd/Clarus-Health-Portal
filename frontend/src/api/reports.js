import client from './client'

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
