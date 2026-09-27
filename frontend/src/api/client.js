import axios from 'axios'

const client = axios.create({
  baseURL: '/api',
  // Do NOT set Content-Type globally — Axios auto-sets multipart/form-data for FormData
  // and application/json for plain objects. Forcing it here breaks file uploads.
})

// Attach JWT to every request
client.interceptors.request.use(config => {
  const token = localStorage.getItem('clarus_token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

// Normalize error responses; return raw data for binary responses
client.interceptors.response.use(
  res => {
    // If the request was for binary data, return the raw arraybuffer
    if (res.config.responseType === 'arraybuffer') return res.data
    return res.data
  },
  err => {
    // For arraybuffer error responses, decode the body
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
