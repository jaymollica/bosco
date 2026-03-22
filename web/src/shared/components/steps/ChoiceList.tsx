import { useState } from 'react'
import type { Choice } from '../../types/index.js'

interface Props {
  choices: Choice[]
  onChoose: (choiceId: string, toStepId: string) => void
  // For intro steps with a single CTA button instead of choice labels
  singleLabel?: string
  bodyFont?: string
}

export default function ChoiceList({ choices, onChoose, singleLabel, bodyFont }: Props) {
  const [chosen, setChosen] = useState<string | null>(null)

  if (choices.length === 0) return null

  const handleClick = (choice: Choice) => {
    if (chosen) return
    setChosen(choice.id)
    onChoose(choice.id, choice.to_step_id)
  }

  // If single choice with a custom CTA label, render as a single CTA button
  if (choices.length === 1 && singleLabel) {
    return (
      <button
        onClick={() => handleClick(choices[0])}
        disabled={!!chosen}
        style={{
          display: 'block',
          width: '100%',
          padding: '0.875rem 1rem',
          border: '2px solid currentColor',
          borderRadius: '4px',
          background: 'transparent',
          color: 'inherit',
          fontSize: '1rem',
          fontFamily: bodyFont,
          fontWeight: 600,
          cursor: chosen ? 'default' : 'pointer',
          opacity: chosen ? 0.5 : 1,
          textAlign: 'center',
          boxSizing: 'border-box',
        }}
      >
        {singleLabel}
      </button>
    )
  }

  // Each choice gets an equal share of the viewport height
  const heightPerChoice = `${100 / choices.length}vh`

  // Size text based on character count
  const choiceFontSize = (label: string) => {
    const len = label.length
    if (len <= 30) return '1.75rem'
    if (len <= 60) return '1.4rem'
    if (len <= 100) return '1.15rem'
    return '1rem'
  }

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      width: '100%',
      minHeight: '100vh',
    }}>
      {choices.map((choice, i) => {
        const isChosen = chosen === choice.id
        const label = choice.label.length > 140 ? choice.label.slice(0, 137) + '…' : choice.label

        return (
          <button
            key={choice.id}
            onClick={() => handleClick(choice)}
            disabled={!!chosen}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              height: heightPerChoice,
              padding: '2rem',
              border: 'none',
              background: isChosen
                ? 'rgba(0,0,0,0.06)'
                : i % 2 === 1
                  ? 'rgba(0,0,0,0.03)'
                  : 'transparent',
              color: 'inherit',
              fontSize: choiceFontSize(label),
              fontFamily: bodyFont,
              fontWeight: 300,
              letterSpacing: '0.01em',
              lineHeight: 1.3,
              cursor: chosen ? 'default' : 'pointer',
              opacity: chosen && !isChosen ? 0.15 : 1,
              textAlign: 'center',
              transition: 'opacity 0.5s ease, background 0.5s ease',
              boxSizing: 'border-box',
            }}
          >
            {label}
          </button>
        )
      })}
    </div>
  )
}
