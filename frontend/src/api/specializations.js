import client from './client'
export const specializationApi = {
  list: () => client.get('/specializations'),
}
