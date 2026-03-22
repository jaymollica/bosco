import { useEffect, useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import axios from 'axios'
import PushPrompt from './PushPrompt.js'

const api = axios.create({ baseURL: '/api' })

interface Theme {
  titleFont?: { family: string; weight: string }
  bodyFont?: { family: string; weight: string }
  textColor?: string
  background?: { type: string; color?: string; css?: string }
}

interface PublishedTree {
  id: string
  title: string
  slug: string
  published_at: string
  theme?: Theme
  intro_content?: { title?: string; description?: string; hero_image_url?: string; blur_placeholder?: string }
}

function buildFontUrl(trees: PublishedTree[]): string | null {
  const families = new Set<string>()
  for (const t of trees) {
    if (t.theme?.titleFont?.family) families.add(`${t.theme.titleFont.family}:wght@${t.theme.titleFont.weight || '700'}`)
    if (t.theme?.bodyFont?.family) families.add(`${t.theme.bodyFont.family}:wght@${t.theme.bodyFont.weight || '400'}`)
  }
  if (families.size === 0) return null
  return `https://fonts.googleapis.com/css2?${[...families].map(f => `family=${f.replace(/ /g, '+')}`).join('&')}&display=swap`
}

export default function Home() {
  const [trees, setTrees] = useState<PublishedTree[]>([])
  const [loading, setLoading] = useState(true)
  const [activeIndex, setActiveIndex] = useState(0)
  const scrollRef = useRef<HTMLDivElement>(null)
  const navigate = useNavigate()

  useEffect(() => {
    api.get<PublishedTree[]>('/published')
      .then(r => setTrees(r.data))
      .finally(() => setLoading(false))
  }, [])

  // Load fonts for all tours
  useEffect(() => {
    if (trees.length === 0) return
    const url = buildFontUrl(trees)
    if (!url) return
    const existing = document.getElementById('bosco-home-fonts')
    if (existing) existing.remove()
    const link = document.createElement('link')
    link.id = 'bosco-home-fonts'
    link.rel = 'stylesheet'
    link.href = url
    document.head.appendChild(link)
    return () => { link.remove() }
  }, [trees])

  // Track which card is in view
  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    const handleScroll = () => {
      const cardWidth = el.offsetWidth
      const index = Math.round(el.scrollLeft / cardWidth)
      setActiveIndex(index)
    }
    el.addEventListener('scroll', handleScroll, { passive: true })
    return () => el.removeEventListener('scroll', handleScroll)
  }, [trees])

  if (loading) {
    return (
      <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#111' }}>
        <p style={{ color: '#555', fontSize: '0.875rem', fontFamily: 'system-ui, sans-serif' }}>Loading…</p>
      </div>
    )
  }

  if (trees.length === 0) {
    return (
      <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#111' }}>
        <p style={{ color: '#555', fontSize: '0.875rem', fontFamily: 'system-ui, sans-serif' }}>No published tours yet.</p>
      </div>
    )
  }

  return (
    <div style={{
      height: '100vh',
      background: '#111',
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden',
      position: 'fixed',
      inset: 0,
    }}>
      {/* Scrollable card strip */}
      <div
        ref={scrollRef}
        style={{
          flex: 1,
          display: 'flex',
          overflowX: 'auto',
          scrollSnapType: 'x mandatory',
          WebkitOverflowScrolling: 'touch',
          scrollbarWidth: 'none',
        }}
      >
        {trees.map((tree) => {
          const theme = tree.theme ?? {}
          const titleFont = theme.titleFont?.family
          const bodyFont = theme.bodyFont?.family
          const textColor = theme.textColor ?? '#1a1a1a'
          const intro = tree.intro_content

          let bg = '#ffffff'
          if (theme.background?.type === 'gradient' && theme.background.css) {
            bg = theme.background.css
          } else if (theme.background?.type === 'solid' && theme.background.color) {
            bg = theme.background.color
          }

          const hasImage = !!intro?.hero_image_url

          return (
            <div
              key={tree.id}
              onClick={() => navigate(`/t/${tree.slug}`)}
              style={{
                flex: '0 0 100%',
                height: '100%',
                scrollSnapAlign: 'start',
                cursor: 'pointer',
                position: 'relative',
                display: 'flex',
                flexDirection: 'column',
                background: bg,
                color: textColor,
                overflow: 'hidden',
              }}
            >
              {/* Background image if present */}
              {hasImage && (
                <>
                  <img
                    src={intro!.hero_image_url!}
                    alt=""
                    style={{
                      position: 'absolute',
                      inset: 0,
                      width: '100%',
                      height: '100%',
                      objectFit: 'cover',
                    }}
                  />
                  <div style={{
                    position: 'absolute',
                    inset: 0,
                    background: 'linear-gradient(to bottom, rgba(0,0,0,0.5) 0%, rgba(0,0,0,0.1) 40%, rgba(0,0,0,0.05) 100%)',
                  }} />
                </>
              )}

              {/* Title and description — top left */}
              <div style={{
                position: 'relative',
                padding: '3rem 1.5rem 0',
                textAlign: 'left',
                color: hasImage ? '#fff' : textColor,
              }}>
                <h1 style={{
                  margin: '0 0 0.75rem',
                  fontFamily: titleFont,
                  fontSize: '2.75rem',
                  lineHeight: 1.15,
                  fontWeight: 700,
                  color: 'inherit',
                }}>
                  {intro?.title || tree.title}
                </h1>
                {intro?.description && (
                  <p style={{
                    margin: 0,
                    fontFamily: bodyFont,
                    fontSize: '1rem',
                    lineHeight: 1.6,
                  }}>
                    {intro.description}
                  </p>
                )}
              </div>

              <div style={{ flex: 1 }} />
            </div>
          )
        })}
      </div>

      <PushPrompt />

      {/* Dot indicators */}
      {trees.length > 1 && (
        <div style={{
          display: 'flex',
          justifyContent: 'center',
          gap: '0.5rem',
          padding: '1rem 0 2rem',
        }}>
          {trees.map((_, i) => (
            <div
              key={i}
              style={{
                width: 8,
                height: 8,
                borderRadius: '50%',
                background: i === activeIndex ? '#fff' : 'rgba(255,255,255,0.3)',
                transition: 'background 0.2s ease',
              }}
            />
          ))}
        </div>
      )}
    </div>
  )
}
