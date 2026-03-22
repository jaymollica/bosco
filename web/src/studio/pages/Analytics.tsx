import { useEffect, useState, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { getTreeAnalytics } from '../../shared/api/trees.js'
import SankeyChart from '../../shared/components/SankeyChart.js'
import type { SankeyNode, SankeyLink } from '../../shared/components/SankeyChart.js'

interface Analytics {
  title: string
  stats: { total_sessions: number; completed_sessions: number }
  nodes: SankeyNode[]
  links: SankeyLink[]
  topPaths: { choice_path: string[]; count: number }[]
}

export default function Analytics() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [data, setData] = useState<Analytics | null>(null)
  const [error, setError] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const [chartWidth, setChartWidth] = useState(700)

  useEffect(() => {
    if (!id) return
    getTreeAnalytics(id).then(setData).catch(() => setError(true))
  }, [id])

  useEffect(() => {
    if (!containerRef.current) return
    const ro = new ResizeObserver(entries => {
      const w = entries[0]?.contentRect.width
      if (w) setChartWidth(Math.min(w, 900))
    })
    ro.observe(containerRef.current)
    return () => ro.disconnect()
  }, [])

  if (error) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'system-ui, sans-serif' }}>
      <p style={{ color: '#888' }}>Could not load analytics.</p>
    </div>
  )

  if (!data) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'system-ui, sans-serif' }}>
      <p style={{ color: '#aaa', fontSize: '0.875rem' }}>Loading...</p>
    </div>
  )

  const { stats, nodes, links, topPaths } = data
  const completionPct = stats.total_sessions > 0
    ? Math.round((stats.completed_sessions / stats.total_sessions) * 100)
    : 0

  // Build a lookup from choice_id → label for top paths display
  const choiceLabelMap = new Map(links.map(l => [l.choice_id, l.label]))

  return (
    <div style={{ minHeight: '100vh', background: '#fafaf8', fontFamily: 'system-ui, sans-serif', color: '#1a1a1a' }}>
      <div style={{ maxWidth: '960px', margin: '0 auto', padding: '2rem 1.5rem 4rem' }}>

        {/* Header */}
        <button
          onClick={() => navigate(`/studio/trees/${id}`)}
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#888', fontSize: '0.825rem', padding: 0, marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.3rem' }}
        >
          ← Back to editor
        </button>

        <h1 style={{ margin: '0 0 0.25rem', fontSize: '1.5rem', fontWeight: 700 }}>
          {data.title}
        </h1>
        <p style={{ margin: '0 0 2.5rem', color: '#888', fontSize: '0.875rem' }}>Analytics</p>

        {/* Stats cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '1rem', marginBottom: '3rem' }}>
          <StatCard label="Total sessions" value={stats.total_sessions} />
          <StatCard label="Completed" value={stats.completed_sessions} />
          <StatCard label="Completion rate" value={`${completionPct}%`} />
          <StatCard label="Drop-off" value={`${stats.total_sessions > 0 ? 100 - completionPct : 0}%`} />
        </div>

        {/* Sankey */}
        {nodes.length > 0 && (
          <div style={{ marginBottom: '3rem' }}>
            <SectionHeader>Flow</SectionHeader>

            {/* Legend */}
            <div style={{ display: 'flex', gap: '1rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
              {[['intro', '#6366f1'], ['text', '#64748b'], ['image', '#8b5cf6'], ['end', '#10b981']].map(([type, color]) => (
                <div key={type} style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.7rem', color: '#888' }}>
                  <div style={{ width: 10, height: 10, borderRadius: 2, background: color as string }} />
                  {type}
                </div>
              ))}
            </div>

            <div ref={containerRef} style={{ overflowX: 'auto', background: '#fff', border: '1px solid #eee', borderRadius: '8px', padding: '1.5rem' }}>
              <SankeyChart
                nodes={nodes}
                links={links}
                width={chartWidth}
                height={Math.max(360, nodes.filter(n => n.type === 'end').length * 46)}
              />
            </div>
          </div>
        )}

        {/* Top paths */}
        {topPaths.length > 0 && (
          <div style={{ marginBottom: '3rem' }}>
            <SectionHeader>Most traveled paths</SectionHeader>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {topPaths.map((p, i) => (
                <div key={i} style={{ background: '#fff', border: '1px solid #eee', borderRadius: '8px', padding: '1rem 1.25rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '0.5rem' }}>
                    <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#888' }}>Path {i + 1}</span>
                    <span style={{ fontSize: '0.8rem', color: '#888' }}>
                      {p.count} {p.count === 1 ? 'session' : 'sessions'}
                    </span>
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.25rem', alignItems: 'center' }}>
                    {p.choice_path.map((cid, j) => (
                      <span key={j} style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                        {j > 0 && <span style={{ color: '#ccc', fontSize: '0.75rem' }}>→</span>}
                        <span style={{ fontSize: '0.8125rem', background: '#f4f4f2', padding: '0.2rem 0.5rem', borderRadius: '4px' }}>
                          {choiceLabelMap.get(cid) || '?'}
                        </span>
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {stats.total_sessions === 0 && (
          <div style={{ textAlign: 'center', padding: '4rem 2rem', color: '#aaa' }}>
            <p style={{ fontSize: '1rem', marginBottom: '0.5rem' }}>No sessions yet</p>
            <p style={{ fontSize: '0.8125rem' }}>Analytics will appear here once people start playing this tree.</p>
          </div>
        )}
      </div>
    </div>
  )
}

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div style={{ background: '#fff', border: '1px solid #eee', borderRadius: '8px', padding: '1.25rem' }}>
      <div style={{ fontSize: '0.7rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#888', marginBottom: '0.5rem' }}>{label}</div>
      <div style={{ fontSize: '1.75rem', fontWeight: 700 }}>{value}</div>
    </div>
  )
}

function SectionHeader({ children }: { children: React.ReactNode }) {
  return (
    <h2 style={{ margin: '0 0 1rem', fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#888' }}>
      {children}
    </h2>
  )
}
