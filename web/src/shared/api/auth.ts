import api from './client.js'
import type { Author } from '../types/index.js'

export const login = async (email: string, password: string) => {
  const { data } = await api.post<{ token: string; author: Author }>('/auth/login', { email, password })
  localStorage.setItem('bosco_token', data.token)
  return data.author
}

export const logout = () => {
  localStorage.removeItem('bosco_token')
  return api.post('/auth/logout')
}

export const getMe = () => api.get<Author>('/auth/me').then(r => r.data)
