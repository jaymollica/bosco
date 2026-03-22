export type StepType = 'intro' | 'text' | 'image' | 'end'

export interface Step {
  id: string
  tree_version_id: string
  type: StepType
  position_x: number
  position_y: number
  content: StepContent
  created_at: string
}

export interface IntroContent {
  title: string
  description: string
  hero_image_url?: string
  blur_placeholder?: string
  cta_label: string
}

export interface TextContent {
  headline: string
  body: string
  secondary_image_url?: string
  blur_placeholder?: string
}

export interface ImageContent {
  image_url: string
  blur_placeholder?: string
  alt_text: string
  caption: string
  headline: string
}

export interface EndContent {
  title: string
  summary: string
  cta_label?: string
  cta_url?: string
  image_url?: string
  blur_placeholder?: string
  alt_text?: string
}

export type StepContent = IntroContent | TextContent | ImageContent | EndContent

export interface Choice {
  id: string
  from_step_id: string
  to_step_id: string
  label: string
  internal_note?: string
  sort_order: number
}

export interface Theme {
  titleFont?: { family: string; weight: string }
  bodyFont?: { family: string; weight: string }
  textColor?: string
  background?: {
    type: 'solid' | 'gradient'
    color?: string
    css?: string      // full CSS value for gradient, e.g. "linear-gradient(135deg, #f5c6a0, #a0c4f5)"
  }
}

export interface TreeVersion {
  id: string
  tree_id: string
  version_number: number
  theme: Theme
  created_at: string
}

export interface Tree {
  id: string
  author_id: string
  title: string
  slug: string
  status: 'draft' | 'published' | 'archived'
  current_version_id: string
  created_at: string
  published_at?: string
  theme: Theme
  version_number: number
  completed_sessions?: number
}

export interface TreeWithGraph extends Tree {
  steps: Step[]
  choices: Choice[]
}

export interface Author {
  id: string
  email: string
  name: string
}
