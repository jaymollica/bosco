import { useState, useEffect, useRef } from 'react'
import type { Theme } from '../../shared/types/index.js'
import api from '../../shared/api/client.js'

interface FontMeta { family: string; variants: string[] }

// Module-level cache so it survives re-renders and panel close/open
let fontsCache: FontMeta[] | null = null

function loadGoogleFont(family: string) {
  const id = `gfont-${family.replace(/\s+/g, '-')}`
  if (document.getElementById(id)) return
  const link = document.createElement('link')
  link.id = id
  link.rel = 'stylesheet'
  link.href = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(family)}:wght@400;500;600;700&display=swap`
  document.head.appendChild(link)
}

interface FontPickerProps {
  label: string
  value: string
  fonts: FontMeta[]
  loading: boolean
  onChange: (family: string) => void
}

function FontPicker({ label, value, fonts, loading, onChange }: FontPickerProps) {
  const [search, setSearch] = useState('')
  const [open, setOpen] = useState(false)
  const listRef = useRef<HTMLDivElement>(null)

  // Show first 100 matches to keep the list snappy
  const filtered = search
    ? fonts.filter(f => f.family.toLowerCase().includes(search.toLowerCase())).slice(0, 100)
    : fonts.slice(0, 100)

  useEffect(() => { if (value) loadGoogleFont(value) }, [value])

  // Load visible fonts as you scroll/search
  useEffect(() => {
    filtered.forEach(f => loadGoogleFont(f.family))
  }, [filtered])

  return (
    <div style={{ marginBottom: '1rem', position: 'relative' }}>
      <div style={{ fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#555', marginBottom: '0.4rem' }}>{label}</div>
      <div
        onClick={() => !loading && setOpen(o => !o)}
        style={{ padding: '0.5rem 0.75rem', border: '1px solid #ddd', borderRadius: '4px', cursor: loading ? 'default' : 'pointer', fontSize: '0.875rem', fontFamily: value || 'inherit', background: '#fff', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
      >
        <span style={{ color: value ? 'inherit' : '#aaa' }}>{loading ? 'Loading fonts…' : value || 'Select font…'}</span>
        <span style={{ color: '#aaa', fontSize: '0.7rem' }}>▾</span>
      </div>
      {open && (
        <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: '#fff', border: '1px solid #ddd', borderRadius: '4px', zIndex: 100, boxShadow: '0 4px 12px rgba(0,0,0,0.1)', marginTop: '2px' }}>
          <input
            autoFocus
            placeholder={`Search ${fonts.length} fonts…`}
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{ display: 'block', width: '100%', padding: '0.5rem 0.75rem', border: 'none', borderBottom: '1px solid #eee', boxSizing: 'border-box', fontSize: '0.825rem', outline: 'none' }}
          />
          <div ref={listRef} style={{ maxHeight: '200px', overflowY: 'auto' }}>
            {filtered.map(font => (
              <div
                key={font.family}
                onClick={() => { onChange(font.family); setOpen(false); setSearch('') }}
                style={{ padding: '0.5rem 0.75rem', cursor: 'pointer', fontSize: '0.875rem', fontFamily: font.family, background: font.family === value ? '#f3f3f3' : 'transparent' }}
              >
                {font.family}
              </div>
            ))}
            {filtered.length === 0 && (
              <div style={{ padding: '0.75rem', fontSize: '0.8rem', color: '#aaa' }}>No fonts found</div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

interface Props {
  theme: Theme
  onUpdate: (theme: Theme) => void
  onClose: () => void
}

export default function ThemePanel({ theme, onUpdate, onClose }: Props) {
  const [fonts, setFonts] = useState<FontMeta[]>([])
  const [fontsLoading, setFontsLoading] = useState(true)

  useEffect(() => {
    if (fontsCache) { setFonts(fontsCache); setFontsLoading(false); return }
    api.get<FontMeta[]>('/fonts').then(r => {
      fontsCache = r.data
      setFonts(r.data)
    }).finally(() => setFontsLoading(false))
  }, [])

  const bg = theme.background ?? { type: 'solid' as const, color: '#ffffff' }
  const isGradient = bg.type === 'gradient'

  const set = (patch: Partial<Theme>) => onUpdate({ ...theme, ...patch })

  const setBg = (patch: Partial<typeof bg>) =>
    set({ background: { ...bg, ...patch } as Theme['background'] })

  return (
    <div style={{ position: 'fixed', right: 0, top: 0, bottom: 0, width: '300px', background: '#fff', borderLeft: '1px solid #eee', overflowY: 'auto', zIndex: 10, boxShadow: '-2px 0 8px rgba(0,0,0,0.06)' }}>
      <div style={{ padding: '1rem', borderBottom: '1px solid #eee', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontWeight: 600, fontSize: '0.875rem' }}>Theme</span>
        <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.2rem', color: '#888' }}>×</button>
      </div>

      <div style={{ padding: '1rem' }}>

        {/* Fonts */}
        <FontPicker
          label="Title font"
          value={theme.titleFont?.family ?? ''}
          fonts={fonts}
          loading={fontsLoading}
          onChange={family => set({ titleFont: { family, weight: '700' } })}
        />
        <FontPicker
          label="Display font"
          value={theme.bodyFont?.family ?? ''}
          fonts={fonts}
          loading={fontsLoading}
          onChange={family => set({ bodyFont: { family, weight: '400' } })}
        />

        {/* Text color */}
        <div style={{ marginBottom: '1rem' }}>
          <div style={{ fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#555', marginBottom: '0.4rem' }}>Font color</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <input
              type="color"
              value={theme.textColor ?? '#1a1a1a'}
              onChange={e => set({ textColor: e.target.value })}
              style={{ width: '40px', height: '32px', border: '1px solid #ddd', borderRadius: '4px', cursor: 'pointer', padding: '2px' }}
            />
            <input
              type="text"
              value={theme.textColor ?? '#1a1a1a'}
              onChange={e => set({ textColor: e.target.value })}
              style={{ flex: 1, padding: '0.375rem 0.5rem', border: '1px solid #ddd', borderRadius: '4px', fontFamily: 'monospace', fontSize: '0.825rem' }}
            />
          </div>
        </div>

        {/* Background type toggle */}
        <div style={{ marginBottom: '0.75rem' }}>
          <div style={{ fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#555', marginBottom: '0.4rem' }}>Background</div>
          <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.75rem' }}>
            {(['solid', 'gradient'] as const).map(type => (
              <button
                key={type}
                onClick={() => setBg({ type })}
                style={{ padding: '0.3rem 0.75rem', fontSize: '0.775rem', borderRadius: '4px', cursor: 'pointer', border: '1px solid', borderColor: bg.type === type ? '#1a1a1a' : '#ddd', background: bg.type === type ? '#1a1a1a' : '#fff', color: bg.type === type ? '#fff' : '#555', textTransform: 'capitalize' }}
              >
                {type}
              </button>
            ))}
          </div>

          {!isGradient ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <input
                type="color"
                value={bg.color ?? '#ffffff'}
                onChange={e => setBg({ color: e.target.value })}
                style={{ width: '40px', height: '32px', border: '1px solid #ddd', borderRadius: '4px', cursor: 'pointer', padding: '2px' }}
              />
              <input
                type="text"
                value={bg.color ?? '#ffffff'}
                onChange={e => setBg({ color: e.target.value })}
                style={{ flex: 1, padding: '0.375rem 0.5rem', border: '1px solid #ddd', borderRadius: '4px', fontFamily: 'monospace', fontSize: '0.825rem' }}
              />
            </div>
          ) : (
            <>
              <textarea
                value={bg.css ?? ''}
                onChange={e => setBg({ css: e.target.value })}
                placeholder="linear-gradient(135deg, #f5c6a0 0%, #a0c4f5 100%)"
                rows={3}
                style={{ width: '100%', padding: '0.5rem', border: '1px solid #ddd', borderRadius: '4px', fontFamily: 'monospace', fontSize: '0.775rem', boxSizing: 'border-box', resize: 'vertical' as const }}
              />
              <a
                href="https://www.joshwcomeau.com/gradient-generator/"
                target="_blank"
                rel="noreferrer"
                style={{ display: 'inline-block', marginTop: '0.4rem', fontSize: '0.775rem', color: '#666', textDecoration: 'underline' }}
              >
                Generate a gradient ↗
              </a>
            </>
          )}
        </div>

        {/* Live preview */}
        <div style={{ marginTop: '1.25rem', borderTop: '1px solid #eee', paddingTop: '1rem' }}>
          <div style={{ fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#555', marginBottom: '0.5rem' }}>Preview</div>
          <div style={{
            borderRadius: '6px',
            padding: '1.25rem',
            background: isGradient ? (bg.css ?? '#ffffff') : (bg.color ?? '#ffffff'),
            color: theme.textColor ?? '#1a1a1a',
          }}>
            <div style={{ fontFamily: theme.titleFont?.family ?? 'inherit', fontWeight: 700, fontSize: '1.1rem', marginBottom: '0.5rem' }}>
              Title font preview
            </div>
            <div style={{ fontFamily: theme.bodyFont?.family ?? 'inherit', fontSize: '0.875rem', opacity: 0.85 }}>
              Display font for body copy and choices.
            </div>
          </div>
        </div>

      </div>
    </div>
  )
}
