import { memo } from 'react'
import { Handle, Position } from '@xyflow/react'
import type { NodeProps } from '@xyflow/react'
import type { Step, Choice } from '../../shared/types/index.js'

const TYPE_LABELS: Record<string, string> = {
  intro: 'Intro',
  text: 'Text',
  image: 'Image',
}

const TYPE_COLORS: Record<string, string> = {
  intro: '#4f46e5',
  text: '#1a1a1a',
  image: '#0369a1',
}

function StepNode({ data, selected }: NodeProps) {
  const step = data.step as Step
  const choices = (data.choices ?? []) as Choice[]
  const content = step.content as unknown as Record<string, string>
  const color = TYPE_COLORS[step.type] ?? '#1a1a1a'

  // Choice labels for this step
  const stepChoices = choices.filter(c => c.from_step_id === step.id).sort((a, b) => a.sort_order - b.sort_order)

  // Primary label
  let label = ''
  if (step.type === 'intro') {
    label = content.title || 'Untitled'
  } else if (step.type === 'image') {
    label = content.headline || content.caption || 'Image'
  } else if (step.type === 'text') {
    label = stepChoices.length > 0
      ? `${stepChoices.length} choice${stepChoices.length > 1 ? 's' : ''}`
      : 'No choices'
  }

  // Image thumbnail
  const imageUrl = content.hero_image_url || content.image_url || null

  return (
    <div style={{
      background: '#fff',
      border: `2px solid ${selected ? color : '#e2e2e2'}`,
      borderRadius: '8px',
      minWidth: '180px',
      maxWidth: '220px',
      boxShadow: selected ? `0 0 0 3px ${color}22` : '0 1px 4px rgba(0,0,0,0.08)',
      overflow: 'hidden',
    }}>
      <Handle type="target" position={Position.Top} style={{ background: '#aaa' }} />

      {/* Image thumbnail */}
      {imageUrl && (
        <img src={imageUrl} alt="" style={{ width: '100%', height: '48px', objectFit: 'cover', display: 'block' }} />
      )}

      <div style={{ padding: '0.625rem 0.875rem' }}>
        <div style={{ fontSize: '0.65rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color, marginBottom: '0.3rem' }}>
          {TYPE_LABELS[step.type]}
        </div>
        <div style={{ fontSize: '0.825rem', color: '#1a1a1a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {label}
        </div>

        {/* Show choice labels for text steps */}
        {step.type === 'text' && stepChoices.length > 0 && (
          <div style={{ marginTop: '0.375rem', borderTop: '1px solid #f0f0f0', paddingTop: '0.375rem' }}>
            {stepChoices.slice(0, 4).map(c => (
              <div key={c.id} style={{
                fontSize: '0.7rem',
                color: c.label ? '#555' : '#ccc',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                lineHeight: 1.5,
              }}>
                {c.image_url && <span style={{ marginRight: '0.25rem' }}>🖼</span>}
                {c.label || '(no label)'}
              </div>
            ))}
          </div>
        )}

      </div>

      <Handle type="source" position={Position.Bottom} style={{ background: '#aaa' }} />
    </div>
  )
}

export default memo(StepNode)
