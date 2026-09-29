import axios from 'axios'

const client = axios.create({ baseURL: '/api' })

client.interceptors.request.use(config => {
  const token = localStorage.getItem('clarus_token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

client.interceptors.response.use(
  res => (res.config.responseType === 'arraybuffer' ? res.data : res.data),
  err => {
    let detail
    if (err.response?.config?.responseType === 'arraybuffer' && err.response?.data) {
      try {
        const text = new TextDecoder().decode(err.response.data)
        detail = JSON.parse(text)?.detail
      } catch {}
    } else {
      detail = err.response?.data?.detail
    }

    const message =
      typeof detail === 'string'
        ? detail
        : Array.isArray(detail)
          ? detail.map(d => d.msg).join(', ')
          : 'An unexpected error occurred'

    return Promise.reject(new Error(message))
  }
)

export default client
