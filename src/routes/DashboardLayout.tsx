import React from 'react'
import { NavLink, Outlet } from 'react-router-dom'

const navItems = [
  { to: '/template', label: 'Template' },
  { to: '/source', label: 'Source' },
  { to: '/content', label: 'Content' },
  { to: '/design', label: 'Design' },
  { to: '/preview', label: 'Preview' },
  { to: '/contacts', label: 'Contacts' },
  { to: '/schedule', label: 'Schedule' },
  { to: '/analytics', label: 'Analytics' }
]

export default function DashboardLayout() {
  return (
    <div style={{ minHeight:'100vh', display:'flex', flexDirection:'column' }}>
      <header style={{ background:'#111', color:'#eee', padding:'10px 18px', display:'flex', gap:18, alignItems:'center' }}>
        <strong style={{ fontSize:16 }}>App</strong>
        <nav style={{ display:'flex', gap:12, flexWrap:'wrap' }}>
          {navItems.map(n => (
            <NavLink
              key={n.to}
              to={n.to}
              style={({ isActive }) => ({
                color: isActive ? '#1db954' : '#ccc',
                textDecoration:'none',
                fontSize:13,
                fontWeight:500,
                padding:'4px 8px',
                borderRadius:4,
                background: isActive ? '#1db95420' : 'transparent'
              })}
            >{n.label}</NavLink>
          ))}
        </nav>
      </header>
      <main style={{ flex:1, padding: '28px 34px', background:'#181818', color:'#eee' }}>
        <Outlet />
      </main>
      <footer style={{ background:'#111', color:'#777', fontSize:12, padding:'10px 18px', textAlign:'center' }}>Placeholder wireframe &copy; 2025</footer>
    </div>
  )
}
