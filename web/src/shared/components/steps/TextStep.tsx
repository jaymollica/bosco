import type { TextContent, Choice } from '../../types/index.js'
import ChoiceList from './ChoiceList.js'

interface Props {
  content: TextContent
  choices: Choice[]
  onChoose: (choiceId: string, toStepId: string | null) => void
  titleFont?: string
  bodyFont?: string
  textColor?: string
  themeBackground?: { type?: string; color?: string; css?: string }
}

export default function TextStep({ choices, onChoose, bodyFont, textColor, themeBackground }: Props) {
  return (
    <div style={{ width: '100%', height: '100%' }}>
      <ChoiceList choices={choices} onChoose={onChoose} bodyFont={bodyFont} textColor={textColor} themeBackground={themeBackground} />
    </div>
  )
}
