import { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react'

const ToastContext = createContext(null)

const ICONS = { success: '✅', error: '❌', warning: '⚠️', info: 'ℹ️' }

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([])
  const idRef = useRef(0)

  const addToast = useCallback(({ title, message, type = 'info', duration = 4000 }) => {
    const id = ++idRef.current
    setToasts(prev => [...prev, { id, title, message, type }])
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), duration)
    return id
  }, [])

  const removeToast = useCallback((id) => {
    setToasts(prev => prev.filter(t => t.id !== id))
  }, [])

  const toast = {
    success: (title, message) => addToast({ title, message, type: 'success' }),
    error: (title, message) => addToast({ title, message, type: 'error' }),
    warning: (title, message) => addToast({ title, message, type: 'warning' }),
    info: (title, message) => addToast({ title, message, type: 'info' }),
  }

  return (
    <ToastContext.Provider value={toast}>
      {children}
      <div className="toast-container" role="log" aria-live="polite">
        {toasts.map(t => (
          <div key={t.id} className={`toast toast-${t.type}`}>
            <span className="toast-icon">{ICONS[t.type]}</span>
            <div className="toast-body">
              {t.title && <div className="toast-title">{t.title}</div>}
              {t.message && <div className="toast-message">{t.message}</div>}
            </div>
            <button
              style={{ background:'none', border:'none', cursor:'pointer', color:'var(--text-muted)', fontSize:'1rem' }}
              onClick={() => removeToast(t.id)}
              aria-label="Dismiss"
            >✕</button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}

export function useToast() {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast must be used inside ToastProvider')
  return ctx
}
