import React from 'react'
import { useNavigate } from 'react-router-dom'
export default function AnalyticsPage() { return <Page title="Analytics" desc="Engagement metrics, deliverability & A/B results." nextTo="/template" nextLabel="Restart Flow" /> }
function Page({ title, desc, nextTo, nextLabel }: { title:string; desc:string; nextTo?:string; nextLabel?:string }) { 
  const navigate = useNavigate();
  return (
    <div style={{ maxWidth:860 }}>
      <h1 style={{ margin:'0 0 12px' }}>{title}</h1>
      <p style={{ opacity:.7, margin:'0 0 28px' }}>{desc}</p>
      <div style={{ padding:24, background:'#222', border:'1px solid #333', borderRadius:8, display:'flex', flexDirection:'column', gap:20 }}>
        <p style={{ margin:0 }}>Placeholder for charts & performance dashboards.</p>
        {nextTo && <button onClick={() => navigate(nextTo)} style={{ alignSelf:'flex-start', background:'#1db954', border:'none', padding:'10px 18px', borderRadius:6, cursor:'pointer', fontWeight:600 }}>{nextLabel || 'Next'} →</button>}
      </div>
    </div>
  )
}
