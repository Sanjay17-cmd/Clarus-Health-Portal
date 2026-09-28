import { useState, useEffect, useCallback, useRef } from 'react'
import { createPortal } from 'react-dom'
import { viewFile, downloadFile } from '../../api'
import { getPublicFile } from '../../api'
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url'

const ZOOM_STEPS = [0.5, 0.75, 1, 1.5, 2, 3, 4]

function getFileIcon(mime) {
  if (mime?.includes('pdf')) return '📄'
  if (mime?.includes('image')) return '🖼️'
  return '📎'
}

function FileSidebar({ files, current, onChange }) {
  return (
    <div style={{ width: 200, minWidth: 160, overflowY: 'auto', padding: '0.5rem', background: 'rgba(0,0,0,0.4)', borderRight: '1px solid rgba(255,255,255,0.08)', display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
      {files.map((f, i) => (
        <button key={f.id} className={`file-thumb${i === current ? ' file-thumb--selected' : ''}`} onClick={() => onChange(i)}>
          <span className="file-thumb__icon">{getFileIcon(f.mime_type)}</span>
          <div className="file-thumb__info">
            <div className="file-thumb__name">{f.original_name}</div>
            <div className="file-thumb__meta">{f.mime_type?.split('/')[1]?.toUpperCase()}</div>
          </div>
        </button>
      ))}
    </div>
  )
}

function ImageViewer({ src, mime }) {
  const [zoom, setZoom] = useState(1)
  const [zoomIdx, setZoomIdx] = useState(2) // index into ZOOM_STEPS
  const containerRef = useRef(null)

  const zoomIn = () => { const ni = Math.min(zoomIdx + 1, ZOOM_STEPS.length - 1); setZoomIdx(ni); setZoom(ZOOM_STEPS[ni]) }
  const zoomOut = () => { const ni = Math.max(zoomIdx - 1, 0); setZoomIdx(ni); setZoom(ZOOM_STEPS[ni]) }
  const resetZoom = () => { setZoomIdx(2); setZoom(1) }

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <div style={{ display: 'flex', gap: '0.5rem', padding: '0.5rem 1rem', background: 'rgba(0,0,0,0.3)', alignItems: 'center' }}>
        <button className="viewer-ctrl-btn" onClick={zoomOut} disabled={zoomIdx === 0}>−</button>
        <span style={{ color: 'rgba(255,255,255,0.7)', fontSize: 13, minWidth: 42, textAlign: 'center' }}>{Math.round(zoom * 100)}%</span>
        <button className="viewer-ctrl-btn" onClick={zoomIn} disabled={zoomIdx === ZOOM_STEPS.length - 1}>+</button>
        <button className="viewer-ctrl-btn" onClick={resetZoom}>Reset</button>
        <button className="viewer-ctrl-btn" onClick={() => containerRef.current?.requestFullscreen?.()}>⛶ Full</button>
      </div>
      <div ref={containerRef} style={{ flex: 1, overflow: 'auto', display: 'flex', justifyContent: 'center', alignItems: zoom <= 1 ? 'center' : 'flex-start', padding: '1rem', background: '#0a0a0a', cursor: zoom > 1 ? 'grab' : 'default' }}>
        <img src={src} alt="Medical image" style={{ transform: `scale(${zoom})`, transformOrigin: 'top center', maxWidth: zoom <= 1 ? '100%' : 'none', transition: 'transform 0.18s ease', userSelect: 'none', pointerEvents: 'none' }} />
      </div>
    </div>
  )
}

function PdfViewer({ src }) {
  const containerRef = useRef(null)
  const [loading, setLoading] = useState(true)
  const [numPages, setNumPages] = useState(0)
  const [pdfDocument, setPdfDocument] = useState(null)
  const [pdfError, setPdfError] = useState(null)
  const [zoom, setZoom] = useState(1)
  const [zoomIdx, setZoomIdx] = useState(2)
  const canvasRefs = useRef({})

  useEffect(() => {
    setLoading(true)
    setNumPages(0)
    setPdfDocument(null)
    setPdfError(null)
    let cancelled = false
    let loadedPdf = null

    import('pdfjs-dist').then(({ getDocument, GlobalWorkerOptions }) => {
      GlobalWorkerOptions.workerSrc = pdfWorkerUrl
      return getDocument({ url: src }).promise
    }).then(pdf => {
      if (cancelled) return
      loadedPdf = pdf
      setPdfDocument(pdf)
      setNumPages(pdf.numPages)
      setLoading(false)
    }).catch(error => {
      if (!cancelled) {
        setLoading(false)
        setPdfError(error.message || 'This PDF could not be opened.')
      }
    })

    return () => {
      cancelled = true
      loadedPdf?.destroy()
    }
  }, [src])

  useEffect(() => {
    if (!pdfDocument || !numPages) return undefined
    let cancelled = false
    const renderTasks = []

    const renderPages = async () => {
      for (let pageNumber = 1; pageNumber <= numPages; pageNumber++) {
        if (cancelled) return
        const canvas = canvasRefs.current[pageNumber]
        if (!canvas) continue
        const page = await pdfDocument.getPage(pageNumber)
        const viewport = page.getViewport({ scale: 1.5 })
        canvas.height = viewport.height
        canvas.width = viewport.width
        const task = page.render({ canvasContext: canvas.getContext('2d'), viewport })
        renderTasks.push(task)
        await task.promise
      }
    }

    renderPages().catch(error => {
      if (!cancelled && error?.name !== 'RenderingCancelledException') {
        setPdfError(error.message || 'A PDF page could not be rendered.')
      }
    })

    return () => {
      cancelled = true
      renderTasks.forEach(task => task.cancel())
    }
  }, [pdfDocument, numPages])

  const zoomIn = () => { const ni = Math.min(zoomIdx + 1, ZOOM_STEPS.length - 1); setZoomIdx(ni); setZoom(ZOOM_STEPS[ni]) }
  const zoomOut = () => { const ni = Math.max(zoomIdx - 1, 0); setZoomIdx(ni); setZoom(ZOOM_STEPS[ni]) }

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <div style={{ display: 'flex', gap: '0.5rem', padding: '0.5rem 1rem', background: 'rgba(0,0,0,0.3)', alignItems: 'center' }}>
        <button className="viewer-ctrl-btn" onClick={zoomOut} disabled={zoomIdx === 0}>−</button>
        <span style={{ color: 'rgba(255,255,255,0.7)', fontSize: 13, minWidth: 42, textAlign: 'center' }}>{Math.round(zoom * 100)}%</span>
        <button className="viewer-ctrl-btn" onClick={zoomIn} disabled={zoomIdx === ZOOM_STEPS.length - 1}>+</button>
        <button className="viewer-ctrl-btn" onClick={() => containerRef.current?.requestFullscreen?.()}>⛶ Full</button>
        {numPages > 0 && <span style={{ color: 'rgba(255,255,255,0.45)', fontSize: 12, marginLeft: 'auto' }}>{numPages} page{numPages !== 1 ? 's' : ''}</span>}
      </div>
      <div ref={containerRef} style={{ flex: 1, overflow: 'auto', background: '#1a1a1a', padding: '1rem', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem' }}>
        {loading && <div className="animate-pulse" style={{ color: 'rgba(255,255,255,0.4)', marginTop: '3rem' }}>Loading PDF…</div>}
        {pdfError && <div role="alert" style={{ color: '#fca5a5', padding: '1.5rem', textAlign: 'center' }}>{pdfError}</div>}
        {Array.from({ length: numPages }, (_, i) => i + 1).map(i => (
          <div key={i} style={{ transform: `scale(${zoom})`, transformOrigin: 'top center', marginBottom: zoom > 1 ? `${(zoom - 1) * 400}px` : 0 }}>
            <canvas ref={el => { canvasRefs.current[i] = el }} style={{ display: 'block', boxShadow: '0 4px 24px rgba(0,0,0,0.5)', borderRadius: 4 }} />
          </div>
        ))}
      </div>
    </div>
  )
}

export default function SecureViewer({ files, initialIndex = 0, onClose, canDownload = false, token = null, onDownload }) {
  const [idx, setIdx] = useState(Math.min(initialIndex, files.length - 1))
  const [blobUrl, setBlobUrl] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const file = files[idx]

  const loadFile = useCallback(async () => {
    if (!file) return
    setLoading(true)
    setError(null)
    if (blobUrl) URL.revokeObjectURL(blobUrl)
    try {
      let data
      if (token) {
        data = await getPublicFile(token, file.id)
      } else {
        data = await viewFile(file.id)
      }
      const blob = new Blob([data], { type: file.mime_type })
      setBlobUrl(URL.createObjectURL(blob))
    } catch (e) {
      setError(e.message || 'Failed to load file')
    } finally {
      setLoading(false)
    }
  }, [file?.id, token])

  useEffect(() => { loadFile() }, [loadFile])
  useEffect(() => () => { if (blobUrl) URL.revokeObjectURL(blobUrl) }, [blobUrl])

  // Keyboard navigation
  useEffect(() => {
    const handler = (e) => {
      if (e.key === 'Escape') onClose()
      if (e.key === 'ArrowRight') setIdx(i => Math.min(i + 1, files.length - 1))
      if (e.key === 'ArrowLeft') setIdx(i => Math.max(i - 1, 0))
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [files.length, onClose])

  const [downloadError, setDownloadError] = useState(null)

  const handleDownload = async () => {
    if (onDownload) { onDownload(file); return }
    setDownloadError(null)
    try {
      const data = await downloadFile(file.id)
      const blob = new Blob([data], { type: file.mime_type })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = file.original_name
      a.click()
      URL.revokeObjectURL(url)
    } catch (err) {
      const msg = err.response?.data?.detail || 'Download not permitted'
      setDownloadError(msg)
      setTimeout(() => setDownloadError(null), 4000)
    }
  }

  const isPdf = file?.mime_type?.includes('pdf')
  const isImage = file?.mime_type?.startsWith('image/')

  return createPortal(
    <div style={{ position: 'fixed', inset: 0, zIndex: 9999, background: 'rgba(0,0,0,0.95)', display: 'flex', flexDirection: 'column' }} onClick={(e) => e.target === e.currentTarget && onClose()}>
      {/* Toolbar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.75rem 1rem', background: 'rgba(255,255,255,0.04)', borderBottom: '1px solid rgba(255,255,255,0.08)', flexShrink: 0 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ color: 'rgba(255,255,255,0.9)', fontWeight: 600, fontSize: 14, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{file?.original_name}</div>
          <div style={{ color: 'rgba(255,255,255,0.35)', fontSize: 12 }}>{idx + 1} / {files.length} — {file?.mime_type}</div>
        </div>
        {files.length > 1 && <>
          <button className="viewer-ctrl-btn viewer-ctrl-btn--nav" onClick={() => setIdx(i => Math.max(i - 1, 0))} disabled={idx === 0}>‹ Prev</button>
          <button className="viewer-ctrl-btn viewer-ctrl-btn--nav" onClick={() => setIdx(i => Math.min(i + 1, files.length - 1))} disabled={idx === files.length - 1}>Next ›</button>
        </>}
        {canDownload && !token && <button className="viewer-ctrl-btn viewer-ctrl-btn--download" onClick={handleDownload}>⬇ Download</button>}
        <button className="viewer-ctrl-btn viewer-ctrl-btn--close" onClick={onClose}>✕ Close</button>
      </div>

      {/* Download error banner */}
      {downloadError && (
        <div style={{ padding: '0.5rem 1rem', background: 'rgba(239,68,68,0.12)', borderBottom: '1px solid rgba(239,68,68,0.3)', color: '#f87171', fontSize: 13, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <span>🚫</span> {downloadError}
        </div>
      )}

      {/* Body */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        {files.length > 1 && <FileSidebar files={files} current={idx} onChange={setIdx} />}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          {loading && <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'rgba(255,255,255,0.4)' }} className="animate-pulse">Loading…</div>}
          {error && <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#f87171' }}>{error}</div>}
          {!loading && !error && blobUrl && isPdf && <PdfViewer src={blobUrl} />}
          {!loading && !error && blobUrl && isImage && <ImageViewer src={blobUrl} mime={file?.mime_type} />}
          {!loading && !error && blobUrl && !isPdf && !isImage && (
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: '1rem', color: 'rgba(255,255,255,0.6)' }}>
              <div style={{ fontSize: '3rem' }}>📎</div>
              <div>{file?.original_name}</div>
              {canDownload && <button className="viewer-ctrl-btn viewer-ctrl-btn--download" onClick={handleDownload}>⬇ Download File</button>}
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body
  )
}
