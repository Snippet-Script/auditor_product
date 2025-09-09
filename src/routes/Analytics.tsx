import React from 'react'
export default function Analytics() { return <Page title="Analytics" desc="Engagement metrics, deliverability & A/B results." /> }
function Page({ title, desc }: { title:string; desc:string }) { return (
  <div style={{ maxWidth:860 }}>
    <h1 style={{ margin:'0 0 12px' }}>{title}</h1>
    <p style={{ opacity:.7, margin:'0 0 28px' }}>{desc}</p>
    <div style={{ padding:24, background:'#222', border:'1px solid #333', borderRadius:8 }}>
      <p style={{ margin:0 }}>Placeholder for charts & performance dashboards.</p>
    </div>
  </div>
) }
