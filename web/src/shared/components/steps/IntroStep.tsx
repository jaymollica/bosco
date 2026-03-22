import { useState } from 'react'
import BlurImage from '../BlurImage.js'
import type { IntroContent, Choice } from '../../types/index.js'

interface Props {
  content: IntroContent
  choices: Choice[]
  onChoose: (choiceId: string, toStepId: string) => void
  titleFont?: string
  bodyFont?: string
}

/** Hand-tap icon — a finger tapping a surface */
function TapIcon({ size = 32, color = 'currentColor' }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M8 13V4.5a1.5 1.5 0 0 1 3 0V12" />
      <path d="M11 11.5V10a1.5 1.5 0 0 1 3 0v1.5" />
      <path d="M14 12v-1a1.5 1.5 0 0 1 3 0v1.5" />
      <path d="M17 12.5a1.5 1.5 0 0 1 3 0V16a6 6 0 0 1-6 6h-2a6 6 0 0 1-5.2-3l-2.5-4.3a1.5 1.5 0 0 1 2.1-2L8 13" />
      <path d="M5 4a3 3 0 0 0-3 3" opacity="0.4" />
      <path d="M3 1a6 6 0 0 0-3 5.2" opacity="0.25" />
    </svg>
  )
}

export default function IntroStep({ content, choices, onChoose, titleFont, bodyFont }: Props) {
  const [tapped, setTapped] = useState(false)
  const hasImage = !!content.hero_image_url

  const handleTap = () => {
    if (tapped || choices.length === 0) return
    setTapped(true)
    const choice = choices[0]
    onChoose(choice.id, choice.to_step_id)
  }

  return (
    <div
      onClick={handleTap}
      style={{
        width: '100%',
        height: '100vh',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        position: 'relative',
        cursor: tapped ? 'default' : 'pointer',
      }}
    >
      {/* Full-bleed background image */}
      {hasImage && (
        <BlurImage
          src={content.hero_image_url!}
          alt=""
          blur={content.blur_placeholder}
          style={{
            position: 'absolute',
            inset: 0,
            width: '100%',
            height: '100%',
            objectFit: 'cover',
          }}
        />
      )}

      {/* Scrim for text legibility over image */}
      {hasImage && (
        <div style={{
          position: 'absolute',
          inset: 0,
          background: 'linear-gradient(to bottom, rgba(0,0,0,0.5) 0%, rgba(0,0,0,0.1) 40%, rgba(0,0,0,0.05) 100%)',
        }} />
      )}

      {/* Title and description — top, left-aligned */}
      <div style={{
        position: 'relative',
        padding: '3rem 1.5rem 0',
        textAlign: 'left',
        color: hasImage ? '#fff' : undefined,
      }}>
        <h1 style={{
          margin: '0 0 0.75rem',
          fontFamily: titleFont,
          fontSize: '2.75rem',
          lineHeight: 1.15,
          fontWeight: 700,
          color: 'inherit',
        }}>
          {content.title}
        </h1>
        {content.description && (
          <p style={{
            margin: 0,
            fontFamily: bodyFont,
            fontSize: '1rem',
            lineHeight: 1.6,
          }}>
            {content.description}
          </p>
        )}
      </div>

      {/* Tap icon — centered in remaining space */}
      <div style={{
        position: 'relative',
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        opacity: tapped ? 0.2 : 0.4,
        transition: 'opacity 0.5s ease',
        color: hasImage ? '#fff' : undefined,
      }}>
        <TapIcon size={48} />
      </div>

      {/* "tap to begin" label near bottom */}
      <div style={{
        position: 'relative',
        display: 'flex',
        justifyContent: 'center',
        padding: '0 0 3rem',
        opacity: tapped ? 0.2 : 0.4,
        transition: 'opacity 0.5s ease',
        color: hasImage ? '#fff' : undefined,
      }}>
        <span style={{ fontSize: '0.75rem', fontFamily: bodyFont, fontWeight: 300, letterSpacing: '0.05em' }}>
          tap to begin
        </span>
      </div>
    </div>
  )
}
