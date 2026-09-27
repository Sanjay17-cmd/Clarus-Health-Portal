import client from './client'
export const doctorApi = {
  getProfile: () => client.get('/doctor/profile'),
  requestSpecChange: (data) => client.post('/doctor/specialization-request', data),
  getMySpecRequests: () => client.get('/doctor/specialization-requests'),
}
