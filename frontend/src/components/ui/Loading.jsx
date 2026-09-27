export default function Loading({ message = 'Loading…', fullPage = false }) {
  if (fullPage) {
    return (
      <div style={{ display:'flex', alignItems:'center', justifyContent:'center', minHeight:'100vh', flexDirection:'column', gap:'1rem' }}>
        <div className="spinner" />
        <span style={{ color:'var(--text-secondary)', fontSize:'var(--text-sm)' }}>{message}</span>
      </div>
    )
  }
  return (
    <div className="loading-overlay">
      <div className="spinner" />
      <span style={{ color:'var(--text-secondary)', fontSize:'var(--text-sm)' }}>{message}</span>
    </div>
  )
}
