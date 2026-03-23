import type { TextContent, Choice } from '../../types/index.js'
import ChoiceList from './ChoiceList.js'

interface Props {
  content: TextContent
  choices: Choice[]
  onChoose: (choiceId: string, toStepId: string | null) => void
  titleFont?: string
  bodyFont?: string
}

export default function TextStep({ choices, onChoose, bodyFont }: Props) {
  return (
    <div style={{ width: '100%', height: '100%' }}>
      <ChoiceList choices={choices} onChoose={onChoose} bodyFont={bodyFont} />
    </div>
  )
}
