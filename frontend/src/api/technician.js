import client from './client'
export const technicianApi = {
  getProfile: () => client.get('/technician/profile'),
}
