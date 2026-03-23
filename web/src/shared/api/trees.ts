import api from './client.js'
import type { Tree, TreeWithGraph, Theme, Step, Choice } from '../types/index.js'

export const getTrees = () => api.get<Tree[]>('/trees').then(r => r.data)

export const getArchivedTrees = () => api.get<Tree[]>('/trees/archived').then(r => r.data)

export const getTree = (id: string) => api.get<TreeWithGraph>(`/trees/${id}`).then(r => r.data)

export const createTree = (data: { title: string; slug: string; depth?: number }) =>
  api.post<Tree>('/trees', data).then(r => r.data)

export const updateTree = (id: string, data: { title?: string; slug?: string }) =>
  api.put<Tree>(`/trees/${id}`, data).then(r => r.data)

export const deleteTree = (id: string) => api.delete(`/trees/${id}`)

export const publishTree = (id: string) =>
  api.post<Tree>(`/trees/${id}/publish`).then(r => r.data)

export const unpublishTree = (id: string) =>
  api.post(`/trees/${id}/unpublish`).then(r => r.data)

export const updateTheme = (id: string, theme: Theme) =>
  api.put(`/trees/${id}/theme`, theme).then(r => r.data)

export const addStep = (treeId: string, data: {
  type: string; position_x: number; position_y: number; content: Record<string, unknown>
}) => api.post<Step>(`/trees/${treeId}/steps`, data).then(r => r.data)

export const updateStep = (treeId: string, stepId: string, data: {
  position_x?: number; position_y?: number; content?: Record<string, unknown>
}) => api.put<Step>(`/trees/${treeId}/steps/${stepId}`, data).then(r => r.data)

export const deleteStep = (treeId: string, stepId: string) =>
  api.delete(`/trees/${treeId}/steps/${stepId}`)

export const addChoice = (treeId: string, data: {
  from_step_id: string; to_step_id: string | null; label: string; internal_note?: string; sort_order?: number
}) => api.post<Choice>(`/trees/${treeId}/choices`, data).then(r => r.data)

export const updateChoice = (treeId: string, choiceId: string, data: {
  label?: string; internal_note?: string; sort_order?: number; image_url?: string | null; blur_placeholder?: string | null; caption?: string | null
}) => api.put<Choice>(`/trees/${treeId}/choices/${choiceId}`, data).then(r => r.data)

export const deleteChoice = (treeId: string, choiceId: string) =>
  api.delete(`/trees/${treeId}/choices/${choiceId}`)

export const getTreeAnalytics = (id: string) =>
  api.get<{
    title: string
    stats: { total_sessions: number; completed_sessions: number }
    nodes: { id: string; type: string; label: string }[]
    links: { choice_id: string; source: string; target: string; label: string; value: number }[]
    topPaths: { choice_path: string[]; count: number }[]
  }>(`/trees/${id}/analytics`).then(r => r.data)

export const uploadImage = (file: File) => {
  const form = new FormData()
  form.append('file', file)
  return api.post<{ url: string; blur_placeholder: string }>('/uploads', form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  }).then(r => r.data)
}
