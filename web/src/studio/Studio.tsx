import { Routes, Route, Navigate } from 'react-router-dom'
import Login from './pages/Login.js'
import Dashboard from './pages/Dashboard.js'
import Editor from './pages/Editor.js'
import Analytics from './pages/Analytics.js'

function RequireAuth({ children }: { children: React.ReactNode }) {
  const token = localStorage.getItem('bosco_token')
  if (!token) return <Navigate to="/studio/login" replace />
  return <>{children}</>
}

export default function Studio() {
  return (
    <Routes>
      <Route path="login" element={<Login />} />
      <Route path="" element={<RequireAuth><Dashboard /></RequireAuth>} />
      <Route path="trees/:id" element={<RequireAuth><Editor /></RequireAuth>} />
      <Route path="trees/:id/analytics" element={<RequireAuth><Analytics /></RequireAuth>} />
    </Routes>
  )
}
