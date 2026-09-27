export default function Select({
  label,
  id,
  error,
  hint,
  children,
  className = '',
  ...props
}) {
  return (
    <div className="form-group">
      {label && <label className="form-label" htmlFor={id}>{label}</label>}
      <select
        id={id}
        className={`form-select ${error ? 'error' : ''} ${className}`}
        {...props}
      >
        {children}
      </select>
      {error && <span className="form-error">{error}</span>}
      {hint && !error && <span className="form-hint">{hint}</span>}
    </div>
  )
}
