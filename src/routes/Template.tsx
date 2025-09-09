import React from 'react'
import { useNavigate } from 'react-router-dom'
export default function Template() { return <Page title="Template" desc="Select or configure a starting template." nextTo="/source" nextLabel="Next: Source" /> }
function Page({ title, desc, nextTo, nextLabel }: { title:string; desc:string; nextTo?:string; nextLabel?:string }) { 
  const navigate = useNavigate();
  return (
    <div style={{ maxWidth:860 }}>
      <h1 style={{ margin:'0 0 12px' }}>{title}</h1>
      <p style={{ opacity:.7, margin:'0 0 28px' }}>{desc}</p>
      <div style={{ padding:24, background:'#222', border:'1px solid #333', borderRadius:8, display:'flex', flexDirection:'column', gap:20 }}>
        <p style={{ margin:0, fontSize:14, lineHeight:1.5 }}>Placeholder area for <strong>{title}</strong> workflow. Implement UI here.</p>
        {nextTo && (
          <div>
            <button onClick={() => navigate(nextTo)} style={{ background:'#1db954', border:'none', padding:'10px 18px', borderRadius:6, cursor:'pointer', fontWeight:600 }}> {nextLabel || 'Next'} →</button>
          </div>
        )}
      </div>
    </div>
  )
}
