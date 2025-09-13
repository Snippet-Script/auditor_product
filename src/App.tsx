import React from 'react'
// Google OAuth now handled through Firebase Auth popup
import { BrowserRouter, Navigate, Route, Routes, useNavigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './auth/auth'
import Home from './routes/Home'
import DashboardLayout from './routes/DashboardLayout'
import Template from './routes/Template'
import Source from './routes/Source'
import Content from './routes/Content'
import Design from './routes/Design'
import Preview from './routes/Preview'
import Contacts from './routes/Contacts'
import Schedule from './routes/Schedule'
import AnalyticsPage from './routes/AnalyticsPage'
import AdminUsage from './routes/AdminUsage'
import AdminStates from './routes/AdminStates'
import { NewsletterBuilder } from './components/newsletter'
import { CanvasPOC } from './components/canvas'
import { RewriteBox } from './components/ai/RewriteBox'

const clientId = (import.meta as any).env?.VITE_GOOGLE_CLIENT_ID as string | undefined

function Login() {
  const { signInWithGoogle, loading } = useAuth()
  const navigate = useNavigate()
  const onClick = async () => {
    try {
      await signInWithGoogle()
      navigate('/home', { replace: true })
    } catch (e) {
      alert('Login failed')
    }
  }
  return (
    <div className="page">
      <div className="card">
        <h1>Welcome</h1>
        <p className="p-muted">Sign in to continue</p>
        <button onClick={onClick} disabled={loading}>Sign in with Google</button>
      </div>
    </div>
  )
}

function Providers({ children }: { children: React.ReactNode }) { return <AuthProvider>{children}</AuthProvider> }

function AppRoutes() {
  const { idToken } = useAuth()
  return (
    <Routes>
      <Route path="/" element={<Login />} />
      <Route path="/home" element={idToken ? <Home /> : <Navigate to="/" replace />} />
      {/* Wireframe dashboard routes */}
      <Route element={idToken ? <DashboardLayout /> : <Navigate to="/" replace /> }>
        <Route path="/template" element={<Template />} />
        <Route path="/source" element={<Source />} />
        <Route path="/content" element={<Content />} />
        <Route path="/design" element={<Design />} />
        <Route path="/preview" element={<Preview />} />
        <Route path="/contacts" element={<Contacts />} />
        <Route path="/schedule" element={<Schedule />} />
  <Route path="/analytics" element={<AnalyticsPage />} />
  <Route path="/admin/usage" element={<AdminUsage />} />
  <Route path="/admin/states" element={<AdminStates />} />
      </Route>
      {/* Existing editors */}
      <Route path="/builder" element={idToken ? <CanvasPOC /> : <Navigate to="/" replace />} />
      <Route path="/builder-advanced" element={idToken ? <NewsletterBuilder /> : <Navigate to="/" replace />} />
  <Route path="/rewrite" element={idToken ? <RewriteBox /> : <Navigate to="/" replace />} />
      <Route path="*" element={<Navigate to={idToken ? '/home' : '/'} replace />} />
    </Routes>
  )
}

export default function App() {
  if (!clientId) {
    return (
      <div className="page">
        <div className="card">
          <h1>Google Login</h1>
          <p className="p-muted">Missing VITE_GOOGLE_CLIENT_ID. Create a .env file and set it, then restart.</p>
        </div>
      </div>
    )
  }
  return (
    <Providers>
      <BrowserRouter>
        <AppRoutes />
      </BrowserRouter>
    </Providers>
  )
}
