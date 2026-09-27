import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { authApi } from '../api'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [token, setToken] = useState(() => localStorage.getItem('clarus_token'))
  const [loading, setLoading] = useState(true)

  // Load user from token on mount
  useEffect(() => {
    if (token) {
      authApi.me()
        .then(u => setUser(u))
        .catch(() => {
          localStorage.removeItem('clarus_token')
          setToken(null)
          setUser(null)
        })
        .finally(() => setLoading(false))
    } else {
      setLoading(false)
    }
  }, [token])

  const login = useCallback(async (email, password) => {
    const data = await authApi.login({ email, password })
    localStorage.setItem('clarus_token', data.access_token)
    setToken(data.access_token)
    // Fetch full user profile
    const fullUser = await authApi.me()
    setUser(fullUser)
    return fullUser
  }, [])

  const register = useCallback(async (payload) => {
    return authApi.register(payload)
  }, [])

  const logout = useCallback(() => {
    localStorage.removeItem('clarus_token')
    setToken(null)
    setUser(null)
  }, [])

  const refreshUser = useCallback(async () => {
    const u = await authApi.me()
    setUser(u)
    return u
  }, [])

  return (
    <AuthContext.Provider value={{ user, token, loading, login, logout, register, refreshUser }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider')
  return ctx
}
