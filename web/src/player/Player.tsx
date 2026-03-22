import { useEffect, useRef, useState } from 'react'
import { useParams } from 'react-router-dom'
import axios from 'axios'
import type { Step, Choice, Theme, IntroContent, TextContent, ImageContent, EndContent } from '../shared/types/index.js'
import IntroStep from '../shared/components/steps/IntroStep.js'
import TextStep from '../shared/components/steps/TextStep.js'
import ImageStep from '../shared/components/steps/ImageStep.js'
import ChoiceList from '../shared/components/steps/ChoiceList.js'
import VerticalSankeyChart from '../shared/components/VerticalSankeyChart.js'
import type { SankeyNode, SankeyLink } from '../shared/components/SankeyChart.js'

// Unauthenticated axios instance for public player routes
const api = axios.create({ baseURL: '/api' })

interface PlayerTree {
  id: string
  title: string
  slug: string
  tree_version_id: string
  theme: Theme
  steps: Step[]
  choices: Choice[]
}

interface AnalyticsData {
  stats: { total_sessions: number; completed_sessions: number; total_endings: number; endings_reached: number }
  nodes: SankeyNode[]
  links: SankeyLink[]
  topPaths: { choice_path: string[]; count: number }[]
}

function TapIcon({ size = 32 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M8 13V4.5a1.5 1.5 0 0 1 3 0V12" />
      <path d="M11 11.5V10a1.5 1.5 0 0 1 3 0v1.5" />
      <path d="M14 12v-1a1.5 1.5 0 0 1 3 0v1.5" />
      <path d="M17 12.5a1.5 1.5 0 0 1 3 0V16a6 6 0 0 1-6 6h-2a6 6 0 0 1-5.2-3l-2.5-4.3a1.5 1.5 0 0 1 2.1-2L8 13" />
      <path d="M5 4a3 3 0 0 0-3 3" opacity="0.4" />
      <path d="M3 1a6 6 0 0 0-3 5.2" opacity="0.25" />
    </svg>
  )
}

function buildFontUrl(theme: Theme): string | null {
  const families: string[] = []
  const addFont = (font?: { family: string; weight: string }) => {
    if (font?.family) families.push(`${font.family.replace(/ /g, '+')}:wght@${font.weight || '400'}`)
  }
  addFont(theme.titleFont)
  if (theme.bodyFont?.family !== theme.titleFont?.family) addFont(theme.bodyFont)
  if (families.length === 0) return null
  return `https://fonts.googleapis.com/css2?${families.map(f => `family=${f}`).join('&')}&display=swap`
}

