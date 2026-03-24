import { useState, useEffect, useRef, useCallback } from 'react'
import type { Step, Choice } from '../../shared/types/index.js'
import { uploadImage } from '../../shared/api/trees.js'
import ImageLibrary from './ImageLibrary.js'
import { stripMarkers, toggleMarker } from '../../shared/lib/styledText.js'

type ChoiceUpdate = { label?: string; image_url?: string | null; blur_placeholder?: string | null; caption?: string | null }

interface Props {
  step: Step
  choices: Choice[]
  steps: Step[]
  onUpdateContent: (content: Record<string, unknown>) => void
  onUpdateChoice: (choiceId: string, data: ChoiceUpdate) => void
  onDeleteChoice: (choiceId: string) => void
  onClose: () => void
}

export default function StepEditor({ step, choices, steps, onUpdateContent, onUpdateChoice, onDeleteChoice, onClose }: Props) {
  const [content, setContent] = useState<Record<string, unknown>>(step.content as unknown as Record<string, unknown>)
  const [uploading, setUploading] = useState(false)
  const [showLibrary, setShowLibrary] = useState(false)
  const [libraryUrlKey, setLibraryUrlKey] = useState('')

  // Local text state for choices to avoid cursor jumping
  const [localChoiceText, setLocalChoiceText] = useState<Record<string, { label?: string; caption?: string }>>({})
  const choiceTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({})
  const textareaRefs = useRef<Record<string, HTMLTextAreaElement | null>>({})

  const updateChoiceText = useCallback((choiceId: string, field: 'label' | 'caption', value: string) => {
    setLocalChoiceText(prev => ({ ...prev, [choiceId]: { ...prev[choiceId], [field]: value } }))
    if (choiceTimers.current[choiceId + field]) clearTimeout(choiceTimers.current[choiceId + field])
    choiceTimers.current[choiceId + field] = setTimeout(() => {
      onUpdateChoice(choiceId, { [field]: value })
    }, 400)
  }, [onUpdateChoice])

  const handleFormatting = (choiceId: string, marker: string) => {
    const el = textareaRefs.current[choiceId]
    if (!el) return
    const result = toggleMarker(el.value, el.selectionStart, el.selectionEnd, marker)
    updateChoiceText(choiceId, 'label', result.text)
    requestAnimationFrame(() => {
      el.selectionStart = result.selStart
      el.selectionEnd = result.selEnd
    })
  }

  useEffect(() => {
    setContent(step.content as unknown as Record<string, unknown>)
  }, [step.id])

  // Reset local choice text when step changes
  useEffect(() => {
    setLocalChoiceText({})
  }, [step.id])

  const update = (key: string, value: unknown) => {
    const updated = { ...content, [key]: value }
    setContent(updated)
    onUpdateContent(updated)
  }

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>, urlKey: string) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    try {
      const { url, blur_placeholder } = await uploadImage(file)
      const updated = { ...content, [urlKey]: url, blur_placeholder }
      setContent(updated)
      onUpdateContent(updated)
    } finally {
      setUploading(false)
    }
  }

  const handleLibrarySelect = (url: string, blurPlaceholder: string, caption: string) => {
    const updated: Record<string, unknown> = { ...content, [libraryUrlKey]: url, blur_placeholder: blurPlaceholder }
    if (caption && !content.caption) updated.caption = caption
    setContent(updated)
    onUpdateContent(updated)
  }

  const stepChoices = choices.filter(c => c.from_step_id === step.id).sort((a, b) => a.sort_order - b.sort_order)

  const field = (label: string, key: string, multiline = false, maxLen?: number) => (
    <label style={{ display: 'block', marginBottom: '0.875rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
        <span style={{ fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#555' }}>{label}</span>
        {maxLen && <span style={{ fontSize: '0.7rem', color: (content[key] as string)?.length > maxLen * 0.9 ? '#c00' : '#aaa' }}>
          {(content[key] as string)?.length ?? 0}/{maxLen}
        </span>}
      </div>
      {multiline ? (
        <textarea
          value={(content[key] as string) ?? ''}
          onChange={e => update(key, e.target.value)}
          rows={3}
          style={{ display: 'block', width: '100%', marginTop: '0.25rem', padding: '0.5rem', border: '1px solid #ddd', borderRadius: '4px', boxSizing: 'border-box', resize: 'vertical' as const, fontSize: '0.875rem' }}
        />
      ) : (
        <input
          type="text"
          value={(content[key] as string) ?? ''}
          onChange={e => update(key, e.target.value)}
          maxLength={maxLen}
          style={{ display: 'block', width: '100%', marginTop: '0.25rem', padding: '0.5rem', border: '1px solid #ddd', borderRadius: '4px', boxSizing: 'border-box', fontSize: '0.875rem' }}
        />
      )}
    </label>
  )

  const imageUpload = (label: string, urlKey: string) => (
    <div style={{ marginBottom: '0.875rem' }}>
      <span style={{ fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#555' }}>{label}</span>
      {content[urlKey] ? (
        <img src={content[urlKey] as string} alt="" style={{ display: 'block', width: '100%', borderRadius: '4px', marginTop: '0.5rem', marginBottom: '0.5rem', maxHeight: '120px', objectFit: 'cover' }} />
      ) : null}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.4rem' }}>
        <label style={{ fontSize: '0.8rem', cursor: 'pointer', color: '#1a1a1a', textDecoration: 'underline' }}>
          Upload
          <input type="file" accept="image/*" onChange={e => handleImageUpload(e, urlKey)} disabled={uploading} style={{ display: 'none' }} />
        </label>
        <span style={{ color: '#ccc', fontSize: '0.75rem' }}>or</span>
        <button
          type="button"
          onClick={() => { setLibraryUrlKey(urlKey); setShowLibrary(true) }}
          style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', fontSize: '0.8rem', color: '#1a1a1a', textDecoration: 'underline' }}
        >
          Choose from library
        </button>
      </div>
      {uploading && <span style={{ fontSize: '0.75rem', color: '#888' }}>Uploading…</span>}
    </div>
  )

  return (
    <>
    <div style={{ position: 'fixed', right: 0, top: 0, bottom: 0, width: '320px', background: '#fff', borderLeft: '1px solid #eee', overflowY: 'auto', zIndex: 10, boxShadow: '-2px 0 8px rgba(0,0,0,0.06)' }}>
      <div style={{ padding: '1rem', borderBottom: '1px solid #eee', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontWeight: 600, fontSize: '0.875rem', textTransform: 'capitalize' }}>{step.type} step</span>
        <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.2rem', color: '#888' }}>×</button>
      </div>
      <div style={{ padding: '1rem' }}>
        {step.type === 'intro' && <>
          {field('Title', 'title')}
          {field('Description', 'description', true)}
          {imageUpload('Hero image', 'hero_image_url')}
          {field('CTA label', 'cta_label')}
        </>}

        {step.type === 'text' && (
          <p style={{ fontSize: '0.8rem', color: '#888', margin: '0 0 0.5rem' }}>
            Choices are the content for text steps — edit them below.
          </p>
        )}

        {step.type === 'image' && <>
          {field('Headline', 'headline')}
          {imageUpload('Image', 'image_url')}
          {field('Alt text', 'alt_text')}
          {field('Caption', 'caption')}
        </>}

        <div style={{ marginTop: '1rem', borderTop: '1px solid #eee', paddingTop: '1rem' }}>
            <div style={{ fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#555', marginBottom: '0.75rem' }}>
              Choices ({stepChoices.length})
            </div>
            {stepChoices.map((choice, i) => {
              const target = steps.find(s => s.id === choice.to_step_id)
              return (
                <div key={choice.id} style={{ marginBottom: '0.75rem', background: '#f9f9f9', borderRadius: '6px', padding: '0.625rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
                    <span style={{ fontSize: '0.7rem', color: '#888' }}>Choice {i + 1} → {choice.to_step_id ? (target?.type ?? '?') : 'Results'}</span>
                    <button onClick={() => onDeleteChoice(choice.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#c00', fontSize: '0.75rem' }}>remove</button>
                  </div>
                  <div style={{ display: 'flex', gap: '0.25rem', marginBottom: '0.25rem' }}>
                    <button
                      type="button"
                      onMouseDown={e => { e.preventDefault(); handleFormatting(choice.id, '**') }}
                      style={{ background: '#eee', border: '1px solid #ddd', borderRadius: '3px', padding: '0.125rem 0.375rem', cursor: 'pointer', fontSize: '0.7rem', fontWeight: 700, lineHeight: 1.4 }}
                    >B</button>
                    <button
                      type="button"
                      onMouseDown={e => { e.preventDefault(); handleFormatting(choice.id, '*') }}
                      style={{ background: '#eee', border: '1px solid #ddd', borderRadius: '3px', padding: '0.125rem 0.375rem', cursor: 'pointer', fontSize: '0.7rem', fontStyle: 'italic', lineHeight: 1.4 }}
                    >I</button>
                  </div>
                  <textarea
                    ref={el => { textareaRefs.current[choice.id] = el }}
                    value={localChoiceText[choice.id]?.label ?? choice.label}
                    onChange={e => updateChoiceText(choice.id, 'label', e.target.value)}
                    placeholder="Choice label…"
                    rows={3}
                    style={{ width: '100%', padding: '0.375rem 0.5rem', border: '1px solid #ddd', borderRadius: '4px', boxSizing: 'border-box', fontSize: '0.8rem', resize: 'vertical', fontFamily: 'inherit' }}
                  />
                  <div style={{ fontSize: '0.65rem', color: stripMarkers(localChoiceText[choice.id]?.label ?? choice.label).length > 120 ? '#c00' : '#aaa', textAlign: 'right', marginTop: '0.2rem' }}>
                    {stripMarkers(localChoiceText[choice.id]?.label ?? choice.label).length}/140
                  </div>
                  {/* Choice image */}
                  <div style={{ marginTop: '0.5rem' }}>
                    {choice.image_url ? (
                      <div style={{ position: 'relative' }}>
                        <img src={choice.image_url} alt="" style={{ display: 'block', width: '100%', borderRadius: '4px', maxHeight: '80px', objectFit: 'cover' }} />
                        <button
                          onClick={() => onUpdateChoice(choice.id, { image_url: null, blur_placeholder: null })}
                          style={{ position: 'absolute', top: 4, right: 4, background: 'rgba(0,0,0,0.6)', color: '#fff', border: 'none', borderRadius: '50%', width: 20, height: 20, fontSize: '0.7rem', cursor: 'pointer', lineHeight: '20px', padding: 0 }}
                        >×</button>
                      </div>
                    ) : (
                      <label style={{ fontSize: '0.75rem', cursor: 'pointer', color: '#888', textDecoration: 'underline' }}>
                        + Add image
                        <input type="file" accept="image/*" style={{ display: 'none' }} onChange={async e => {
                          const file = e.target.files?.[0]
                          if (!file) return
                          const { url, blur_placeholder } = await uploadImage(file)
                          onUpdateChoice(choice.id, { image_url: url, blur_placeholder })
                        }} />
                      </label>
                    )}
                  </div>
                  {choice.image_url && (
                    <input
                      type="text"
                      value={localChoiceText[choice.id]?.caption ?? choice.caption ?? ''}
                      onChange={e => updateChoiceText(choice.id, 'caption', e.target.value)}
                      placeholder="Caption (optional)…"
                      style={{ width: '100%', marginTop: '0.375rem', padding: '0.375rem 0.5rem', border: '1px solid #ddd', borderRadius: '4px', boxSizing: 'border-box', fontSize: '0.75rem' }}
                    />
                  )}
                </div>
              )
            })}
            {stepChoices.length < 4 && (
              <p style={{ fontSize: '0.75rem', color: '#888' }}>Connect this step to another step on the canvas to add a choice.</p>
            )}
          </div>
      </div>
    </div>

    {showLibrary && (
      <ImageLibrary
        onSelect={handleLibrarySelect}
        onClose={() => setShowLibrary(false)}
      />
    )}
    </>
  )
}
