import { useEffect, useState, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import axios from 'axios'
import SankeyChart from '../shared/components/SankeyChart.js'
import type { SankeyNode, SankeyLink } from '../shared/components/SankeyChart.js'

const api = axios.create({ baseURL: '/api' })

interface Analytics {
  title: string
  stats: { total_sessions: number; completed_sessions: number }
  nodes: SankeyNode[]
  links: SankeyLink[]
}

interface Summary {
  session_id: string
  completed: boolean
  choice_ids: string[]
}

export default function Results() {
  const { slug, sessionId } = useParams<{ slug: string; sessionId: string }>()
  const navigate = useNavigate()
  const [analytics, setAnalytics] = useState<Analytics | null>(null)
  const [summary, setSummary] = useState<Summary | null>(null)
  const [error, setError] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const [chartWidth, setChartWidth] = useState(580)

  useEffect(() => {
    if (!slug || !sessionId) return
    Promise.all([
      api.get<Analytics>(`/t/${slug}/analytics`),
      api.get<Summary>(`/sessions/${sessionId}/summary`),
    ]).then(([a, s]) => {
      setAnalytics(a.data)
      setSummary(s.data)
    }).catch(() => setError(true))
  }, [slug, sessionId])

  useEffect(() => {
    if (!containerRef.current) return
    const ro = new ResizeObserver(entries => {
      const w = entries[0]?.contentRect.width
      if (w) setChartWidth(Math.min(w, 720))
    })
    ro.observe(containerRef.current)
    return () => ro.disconnect()
  }, [])

  if (error) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <p style={{ color: '#888', fontFamily: 'sans-serif' }}>Results not available.</p>
    </div>
  )

  if (!analytics || !summary) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <p style={{ color: '#aaa', fontSize: '0.875rem', fontFamily: 'sans-serif' }}>Loading…</p>
    </div>
  )

  const highlightChoiceIds = new Set(summary.choice_ids)
  const { total_sessions, completed_sessions } = analytics.stats
  const completionPct = total_sessions > 0
    ? Math.round((completed_sessions / total_sessions) * 100)
    : 0

  // Build a label map for the highlighted path
  const linksByChoiceId = new Map(analytics.links.map(l => [l.choice_id, l]))
  const pathLabels = summary.choice_ids.map(cid => linksByChoiceId.get(cid)?.label).filter(Boolean) as string[]

  return (
    <div style={{ minHeight: '100vh', background: '#fafaf8', color: '#1a1a1a' }}>
      <div style={{ maxWidth: '680px', margin: '0 auto', padding: '2.5rem 1.5rem' }}>

        {/* Header */}
        <button
          onClick={() => navigate(`/t/${slug}`)}
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#888', fontSize: '0.825rem', padding: 0, marginBottom: '1.75rem', display: 'flex', alignItems: 'center', gap: '0.3rem' }}
        >
          ← {analytics.title}
        </button>
        <h1 style={{ margin: '0 0 0.375rem', fontSize: '1.5rem', fontWeight: 700 }}>Results</h1>
        <p style={{ margin: '0 0 2.5rem', color: '#888', fontSize: '0.875rem' }}>
          {total_sessions} {total_sessions === 1 ? 'session' : 'sessions'} · {completionPct}% completed
        </p>

        {/* Your path */}
        {pathLabels.length > 0 && (
          <div style={{ marginBottom: '2.5rem' }}>
            <h2 style={{ margin: '0 0 0.875rem', fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#888' }}>
              Your path
            </h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
              {pathLabels.map((label, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'baseline', gap: '0.5rem' }}>
                  <span style={{ fontSize: '0.7rem', color: '#aaa', minWidth: '1rem' }}>{i + 1}</span>
                  <span style={{ fontSize: '0.9375rem' }}>{label}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Sankey */}
        <div style={{ marginBottom: '1rem' }}>
          <h2 style={{ margin: '0 0 1rem', fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#888' }}>
            How everyone navigated
          </h2>

          {/* Legend */}
          <div style={{ display: 'flex', gap: '1rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
            {[['intro', '#6366f1'], ['text', '#64748b'], ['image', '#8b5cf6']].map(([type, color]) => (
              <div key={type} style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.7rem', color: '#888' }}>
                <div style={{ width: 10, height: 10, borderRadius: 2, background: color as string }} />
                {type}
              </div>
            ))}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.7rem', color: '#888' }}>
              <div style={{ width: 18, height: 3, background: '#c47b2a', borderRadius: 2 }} />
              your path
            </div>
          </div>

          <div ref={containerRef} style={{ overflowX: 'auto' }}>
            {analytics.nodes.length > 0 && (
              <SankeyChart
                nodes={analytics.nodes}
                links={analytics.links}
                highlightChoiceIds={highlightChoiceIds}
                width={chartWidth}
                height={Math.max(360, analytics.nodes.filter(n => !analytics.links.some(l => l.source === n.id)).length * 46)}
              />
            )}
          </div>
        </div>

        {total_sessions === 0 && (
          <p style={{ color: '#aaa', fontSize: '0.875rem', fontStyle: 'italic' }}>
            No other sessions yet — you're the first.
          </p>
        )}
      </div>
    </div>
  )
}
