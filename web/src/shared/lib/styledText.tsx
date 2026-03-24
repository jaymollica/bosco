import type { ReactNode } from 'react'

/** Parse **bold**, *italic*, and ***bold italic*** markers into React elements */
export function parseStyledText(text: string): ReactNode[] {
  const parts: ReactNode[] = []
  const regex = /\*\*\*(.+?)\*\*\*|\*\*(.+?)\*\*|\*(.+?)\*/g
  let lastIndex = 0
  let match
  let key = 0

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index))
    }
    if (match[1]) {
      parts.push(<strong key={key}><em>{match[1]}</em></strong>)
    } else if (match[2]) {
      parts.push(<strong key={key}>{match[2]}</strong>)
    } else if (match[3]) {
      parts.push(<em key={key}>{match[3]}</em>)
    }
    key++
    lastIndex = match.index + match[0].length
  }

  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex))
  }

  return parts.length > 0 ? parts : [text]
}

/** Strip **bold** and *italic* markers for character counting */
export function stripMarkers(text: string): string {
  return text
    .replace(/\*\*\*(.+?)\*\*\*/g, '$1')
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/\*(.+?)\*/g, '$1')
}

/** Wrap or unwrap selected text with a marker (** or *) */
export function toggleMarker(
  text: string,
  selStart: number,
  selEnd: number,
  marker: string,
): { text: string; selStart: number; selEnd: number } {
  const markerLen = marker.length
  const before = text.slice(Math.max(0, selStart - markerLen), selStart)
  const after = text.slice(selEnd, selEnd + markerLen)
  const selected = text.slice(selStart, selEnd)

  if (before === marker && after === marker) {
    // Unwrap
    const newText = text.slice(0, selStart - markerLen) + selected + text.slice(selEnd + markerLen)
    return { text: newText, selStart: selStart - markerLen, selEnd: selEnd - markerLen }
  }

  // Wrap
  const newText = text.slice(0, selStart) + marker + selected + marker + text.slice(selEnd)
  return { text: newText, selStart: selStart + markerLen, selEnd: selEnd + markerLen }
}
