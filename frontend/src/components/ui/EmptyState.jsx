import Button from './Button'

export default function EmptyState({
  icon = '📭',
  title = 'Nothing here yet',
  message = '',
  action,
  actionLabel,
}) {
  return (
    <div className="empty-state">
      <div className="empty-state__icon">{icon}</div>
      <p className="empty-state__title">{title}</p>
      {message && <p className="empty-state__message">{message}</p>}
      {action && actionLabel && (
        <Button variant="primary" onClick={action} style={{ marginTop: '0.75rem' }}>
          {actionLabel}
        </Button>
      )}
    </div>
  )
}
