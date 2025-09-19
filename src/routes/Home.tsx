import React, { useMemo } from 'react'
import { useAuth } from '../auth/auth'
import { useNavigate } from 'react-router-dom'

export default function Home() {
  const { idToken, logout, user } = useAuth()
  const navigate = useNavigate()
  const adminEmails = (import.meta.env.VITE_ADMIN_EMAILS as string | undefined)?.split(',').map(s=>s.trim()).filter(Boolean) || []
  const isAdmin = useMemo(()=> !!(user?.email && adminEmails.includes(user.email)), [user?.email, adminEmails])

  const handleLogout = () => {
    logout()
    navigate('/')
  }

  return (
    <div className="page">
      <div className="card">
        <h1>Home</h1>
        <p className="p-muted">You are logged in.</p>
        {idToken && (
          <details>
            <summary>Show ID token</summary>
            <pre style={{ whiteSpace: 'pre-wrap', textAlign: 'left' }}>{idToken}</pre>
          </details>
        )}
        <div style={{ display:'flex', gap:12, flexWrap:'wrap', marginTop:24 }}>
          <button onClick={() => navigate('/builder')}>Canvas Builder</button>
          <button onClick={() => navigate('/builder-advanced')}>Newsletter Builder</button>
          <button onClick={() => navigate('/template')}>Wireframe Flow</button>
          {isAdmin && <button onClick={() => navigate('/admin/usage')}>Admin Usage</button>}
          {isAdmin && <button onClick={() => navigate('/admin/states')}>Admin States</button>}
          {isAdmin && <button onClick={() => navigate('/admin/logs')}>Admin Logs</button>}
          <button onClick={handleLogout}>Sign out</button>
        </div>
      </div>
    </div>
  )
}
