import { useEffect, useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { getTrees, createTree, deleteTree, getArchivedTrees } from '../../shared/api/trees.js'
import { logout } from '../../shared/api/auth.js'
import type { Tree } from '../../shared/types/index.js'

export default function Dashboard() {
  const navigate = useNavigate()
  const [trees, setTrees] = useState<Tree[]>([])
  const [archived, setArchived] = useState<Tree[]>([])
  const [showArchived, setShowArchived] = useState(false)
  const [loadingArchived, setLoadingArchived] = useState(false)
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [showNew, setShowNew] = useState(false)
  const [title, setTitle] = useState('')
  const [slug, setSlug] = useState('')
  const [depth, setDepth] = useState(4)

  useEffect(() => {
    getTrees().then(setTrees).finally(() => setLoading(false))
  }, [])

  const handleShowArchived = async () => {
    if (showArchived) { setShowArchived(false); return }
    setLoadingArchived(true)
    try {
      const data = await getArchivedTrees()
      setArchived(data)
      setShowArchived(true)
    } finally {
      setLoadingArchived(false)
    }
  }

  const handleCreate = async (e: FormEvent) => {
    e.preventDefault()
    setCreating(true)
    try {
      const tree = await createTree({ title, slug, depth })
      navigate(`/studio/trees/${tree.id}`)
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error
      alert(msg ?? 'Failed to create tree')
    } finally {
      setCreating(false)
    }
  }

  const handleLogout = async () => {
    await logout()
    navigate('/studio/login')
  }

  const slugify = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')

  const statusColor = { draft: '#888', published: '#2a9d2a', archived: '#c00' }

  return (
    <div style={{ maxWidth: '800px', margin: '0 auto', padding: '2rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <h1 style={{ margin: 0, fontSize: '1.5rem' }}>Trees</h1>
        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <button onClick={() => setShowNew(true)} style={{ padding: '0.5rem 1rem', background: '#1a1a1a', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>
            New tree
          </button>
          <button onClick={handleLogout} style={{ padding: '0.5rem 1rem', background: 'none', border: '1px solid #ddd', borderRadius: '4px', cursor: 'pointer' }}>
            Sign out
          </button>
        </div>
      </div>

      {showNew && (
        <form onSubmit={handleCreate} style={{ background: '#f9f9f9', border: '1px solid #eee', borderRadius: '8px', padding: '1.5rem', marginBottom: '2rem' }}>
          <h2 style={{ margin: '0 0 1rem', fontSize: '1rem' }}>New tree</h2>
          <label style={{ display: 'block', marginBottom: '0.75rem' }}>
            <span style={{ fontSize: '0.8rem', fontWeight: 600 }}>Title</span>
            <input
              value={title} required
              onChange={e => { setTitle(e.target.value); setSlug(slugify(e.target.value)) }}
              style={{ display: 'block', width: '100%', marginTop: '0.25rem', padding: '0.5rem', border: '1px solid #ddd', borderRadius: '4px', boxSizing: 'border-box' }}
            />
          </label>
          <label style={{ display: 'block', marginBottom: '1rem' }}>
            <span style={{ fontSize: '0.8rem', fontWeight: 600 }}>Slug</span>
            <input
              value={slug} required
              onChange={e => setSlug(slugify(e.target.value))}
              style={{ display: 'block', width: '100%', marginTop: '0.25rem', padding: '0.5rem', border: '1px solid #ddd', borderRadius: '4px', boxSizing: 'border-box', fontFamily: 'monospace' }}
            />
            <span style={{ fontSize: '0.75rem', color: '#888' }}>bosco.vaguespac.es/t/{slug || '…'}</span>
          </label>
          <div style={{ marginBottom: '1rem' }}>
            <span style={{ fontSize: '0.8rem', fontWeight: 600, display: 'block', marginBottom: '0.5rem' }}>Steps</span>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              {([2, 3, 4] as const).map(d => (
                <button
                  key={d} type="button"
                  onClick={() => setDepth(d)}
                  style={{ padding: '0.375rem 0.875rem', borderRadius: '4px', cursor: 'pointer', border: '1px solid', borderColor: depth === d ? '#1a1a1a' : '#ddd', background: depth === d ? '#1a1a1a' : '#fff', color: depth === d ? '#fff' : '#555', fontSize: '0.825rem' }}
                >
                  {d} <span style={{ fontSize: '0.7rem', opacity: 0.7 }}>({Math.pow(2, d)} outcomes)</span>
                </button>
              ))}
            </div>
          </div>

          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button type="submit" disabled={creating} style={{ padding: '0.5rem 1rem', background: '#1a1a1a', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>
              {creating ? 'Creating…' : 'Create'}
            </button>
            <button type="button" onClick={() => setShowNew(false)} style={{ padding: '0.5rem 1rem', background: 'none', border: '1px solid #ddd', borderRadius: '4px', cursor: 'pointer' }}>
              Cancel
            </button>
          </div>
        </form>
      )}

      {loading ? (
        <p style={{ color: '#888' }}>Loading…</p>
      ) : trees.length === 0 ? (
        <p style={{ color: '#888' }}>No trees yet. Create your first one.</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          {trees.map(tree => (
            <div
              key={tree.id}
              style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1rem 1.25rem', background: '#fff', border: '1px solid #eee', borderRadius: '6px' }}
            >
              <div style={{ flex: 1, cursor: 'pointer' }} onClick={() => navigate(`/studio/trees/${tree.id}`)}>
                <div style={{ fontWeight: 600 }}>{tree.title}</div>
                <div style={{ fontSize: '0.8rem', color: '#888', marginTop: '0.2rem', fontFamily: 'monospace' }}>/t/{tree.slug}</div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                {tree.status === 'published' && typeof tree.completed_sessions === 'number' && (
                  <span style={{ fontSize: '0.75rem', color: '#aaa' }}>
                    {tree.completed_sessions} {tree.completed_sessions === 1 ? 'completion' : 'completions'}
                  </span>
                )}
                <span style={{ fontSize: '0.75rem', fontWeight: 600, color: statusColor[tree.status], textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  {tree.status}
                </span>
                <button
                  onClick={async (e) => {
                    e.stopPropagation()
                    if (!confirm(`Delete "${tree.title}"? This cannot be undone.`)) return
                    await deleteTree(tree.id)
                    setTrees(prev => prev.filter(t => t.id !== tree.id))
                  }}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#c00', fontSize: '0.8rem', padding: '0.25rem 0.5rem' }}
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <div style={{ marginTop: '2rem', borderTop: '1px solid #eee', paddingTop: '1rem' }}>
        <button
          onClick={handleShowArchived}
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#888', fontSize: '0.8rem', padding: 0 }}
        >
          {loadingArchived ? 'Loading…' : showArchived ? 'Hide archived trees' : 'View archived trees'}
        </button>

        {showArchived && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginTop: '0.75rem' }}>
            {archived.length === 0 ? (
              <p style={{ color: '#aaa', fontSize: '0.85rem', margin: 0 }}>No archived trees.</p>
            ) : archived.map(tree => (
              <div
                key={tree.id}
                style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.875rem 1.25rem', background: '#fafafa', border: '1px solid #eee', borderRadius: '6px', opacity: 0.7 }}
              >
                <div>
                  <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>{tree.title}</div>
                  <div style={{ fontSize: '0.8rem', color: '#aaa', marginTop: '0.2rem', fontFamily: 'monospace' }}>/t/{tree.slug}</div>
                </div>
                <span style={{ fontSize: '0.7rem', fontWeight: 600, color: '#aaa', textTransform: 'uppercase', letterSpacing: '0.05em' }}>archived</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
