import { memo } from 'react'
import { Handle, Position } from '@xyflow/react'
import type { NodeProps } from '@xyflow/react'

function ResultsNode({ selected }: NodeProps) {
  const color = '#059669'

  return (
    <div style={{
      background: '#f0fdf4',
      border: `2px solid ${selected ? color : '#bbf7d0'}`,
      borderRadius: '8px',
      minWidth: '180px',
      maxWidth: '220px',
      boxShadow: selected ? `0 0 0 3px ${color}22` : '0 1px 4px rgba(0,0,0,0.08)',
      overflow: 'hidden',
    }}>
      <Handle type="target" position={Position.Top} style={{ background: '#aaa' }} />

      <div style={{ padding: '0.625rem 0.875rem' }}>
        <div style={{ fontSize: '0.65rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color, marginBottom: '0.3rem' }}>
          Results
        </div>
        <div style={{ fontSize: '0.825rem', color: '#1a1a1a' }}>
          Sankey summary &amp; gallery
        </div>
      </div>
    </div>
  )
}

export default memo(ResultsNode)
