import { useNavigate } from 'react-router-dom'

interface PathStep {
  answer: string
}

interface Props {
  path: PathStep[]
  onPlayAgain: () => void
  sessionId: string | null
  slug: string
  bodyFont?: string
  titleFont?: string
}

export default function PathSummary({ path, onPlayAgain, sessionId, slug, bodyFont, titleFont }: Props) {
  const navigate = useNavigate()

  return (
    <div style={{ padding: '0 1.5rem 3rem' }}>
      <hr style={{ border: 'none', borderTop: '1px solid currentColor', opacity: 0.15, margin: '0 0 2rem' }} />
      <h3 style={{ margin: '0 0 1.25rem', fontFamily: titleFont, fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.1em', opacity: 0.5 }}>
        Your path
      </h3>
      <ol style={{ margin: '0 0 2rem', padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        {path.map((step, i) => (
          <li key={i}>
            <span style={{ fontSize: '0.9375rem', fontFamily: bodyFont, fontWeight: 500 }}>{i + 1}. {step.answer}</span>
          </li>
        ))}
      </ol>
      <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
        <button
          onClick={onPlayAgain}
          style={{
            background: 'transparent',
            border: '1px solid currentColor',
            borderRadius: '4px',
            color: 'inherit',
            fontFamily: bodyFont,
            fontSize: '0.875rem',
            padding: '0.625rem 1.25rem',
            cursor: 'pointer',
            opacity: 0.7,
          }}
        >
          Play again
        </button>
        {sessionId && (
          <button
            onClick={() => navigate(`/t/${slug}/results/${sessionId}`)}
            style={{
              background: 'transparent',
              border: '1px solid currentColor',
              borderRadius: '4px',
              color: 'inherit',
              fontFamily: bodyFont,
              fontSize: '0.875rem',
              padding: '0.625rem 1.25rem',
              cursor: 'pointer',
              opacity: 0.7,
            }}
          >
            See how others chose →
          </button>
        )}
      </div>
    </div>
  )
}
