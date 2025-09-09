import React from 'react'
import { useAuth } from '../auth/auth'
import { useNavigate } from 'react-router-dom'

export default function Home() {
  const { idToken, logout } = useAuth()
  const navigate = useNavigate()

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
          <button onClick={() => navigate('/builder')}>Create Newsletter</button>
          <button onClick={() => navigate('/template')}>Open Wireframe Flow</button>
          <button onClick={handleLogout}>Sign out</button>
        </div>
      </div>
    </div>
  )
}
