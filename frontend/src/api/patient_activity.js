import client from './client'

export const getMyActivity = (limit = 100) => client.get('/patient/activity', { params: { limit } })
