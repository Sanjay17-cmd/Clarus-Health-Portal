import client from './client'

export const exportZip = (groupId, recordIds) => {
  const params = {}
  if (recordIds?.length) params.record_ids = recordIds.join(',')
  return client.get(`/archive/export/${groupId}`, { params, responseType: 'arraybuffer' })
}

export const importZip = (formData) => client.post('/archive/import', formData, {
  headers: { 'Content-Type': 'multipart/form-data' },
})