export default function Player() {
  const { slug } = useParams<{ slug: string }>()
  const [tree, setTree] = useState<PlayerTree | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [currentStepId, setCurrentStepId] = useState<string | null>(null)
  const [visible, setVisible] = useState(true)
  const completedRef = useRef(false)
  const introIdRef = useRef<string | null>(null)
  const [showResults, setShowResults] = useState(false)
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null)
  const [sessionChoiceIds, setSessionChoiceIds] = useState<string[]>([])
  const [otherTours, setOtherTours] = useState<{ id: string; title: string; slug: string; theme?: Theme; intro_content?: { title?: string; description?: string } }[]>([])

  // Load tree + create session
  useEffect(() => {
    if (!slug) return
    api.get<PlayerTree>(`/t/${slug}`)
      .then(async r => {
        const data = r.data
        setTree(data)
        const intro = data.steps.find(s => s.type === 'intro')
        if (intro) {
          setCurrentStepId(intro.id)
          introIdRef.current = intro.id
        }
        try {
          const session = await api.post<{ id: string }>('/sessions', {
            tree_id: data.id,
            tree_version_id: data.tree_version_id,
          })
          setSessionId(session.data.id)
        } catch { /* non-critical */ }
      })
      .catch(() => setError('This tree is not available.'))
  }, [slug])

  // Record step arrival
  useEffect(() => {
    if (!sessionId || !currentStepId) return
    api.post(`/sessions/${sessionId}/events`, { step_id: currentStepId }).catch(() => {})
  }, [sessionId, currentStepId])

  // Complete session when landing on a step with no outgoing choices (true end)
  useEffect(() => {
    if (!sessionId || !currentStepId || !tree || completedRef.current) return
    const hasChoices = tree.choices.some(c => c.from_step_id === currentStepId)
    if (!hasChoices) {
      completedRef.current = true
      api.post(`/sessions/${sessionId}/complete`).catch(() => {})
    }
  }, [sessionId, currentStepId, tree])

  // Inject Google Fonts link
  useEffect(() => {
    if (!tree?.theme) return
    const url = buildFontUrl(tree.theme)
    if (!url) return
    const existing = document.getElementById('bosco-fonts')
    if (existing) existing.remove()
    const link = document.createElement('link')
    link.id = 'bosco-fonts'
    link.rel = 'stylesheet'
    link.href = url
    document.head.appendChild(link)
    return () => { link.remove() }
  }, [tree?.theme])

  const navigate = (choiceId: string, toStepId: string) => {
    if (sessionId && currentStepId) {
      api.post(`/sessions/${sessionId}/events`, {
        step_id: currentStepId,
        choice_id: choiceId,
      }).catch(() => {})
    }
    doNavigate(toStepId)
  }

  const doNavigate = (toStepId: string) => {
    setVisible(false)
    setTimeout(() => {
      setCurrentStepId(toStepId)
      setVisible(true)
    }, 400)
  }

  const handlePlayAgain = () => {
    const introId = introIdRef.current
    if (!introId) return
    setShowResults(false)
    setAnalytics(null)
    setSessionChoiceIds([])
    completedRef.current = false
    // Create a new session
    if (tree) {
      api.post<{ id: string }>('/sessions', {
        tree_id: tree.id,
        tree_version_id: tree.tree_version_id,
      }).then(r => setSessionId(r.data.id)).catch(() => {})
    }
    doNavigate(introId)
  }

  const handleShowResults = () => {
    if (!slug || !sessionId) return
    // Fetch analytics, session summary, and other tours in parallel
    Promise.all([
      api.get<AnalyticsData>(`/t/${slug}/analytics`),
      api.get<{ choice_ids: string[] }>(`/sessions/${sessionId}/summary`),
      api.get<{ id: string; title: string; slug: string; theme?: Theme; intro_content?: { title?: string; description?: string } }[]>('/published'),
    ]).then(([a, s, p]) => {
      setAnalytics(a.data)
      setSessionChoiceIds(s.data.choice_ids)
      setOtherTours(p.data.filter(t => t.slug !== slug))
    }).catch(() => {})

    setVisible(false)
    setTimeout(() => {
      setShowResults(true)
      setVisible(true)
    }, 400)
  }

  if (error) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'sans-serif' }}>
        <p style={{ color: '#888' }}>{error}</p>
      </div>
    )
  }

  if (!tree || !currentStepId) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'sans-serif' }}>
        <p style={{ color: '#aaa', fontSize: '0.875rem' }}>Loading…</p>
      </div>
    )
  }

  const theme = tree.theme ?? {}
  const currentStep = tree.steps.find(s => s.id === currentStepId)
  if (!currentStep) return null

  const stepChoices = tree.choices
    .filter(c => c.from_step_id === currentStepId)
    .sort((a, b) => a.sort_order - b.sort_order)

  const titleFont = theme.titleFont?.family
  const bodyFont = theme.bodyFont?.family
  const textColor = theme.textColor ?? '#1a1a1a'

  let background = '#ffffff'
  if (theme.background?.type === 'gradient' && theme.background.css) {
    background = theme.background.css
  } else if (theme.background?.type === 'solid' && theme.background.color) {
    background = theme.background.color
  }

  const stepProps = { titleFont, bodyFont }

  // Compute results stats
  let completionPct = 0
  let samePathPct = 0
  if (analytics) {
    const { completed_sessions, total_endings, endings_reached } = analytics.stats
    completionPct = total_endings > 0 ? Math.round((endings_reached / total_endings) * 100) : 0

    // Find how many people took the same path
    if (sessionChoiceIds.length > 0 && analytics.topPaths?.length > 0) {
      const myKey = sessionChoiceIds.join(',')
      const match = analytics.topPaths.find(p => p.choice_path.join(',') === myKey)
      if (match && completed_sessions > 0) {
        samePathPct = Math.round((match.count / completed_sessions) * 100)
      }
    }
  }

  const highlightSet = new Set(sessionChoiceIds)

  return (
    <div
      style={{
        height: '100vh',
        background,
        color: textColor,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        boxSizing: 'border-box',
        overflow: 'hidden',
        position: 'fixed',
        inset: 0,
      }}
    >
      <div
        key={showResults ? 'results' : currentStepId}
        style={{
          width: '100%',
          maxWidth: '540px',
          opacity: visible ? 1 : 0,
          transition: 'opacity 0.4s ease',
          boxSizing: 'border-box',
        }}
      >
        {!showResults && currentStep.type === 'intro' && (
          <IntroStep
            content={currentStep.content as IntroContent}
            choices={stepChoices}
            onChoose={navigate}
            {...stepProps}
          />
        )}
        {!showResults && currentStep.type === 'text' && (
          <TextStep
            content={currentStep.content as TextContent}
            choices={stepChoices}
            onChoose={navigate}
            {...stepProps}
          />
        )}
        {!showResults && currentStep.type === 'image' && (
          <ImageStep
            content={currentStep.content as ImageContent}
            choices={stepChoices}
            onChoose={navigate}
            {...stepProps}
          />
        )}
        {!showResults && currentStep.type === 'end' && stepChoices.length > 0 && (
          <div style={{ width: '100%' }}>
            <ChoiceList choices={stepChoices} onChoose={navigate} bodyFont={bodyFont} />
          </div>
        )}
        {!showResults && stepChoices.length === 0 && (
          <EndChoices
            content={currentStep.type === 'end' ? currentStep.content as EndContent : undefined}
            onShowResults={handleShowResults}
            bodyFont={bodyFont}
          />
        )}
        {showResults && (
          <ResultsView
            analytics={analytics}
            completionPct={completionPct}
            samePathPct={samePathPct}
            highlightChoiceIds={highlightSet}
            onPlayAgain={handlePlayAgain}
            bodyFont={bodyFont}
            titleFont={titleFont}
            slug={slug!}
            otherTours={otherTours}
          />
        )}
      </div>
    </div>
  )
}

