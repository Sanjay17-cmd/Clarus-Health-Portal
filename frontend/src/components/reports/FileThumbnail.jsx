export default function FileThumbnail({ file, index, onClick, selected }) {
  const isPdf = file.mime_type === 'application/pdf'
  return (
    <button
      className={`file-thumb ${selected ? 'file-thumb--selected' : ''}`}
      onClick={onClick}
      title={file.original_name}
      type="button"
    >
      <div className="file-thumb__icon">
        {isPdf ? '📄' : '🖼️'}
      </div>
      <div className="file-thumb__info">
        <div className="file-thumb__name">{file.original_name}</div>
        <div className="file-thumb__meta">
          {isPdf ? 'PDF' : 'Image'} · #{index + 1}
        </div>
      </div>
    </button>
  )
}
