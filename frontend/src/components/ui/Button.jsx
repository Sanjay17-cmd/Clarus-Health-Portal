/**
 * 3D Button component
 * variant: 'primary' | 'secondary' | 'ghost' | 'danger' | 'success'
 * size: 'sm' | 'md' | 'lg'
 */
export default function Button({
  children,
  variant = 'primary',
  size = 'md',
  full = false,
  icon = false,
  loading = false,
  disabled = false,
  className = '',
  ...props
}) {
  const classes = [
    'btn',
    `btn-${variant}`,
    size === 'sm' ? 'btn-sm' : size === 'lg' ? 'btn-lg' : '',
    full ? 'btn-full' : '',
    icon ? 'btn-icon' : '',
    className,
  ].filter(Boolean).join(' ')

  return (
    <button className={classes} disabled={disabled || loading} {...props}>
      {loading ? (
        <>
          <span className="spinner spinner-sm" />
          {children}
        </>
      ) : children}
    </button>
  )
}