/** Zelle-style two-tile end choices — labels from end step content, both go to results */
function EndChoices({ content, onShowResults, bodyFont }: {
  content?: EndContent
  onShowResults: () => void
  bodyFont?: string
}) {
  const [chosen, setChosen] = useState<string | null>(null)

  const label1 = content?.title || 'The end'
  const label2 = content?.summary || 'See your journey'

  const handleClick = (action: string) => {
    if (chosen) return
    setChosen(action)
    setTimeout(onShowResults, 500)
  }

  const tile = (action: string, label: string, i: number) => {
    const isChosen = chosen === action
    return (
      <button
        key={action}
        onClick={() => handleClick(action)}
        disabled={!!chosen}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          height: '50vh',
          width: '100%',
          padding: '2rem',
          border: 'none',
          background: isChosen
            ? 'rgba(0,0,0,0.06)'
            : i % 2 === 1
              ? 'rgba(0,0,0,0.03)'
              : 'transparent',
          color: 'inherit',
          fontSize: '1.75rem',
          fontFamily: bodyFont,
          fontWeight: 300,
          letterSpacing: '0.01em',
          lineHeight: 1.3,
          cursor: chosen ? 'default' : 'pointer',
          opacity: chosen && !isChosen ? 0.15 : 1,
          textAlign: 'center',
          transition: 'opacity 0.5s ease, background 0.5s ease',
          boxSizing: 'border-box',
        }}
      >
        {label}
      </button>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', width: '100%' }}>
      {tile('a', label1, 0)}
      {tile('b', label2, 1)}
    </div>
  )
}

