import { useEffect, useState, useCallback, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  ReactFlow, Background, Controls, MiniMap,
  addEdge, useNodesState, useEdgesState,
  type Node, type Edge, type Connection, type NodeChange, type EdgeChange,
} from '@xyflow/react'

type StepNode = Node<{ step: Step }>
type StepEdge = Edge
import '@xyflow/react/dist/style.css'
import { getTree, updateStep, addChoice, updateChoice, deleteChoice, deleteStep, addStep, publishTree, unpublishTree, updateTheme } from '../../shared/api/trees.js'
import type { TreeWithGraph, Step, Choice, StepType, Theme } from '../../shared/types/index.js'
import StepNode from '../components/StepNode.js'
import StepEditor from '../components/StepEditor.js'
import ThemePanel from '../components/ThemePanel.js'

const NODE_TYPES = { step: StepNode }

const DEFAULT_CONTENT: Record<StepType, Record<string, unknown>> = {
  intro: { title: '', description: '', cta_label: 'Begin' },
  text:  { headline: '', body: '' },
  image: { headline: '', image_url: '', alt_text: '', caption: '' },
  end:   { title: '', summary: '' },
}

function stepsToNodes(steps: Step[]): StepNode[] {
  return steps.map(step => ({
    id: step.id,
    type: 'step',
    position: { x: step.position_x, y: step.position_y },
    data: { step },
  })) as StepNode[]
}

function choicesToEdges(choices: Choice[]): Edge[] {
  return choices.map(c => ({
    id: c.id,
    source: c.from_step_id,
    target: c.to_step_id,
    label: c.label || undefined,
    type: 'smoothstep',
  }))
}

