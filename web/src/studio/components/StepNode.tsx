import { memo } from 'react'
import { Handle, Position } from '@xyflow/react'
import type { NodeProps } from '@xyflow/react'
import type { Step } from '../../shared/types/index.js'

const TYPE_LABELS: Record<string, string> = {
  intro: 'Intro',
  text: 'Text',
  image: 'Image',
  end: 'End',
}

const TYPE_COLORS: Record<string, string> = {
  intro: '#4f46e5',
  text: '#1a1a1a',
  image: '#0369a1',
  end: '#7c3aed',
}

function StepNode({ data, selected }: NodeProps) {
  const step = data.step as Step
  const content = step.content as unknown as Record<string, string>
  const label = content.title || content.headline || '(empty)'
  const color = TYPE_COLORS[step.type] ?? '#1a1a1a'

  return (
    <div style={{
      background: '#fff',
      border: `2px solid ${selected ? color : '#e2e2e2'}`,
      borderRadius: '8px',
      minWidth: '180px',
      maxWidth: '220px',
      boxShadow: selected ? `0 0 0 3px ${color}22` : '0 1px 4px rgba(0,0,0,0.08)',
    }}>
      <Handle type="target" position={Position.Top} style={{ background: '#aaa' }} />
      <div style={{ padding: '0.625rem 0.875rem' }}>
        <div style={{ fontSize: '0.65rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color, marginBottom: '0.3rem' }}>
          {TYPE_LABELS[step.type]}
        </div>
        <div style={{ fontSize: '0.825rem', color: '#1a1a1a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {label}
        </div>
      </div>
      {step.type !== 'end' && (
        <Handle type="source" position={Position.Bottom} style={{ background: '#aaa' }} />
      )}
    </div>
  )
}

export default memo(StepNode)