/** Inline results: vertical Sankey + stats — fits in one viewport, swipe for other tours */
function ResultsView({ analytics, completionPct, samePathPct, highlightChoiceIds, onPlayAgain, bodyFont, titleFont, slug, otherTours }: {
  analytics: AnalyticsData | null
  completionPct: number
  samePathPct: number
  highlightChoiceIds: Set<string>
  onPlayAgain: () => void
  bodyFont?: string
  titleFont?: string
  slug: string
  otherTours: { id: string; title: string; slug: string; theme?: Theme; intro_content?: { title?: string; description?: string } }[]
}) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [dims, setDims] = useState({ w: 280, h: 300 })
  const [showShare, setShowShare] = useState(false)
  useEffect(() => {
    if (!containerRef.current) return
    const ro = new ResizeObserver(entries => {
      const r = entries[0]?.contentRect
      if (r) setDims({ w: r.width, h: r.height })
    })
    ro.observe(containerRef.current)
    return () => ro.disconnect()
  }, [])

  const shareUrl = `${window.location.origin}/t/${slug}`

  return (
    <div style={{
      width: '100%',
      height: '100vh',
      display: 'flex',
      overflowX: 'auto',
      overflowY: 'hidden',
      scrollSnapType: 'x mandatory',
      WebkitOverflowScrolling: 'touch',
      scrollbarWidth: 'none',
    }}>
      {/* First card: results */}
      <div style={{
        flex: '0 0 100%',
        height: '100%',
        scrollSnapAlign: 'start',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}>
        {/* Stats — side by side */}
        <div style={{ display: 'flex', justifyContent: 'center', gap: '3rem', padding: '2rem 1.5rem 1rem' }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '2.5rem', fontWeight: 300, fontFamily: titleFont, lineHeight: 1 }}>
              {completionPct}%
            </div>
            <div style={{ fontSize: '0.75rem', opacity: 0.5, fontFamily: bodyFont, marginTop: '0.375rem' }}>
              explored
            </div>
          </div>
          {samePathPct > 0 && (
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '2.5rem', fontWeight: 300, fontFamily: titleFont, lineHeight: 1 }}>
                {samePathPct}%
              </div>
              <div style={{ fontSize: '0.75rem', opacity: 0.5, fontFamily: bodyFont, marginTop: '0.375rem' }}>
                took your path
              </div>
            </div>
          )}
        </div>

        {/* Vertical Sankey — fills remaining space */}
        <div ref={containerRef} style={{ flex: 1, minHeight: 0, padding: '0 2rem' }}>
          {analytics && analytics.nodes.length > 0 && dims.h > 0 && (
            <VerticalSankeyChart
              nodes={analytics.nodes}
              links={analytics.links}
              highlightChoiceIds={highlightChoiceIds}
              width={dims.w}
              height={dims.h}
            />
          )}
        </div>

        {/* Bottom buttons — side by side */}
        <div style={{ display: 'flex', flexShrink: 0, height: '15vh', padding: '0 2rem' }}>
          <button
            onClick={onPlayAgain}
            style={{
              flex: 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '1rem',
              border: 'none',
              background: 'transparent',
              color: 'inherit',
              fontSize: '1.5rem',
              fontFamily: bodyFont,
              fontWeight: 300,
              letterSpacing: '0.01em',
              cursor: 'pointer',
              boxSizing: 'border-box',
            }}
          >
            Play again
          </button>
          <button
            onClick={() => setShowShare(true)}
            style={{
              flex: 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '1rem',
              border: 'none',
              background: 'rgba(0,0,0,0.03)',
              color: 'inherit',
              fontSize: '1.5rem',
              fontFamily: bodyFont,
              fontWeight: 300,
              letterSpacing: '0.01em',
              cursor: 'pointer',
              boxSizing: 'border-box',
            }}
          >
            Share
          </button>
        </div>

        {showShare && (
          <ShareModal url={shareUrl} onClose={() => setShowShare(false)} bodyFont={bodyFont} />
        )}
      </div>

      {/* Subsequent cards: other tours */}
      {otherTours.map((tour) => {
        const t = tour.theme ?? {}
        const tFont = t.titleFont?.family
        const bFont = t.bodyFont?.family
        const tColor = t.textColor ?? '#1a1a1a'
        let bg = '#ffffff'
        if (t.background?.type === 'gradient' && t.background.css) bg = t.background.css
        else if (t.background?.type === 'solid' && t.background.color) bg = t.background.color

        return (
          <div
            key={tour.id}
            onClick={() => { window.location.href = `/t/${tour.slug}` }}
            style={{
              flex: '0 0 100%',
              height: '100%',
              scrollSnapAlign: 'start',
              display: 'flex',
              flexDirection: 'column',
              background: bg,
              color: tColor,
              cursor: 'pointer',
              overflow: 'hidden',
            }}
          >
            <div style={{ padding: '3rem 1.5rem 0', textAlign: 'left' }}>
              <h1 style={{
                margin: '0 0 0.75rem',
                fontFamily: tFont,
                fontSize: '2.75rem',
                lineHeight: 1.15,
                fontWeight: 700,
                color: 'inherit',
              }}>
                {tour.intro_content?.title || tour.title}
              </h1>
              {tour.intro_content?.description && (
                <p style={{
                  margin: 0,
                  fontFamily: bFont,
                  fontSize: '1rem',
                  lineHeight: 1.6,
                }}>
                  {tour.intro_content.description}
                </p>
              )}
            </div>
            <div style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.5rem',
              opacity: 0.4,
            }}>
              <TapIcon size={48} />
              <span style={{ fontSize: '0.75rem', fontFamily: bFont, fontWeight: 300, letterSpacing: '0.05em' }}>
                tap to begin
              </span>
            </div>
          </div>
        )
      })}
    </div>
  )
}

