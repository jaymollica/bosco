import BlurImage from '../BlurImage.js'
import type { ImageContent, Choice } from '../../types/index.js'
import ChoiceList from './ChoiceList.js'

interface Props {
  content: ImageContent
  choices: Choice[]
  onChoose: (choiceId: string, toStepId: string) => void
  titleFont?: string
  bodyFont?: string
}

export default function ImageStep({ content, choices, onChoose, titleFont, bodyFont }: Props) {
  return (
    <div style={{ width: '100%' }}>
      {content.image_url && (
        <div>
          <BlurImage
            src={content.image_url}
            alt={content.alt_text ?? ''}
            blur={content.blur_placeholder}
            style={{ width: '100%', aspectRatio: '4/3' }}
          />
          {content.caption && (
            <p style={{ margin: 0, padding: '0.5rem 1.5rem', fontSize: '0.8rem', opacity: 0.6, fontFamily: bodyFont, fontStyle: 'italic' }}>
              {content.caption}
            </p>
          )}
        </div>
      )}
      <div style={{ padding: '1.5rem 1.5rem 1.5rem' }}>
        {content.headline && (
          <h2 style={{ margin: '0 0 2rem', fontFamily: titleFont, fontSize: '1.5rem', lineHeight: 1.2, fontWeight: 700 }}>
            {content.headline}
          </h2>
        )}
        <ChoiceList choices={choices} onChoose={onChoose} bodyFont={bodyFont} />
      </div>
    </div>
  )
}
