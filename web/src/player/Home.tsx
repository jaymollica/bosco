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

function useIsDesktop() {
  const [desktop, setDesktop] = useState(() => window.innerWidth >= 768)
  useEffect(() => {
    const mq = window.matchMedia('(min-width: 768px)')
    const handler = (e: MediaQueryListEvent) => setDesktop(e.matches)
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [])
  return desktop
}

export default function Home() {
  const [trees, setTrees] = useState<PublishedTree[]>([])
  const [loading, setLoading] = useState(true)
  const [activeIndex, setActiveIndex] = useState(0)
  const scrollRef = useRef<HTMLDivElement>(null)
  const navigate = useNavigate()
  const isDesktop = useIsDesktop()

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
      const firstChild = el.firstElementChild as HTMLElement | null
      const snapWidth = firstChild?.offsetWidth || el.offsetWidth
      const index = Math.round(el.scrollLeft / snapWidth)
      setActiveIndex(index)
    }
    el.addEventListener('scroll', handleScroll, { passive: true })
    return () => el.removeEventListener('scroll', handleScroll)
  }, [trees])

  if (loading) {
    return (
      <div style={{ height: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#111' }}>
        <p style={{ color: '#555', fontSize: '0.875rem', fontFamily: 'system-ui, sans-serif' }}>Loading…</p>
      </div>
    )
  }

  if (trees.length === 0) {
    return (
      <div style={{ height: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#111' }}>
        <p style={{ color: '#555', fontSize: '0.875rem', fontFamily: 'system-ui, sans-serif' }}>No published tours yet.</p>
      </div>
    )
  }

  return (
    <div style={{
      height: '100dvh',
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
          alignItems: isDesktop ? 'center' : undefined,
          overflowX: 'auto',
          scrollSnapType: 'x mandatory',
          WebkitOverflowScrolling: 'touch',
          scrollbarWidth: 'none',
          gap: isDesktop ? '1.5rem' : 0,
          padding: isDesktop ? '0 calc(50% - 187px)' : 0,
        }}
      >
        {/* Bosco intro card */}
        <div style={{
          flex: isDesktop ? '0 0 374px' : '0 0 100%',
          height: isDesktop ? '85%' : '100%',
          maxHeight: isDesktop ? '720px' : undefined,
          scrollSnapAlign: 'center',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#111',
          color: '#fff',
          borderRadius: isDesktop ? '1.25rem' : 0,
          gap: '2rem',
        }}>
          <h1 style={{
            margin: 0,
            fontFamily: 'system-ui, sans-serif',
            fontSize: isDesktop ? '2.5rem' : '3rem',
            fontWeight: 700,
            letterSpacing: '-0.02em',
            color: 'inherit',
          }}>
            bosco
          </h1>
          <p style={{
            margin: '0 2rem',
            fontFamily: 'system-ui, sans-serif',
            fontSize: '0.95rem',
            fontWeight: 300,
            color: '#fff',
            letterSpacing: '0.01em',
            textAlign: 'center',
          }}>
            Choose your own adventure, one tap at a time.
          </p>
          <svg width={isDesktop ? 80 : 96} height={isDesktop ? 80 : 96} viewBox="0 0 48 48" fill="none">
            <rect x="21" y="28" width="6" height="14" rx="1" fill="#5a2d0c"/>
            <circle cx="16" cy="22" r="11" fill="#2db84b"/>
            <circle cx="32" cy="22" r="11" fill="#1a9e3f"/>
            <circle cx="24" cy="14" r="11" fill="#3dd65a"/>
            <path d="M38 8 L40 10 L44 5" stroke="#fff" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
          </svg>
        </div>

        {trees.map((tree) => {
          const theme = tree.theme ?? {}
          const titleFont = theme.titleFont?.family
          const textColor = theme.textColor ?? '#1a1a1a'
          const intro = tree.intro_content
          let bg = '#ffffff'
          if (theme.background?.type === 'gradient' && theme.background.css) {
            bg = theme.background.css
          } else if (theme.background?.type === 'solid' && theme.background.color) {
            bg = theme.background.color
          }

          const hasImage = !!intro?.hero_image_url
          const cardTextColor = hasImage ? '#fff' : textColor

          const handleCardClick = () => {
            navigate(`/t/${tree.slug}`)
          }

          return (
            <div
              key={tree.id}
              onClick={handleCardClick}
              style={{
                flex: isDesktop ? '0 0 374px' : '0 0 100%',
                height: isDesktop ? '85%' : '100%',
                maxHeight: isDesktop ? '720px' : undefined,
                scrollSnapAlign: 'center',
                cursor: 'pointer',
                position: 'relative',
                display: 'flex',
                flexDirection: 'column',
                background: bg,
                color: textColor,
                overflow: 'hidden',
                borderRadius: isDesktop ? '1.25rem' : 0,
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
                      borderRadius: isDesktop ? '1.25rem' : 0,
                    }}
                  />
                  <div style={{
                    position: 'absolute',
                    inset: 0,
                    background: 'linear-gradient(to bottom, rgba(0,0,0,0.5) 0%, rgba(0,0,0,0.1) 40%, rgba(0,0,0,0.05) 100%)',
                    borderRadius: isDesktop ? '1.25rem' : 0,
                  }} />
                </>
              )}

              {/* Title and description — top left */}
              <div style={{
                position: 'relative',
                padding: isDesktop ? '2rem 1.25rem 0' : '3rem 1.5rem 0',
                textAlign: 'left',
                color: cardTextColor,
              }}>
                <h1 style={{
                  margin: 0,
                  fontFamily: titleFont,
                  fontSize: isDesktop ? '2rem' : '2.75rem',
                  lineHeight: 1.15,
                  fontWeight: 700,
                  color: 'inherit',
                }}>
                  {intro?.title || tree.title}
                </h1>
              </div>

              <div style={{ flex: 1 }} />
            </div>
          )
        })}
      </div>

      <PushPrompt />

      {/* Dot indicators — floats over the cards */}
      <div style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        display: 'flex',
        justifyContent: 'center',
        gap: '0.5rem',
        padding: '1rem 0 max(2rem, env(safe-area-inset-bottom))',
        pointerEvents: 'none',
        zIndex: 50,
      }}>
        {Array.from({ length: trees.length + 1 }, (_, i) => (
          <div
            key={i}
            style={{
              width: 8,
              height: 8,
              borderRadius: '50%',
              background: i === activeIndex ? 'rgba(255,255,255,0.9)' : 'rgba(255,255,255,0.3)',
              transition: 'background 0.2s ease',
            }}
          />
        ))}
      </div>
    </div>
  )
}