/** Share modal with QR code and copyable URL */
function ShareModal({ url, onClose, bodyFont }: { url: string; onClose: () => void; bodyFont?: string }) {
  const [qrDataUrl, setQrDataUrl] = useState<string>('')
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    import('qrcode').then(QRCode => {
      QRCode.toDataURL(url, { margin: 1, width: 200, color: { dark: '#000000', light: '#00000000' } })
        .then(setQrDataUrl)
        .catch(() => {})
    }).catch(() => {})
  }, [url])

  const handleCopy = () => {
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        zIndex: 100,
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: '#fff', borderRadius: '12px', padding: '2rem',
          width: '85vw', maxWidth: '320px', textAlign: 'center',
          color: '#1a1a1a',
        }}
      >
        {/* QR code */}
        {qrDataUrl && (
          <img
            src={qrDataUrl}
            alt="QR code"
            style={{ display: 'block', margin: '0 auto 1.5rem', width: '200px', height: '200px' }}
          />
        )}

        {/* URL */}
        <div style={{
          fontSize: '0.8125rem', fontFamily: bodyFont, padding: '0.625rem',
          background: '#f4f4f2', borderRadius: '6px', wordBreak: 'break-all',
          marginBottom: '1rem', userSelect: 'all',
        }}>
          {url}
        </div>

        {/* Copy button */}
        <button
          onClick={handleCopy}
          style={{
            width: '100%', padding: '0.75rem', border: '1px solid #ddd',
            borderRadius: '6px', background: copied ? '#f0faf0' : '#fff',
            fontSize: '0.875rem', fontFamily: bodyFont, cursor: 'pointer',
            color: '#1a1a1a',
          }}
        >
          {copied ? 'Copied' : 'Copy link'}
        </button>
      </div>
    </div>
  )
}