export default function Editor() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [tree, setTree] = useState<TreeWithGraph | null>(null)
  const [nodes, setNodes, onNodesChange] = useNodesState<StepNode>([])
  const [edges, setEdges, onEdgesChange] = useEdgesState<StepEdge>([])
  const [selectedStep, setSelectedStep] = useState<Step | null>(null)
  const [showTheme, setShowTheme] = useState(false)
  const themeTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [choices, setChoices] = useState<Choice[]>([])
  const [publishing, setPublishing] = useState(false)
  const [publishErrors, setPublishErrors] = useState<string[]>([])
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (!id) return
    getTree(id).then(data => {
      setTree(data)
      setNodes(stepsToNodes(data.steps))
      setEdges(choicesToEdges(data.choices))
      setChoices(data.choices)
    })
  }, [id])

  // Debounced position save when nodes are dragged
  const handleNodesChange = useCallback((changes: NodeChange<StepNode>[]) => {
    onNodesChange(changes)
    const posChanges = changes.filter(c => c.type === 'position' && c.dragging === false)
    for (const change of posChanges) {
      if (change.type !== 'position') continue
      const node = nodes.find(n => n.id === change.id)
      if (!node || !id) continue
      if (saveTimer.current) clearTimeout(saveTimer.current)
      saveTimer.current = setTimeout(() => {
        updateStep(id, node.id, { position_x: node.position.x, position_y: node.position.y })
      }, 500)
    }
  }, [nodes, id])

  // Create a choice when the user draws a connection
  const handleConnect = useCallback(async (connection: Connection) => {
    if (!id || !connection.source || !connection.target) return
    try {
      const newChoice = await addChoice(id, {
        from_step_id: connection.source,
        to_step_id: connection.target,
        label: '',
        sort_order: choices.filter(c => c.from_step_id === connection.source).length,
      })
      setChoices(prev => [...prev, newChoice])
      setEdges(eds => addEdge({ ...connection, id: newChoice.id, type: 'smoothstep' }, eds))
    } catch {
      // duplicate connection — ignore
    }
  }, [id, choices])

  const handleEdgeDelete = useCallback(async (deletedEdges: Edge[]) => {
    if (!id) return
    for (const edge of deletedEdges) {
      await deleteChoice(id, edge.id)
      setChoices(prev => prev.filter(c => c.id !== edge.id))
    }
  }, [id])

  const handleNodeClick = useCallback((_: React.MouseEvent, node: StepNode) => {
    const step = node.data.step
    setSelectedStep(step)
  }, [])

  const handleUpdateContent = useCallback(async (content: Record<string, unknown>) => {
    if (!id || !selectedStep) return
    await updateStep(id, selectedStep.id, { content })
    // Update node data in place
    setNodes(nds => nds.map(n => n.id === selectedStep.id
      ? { ...n, data: { step: { ...n.data.step, content: content as unknown as Step['content'] } } }
      : n
    ) as StepNode[])
  }, [id, selectedStep])

  const handleUpdateChoice = useCallback(async (choiceId: string, label: string) => {
    if (!id) return
    await updateChoice(id, choiceId, { label })
    setChoices(prev => prev.map(c => c.id === choiceId ? { ...c, label } : c))
    setEdges(eds => eds.map(e => e.id === choiceId ? { ...e, label } : e))
  }, [id])

  const handleDeleteChoice = useCallback(async (choiceId: string) => {
    if (!id) return
    await deleteChoice(id, choiceId)
    setChoices(prev => prev.filter(c => c.id !== choiceId))
    setEdges(eds => eds.filter(e => e.id !== choiceId))
  }, [id])

  const handleDeleteNode = useCallback(async (deletedNodes: StepNode[]) => {
    if (!id) return
    for (const node of deletedNodes) {
      await deleteStep(id, node.id)
      setChoices(prev => prev.filter(c => c.from_step_id !== node.id && c.to_step_id !== node.id))
      if (selectedStep?.id === node.id) setSelectedStep(null)
    }
  }, [id, selectedStep])

  const handleAddStep = async (type: StepType) => {
    if (!id) return
    const newStep = await addStep(id, { type, position_x: 200, position_y: 200, content: DEFAULT_CONTENT[type] })
    setNodes(nds => [...nds, { id: newStep.id, type: 'step', position: { x: 200, y: 200 }, data: { step: newStep } }])
  }

  const handlePublish = async () => {
    if (!id) return
    setPublishing(true)
    setPublishErrors([])
    try {
      const updated = await publishTree(id)
      setTree(prev => prev ? { ...prev, ...updated } : null)
    } catch (err: unknown) {
      const errors = (err as { response?: { data?: { errors?: string[] } } })?.response?.data?.errors
      setPublishErrors(errors ?? ['Publish failed'])
    } finally {
      setPublishing(false)
    }
  }

  const handleUnpublish = async () => {
    if (!id) return
    await unpublishTree(id)
    setTree(prev => prev ? { ...prev, status: 'draft' } : null)
  }

  const handleThemeUpdate = useCallback((theme: Theme) => {
    if (!id) return
    setTree(prev => prev ? { ...prev, theme } : null)
    if (themeTimer.current) clearTimeout(themeTimer.current)
    themeTimer.current = setTimeout(() => updateTheme(id, theme), 600)
  }, [id])

  if (!tree) return <div style={{ padding: '2rem', color: '#888' }}>Loading…</div>

  const currentSteps = nodes.map(n => n.data.step)

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* Toolbar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.625rem 1rem', borderBottom: '1px solid #eee', background: '#fff', zIndex: 20 }}>
        <button onClick={() => navigate('/studio')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#888', fontSize: '0.875rem' }}>← Trees</button>
        <span style={{ fontWeight: 600, fontSize: '0.875rem' }}>{tree.title}</span>
        <span style={{ fontSize: '0.75rem', color: tree.status === 'published' ? '#2a9d2a' : '#888', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{tree.status}</span>
        <div style={{ flex: 1 }} />

        {/* Step bank */}
        {(['intro', 'text', 'image', 'end'] as StepType[]).map(type => (
          <button key={type} onClick={() => handleAddStep(type)} style={{ padding: '0.375rem 0.75rem', fontSize: '0.75rem', background: '#f3f3f3', border: '1px solid #ddd', borderRadius: '4px', cursor: 'pointer', textTransform: 'capitalize' }}>
            + {type}
          </button>
        ))}

        <button
          onClick={() => { setShowTheme(t => !t); setSelectedStep(null) }}
          style={{ padding: '0.375rem 0.75rem', fontSize: '0.75rem', background: showTheme ? '#1a1a1a' : '#f3f3f3', color: showTheme ? '#fff' : '#333', border: '1px solid #ddd', borderRadius: '4px', cursor: 'pointer' }}
        >
          Theme
        </button>

        <button
          onClick={() => navigate(`/studio/trees/${id}/analytics`)}
          style={{ padding: '0.375rem 0.75rem', fontSize: '0.75rem', background: '#f3f3f3', color: '#333', border: '1px solid #ddd', borderRadius: '4px', cursor: 'pointer' }}
        >
          Analytics
        </button>

        <div style={{ width: '1px', height: '20px', background: '#eee' }} />

        {tree.status === 'published' ? (
          <button onClick={handleUnpublish} style={{ padding: '0.375rem 0.875rem', fontSize: '0.8rem', background: 'none', border: '1px solid #ddd', borderRadius: '4px', cursor: 'pointer' }}>
            Unpublish
          </button>
        ) : (
          <button onClick={handlePublish} disabled={publishing} style={{ padding: '0.375rem 0.875rem', fontSize: '0.8rem', background: '#1a1a1a', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>
            {publishing ? 'Publishing…' : 'Publish'}
          </button>
        )}
      </div>

      {publishErrors.length > 0 && (
        <div style={{ background: '#fff5f5', borderBottom: '1px solid #fcc', padding: '0.625rem 1rem' }}>
          <strong style={{ fontSize: '0.8rem' }}>Cannot publish:</strong>
          <ul style={{ margin: '0.25rem 0 0 1rem', padding: 0, fontSize: '0.8rem', color: '#c00' }}>
            {publishErrors.map((e, i) => <li key={i}>{e}</li>)}
          </ul>
        </div>
      )}

      {/* Canvas */}
      <div style={{ flex: 1, position: 'relative' }}>
        <ReactFlow
          nodes={nodes}
          edges={edges}
          nodeTypes={NODE_TYPES}
          onNodesChange={handleNodesChange}
          onEdgesChange={(changes: EdgeChange<StepEdge>[]) => {
            const removed = changes.filter(c => c.type === 'remove')
            if (removed.length > 0) {
              handleEdgeDelete(removed.map(c => edges.find(e => e.id === (c as { id: string }).id)!).filter(Boolean))
            }
            onEdgesChange(changes)
          }}
          onConnect={handleConnect}
          onNodeClick={handleNodeClick}
          onNodesDelete={handleDeleteNode}
          fitView
          deleteKeyCode="Delete"
        >
          <Background />
          <Controls />
          <MiniMap />
        </ReactFlow>

        {selectedStep && !showTheme && (
          <StepEditor
            step={selectedStep}
            choices={choices}
            steps={currentSteps}
            onUpdateContent={handleUpdateContent}
            onUpdateChoice={handleUpdateChoice}
            onDeleteChoice={handleDeleteChoice}
            onClose={() => setSelectedStep(null)}
          />
        )}

        {showTheme && tree && (
          <ThemePanel
            theme={tree.theme ?? {}}
            onUpdate={handleThemeUpdate}
            onClose={() => setShowTheme(false)}
          />
        )}
      </div>
    </div>
  )
}
