const TYPE_COLORS = {
  ORIGINAL:   { bg: 'var(--color-teal-100)',  text: 'var(--color-teal-800)',  label: '● Original'   },
  HISTORICAL: { bg: 'var(--color-blue-100)',  text: 'var(--color-blue-800)', label: '◆ Historical'  },
  CORRECTION: { bg: 'var(--color-amber-100)', text: 'var(--color-amber-500)', label: '✎ Correction' },
}

export default function RecordTypeTag({ type }) {
  const style = TYPE_COLORS[type] || TYPE_COLORS.ORIGINAL
  return (
    <span style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: '0.25rem',
      padding: '0.2rem 0.6rem',
      borderRadius: 'var(--radius-full)',
      background: style.bg,
      color: style.text,
      fontSize: 'var(--text-xs)',
      fontWeight: 700,
      letterSpacing: '0.01em',
    }}>
      {style.label}
    </span>
  )
}
