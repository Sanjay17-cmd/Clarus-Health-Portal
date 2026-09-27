import client from './client'
export const patientApi = {
  getProfile: () => client.get('/patient/profile'),
}
