import { useEffect, useState } from 'react'
import api from '../../shared/api/client.js'

interface UploadRecord {
  id: string
  url: string
  blur_placeholder: string
  caption: string | null
  created_at: string
}

interface Props {
  onSelect: (url: string, blurPlaceholder: string, caption: string) => void
  onClose: () => void
}

export default function ImageLibrary({ onSelect, onClose }: Props) {
  const [images, setImages] = useState<UploadRecord[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.get<UploadRecord[]>('/uploads')
      .then(r => setImages(r.data))
      .finally(() => setLoading(false))
  }, [])

  return (
    <div
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
      onClick={onClose}
    >
      <div
        style={{ background: '#fff', borderRadius: '8px', width: '640px', maxHeight: '80vh', display: 'flex', flexDirection: 'column', boxShadow: '0 8px 32px rgba(0,0,0,0.2)' }}
        onClick={e => e.stopPropagation()}
      >
        <div style={{ padding: '1rem 1.25rem', borderBottom: '1px solid #eee', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontWeight: 600, fontSize: '0.9rem' }}>Image library</span>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.2rem', color: '#888' }}>×</button>
        </div>

        <div style={{ overflowY: 'auto', padding: '1rem', flex: 1 }}>
          {loading ? (
            <p style={{ color: '#888', fontSize: '0.875rem' }}>Loading…</p>
          ) : images.length === 0 ? (
            <p style={{ color: '#888', fontSize: '0.875rem' }}>No images uploaded yet.</p>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.5rem' }}>
              {images.map(img => (
                <div
                  key={img.id}
                  onClick={() => { onSelect(img.url, img.blur_placeholder, img.caption ?? ''); onClose() }}
                  style={{ borderRadius: '4px', overflow: 'hidden', cursor: 'pointer', border: '2px solid transparent' }}
                  onMouseEnter={e => (e.currentTarget.style.borderColor = '#1a1a1a')}
                  onMouseLeave={e => (e.currentTarget.style.borderColor = 'transparent')}
                >
                  <img
                    src={img.url}
                    alt={img.caption ?? ''}
                    style={{ width: '100%', aspectRatio: '1', objectFit: 'cover', display: 'block' }}
                    loading="lazy"
                  />
                  {img.caption && (
                    <div style={{ padding: '0.3rem 0.4rem', fontSize: '0.65rem', color: '#555', lineHeight: 1.3, background: '#fafafa' }}>
                      {img.caption}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
