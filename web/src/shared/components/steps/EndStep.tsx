import BlurImage from '../BlurImage.js'
import type { EndContent } from '../../types/index.js'

interface Props {
  content: EndContent
  titleFont?: string
  bodyFont?: string
}

export default function EndStep({ content, titleFont, bodyFont }: Props) {
  return (
    <div style={{ width: '100%' }}>
      {content.image_url && (
        <BlurImage
          src={content.image_url}
          alt={content.alt_text ?? ''}
          blur={content.blur_placeholder}
          style={{ width: '100%', aspectRatio: '4/3' }}
        />
      )}
      <div style={{ padding: '2rem 1.5rem 2.5rem', textAlign: 'center' }}>
        <h2 style={{ margin: '0 0 1rem', fontFamily: titleFont, fontSize: '1.5rem', lineHeight: 1.2, fontWeight: 700 }}>
          {content.title}
        </h2>
        {content.summary && (
          <p style={{ margin: '0 0 2rem', fontFamily: bodyFont, fontSize: '1rem', lineHeight: 1.65, opacity: 0.85, whiteSpace: 'pre-wrap', textAlign: 'left' }}>
            {content.summary}
          </p>
        )}
        {content.cta_label && content.cta_url && (
          <a
            href={content.cta_url}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: 'inline-block',
              padding: '0.75rem 2rem',
              border: '2px solid currentColor',
              borderRadius: '4px',
              textDecoration: 'none',
              color: 'inherit',
              fontSize: '1rem',
              fontFamily: bodyFont,
              fontWeight: 600,
            }}
          >
            {content.cta_label}
          </a>
        )}
      </div>
    </div>
  )
}
