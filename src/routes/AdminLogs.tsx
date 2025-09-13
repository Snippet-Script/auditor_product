import React, { useEffect, useState, useCallback } from 'react';
import { useAuth } from '../auth/auth';

interface LogRow {
  id: string;
  uid: string;
  email?: string;
  at: number;
  model?: string;
  tone?: string | null;
  inputTokens: number;
  outputTokens: number;
  totalCost: number;
  inputPreview?: string;
  outputPreview?: string;
}

interface UsageUserRow { id: string; email?: string; totalInputTokens?: number; totalOutputTokens?: number; totalCost?: number; }

export default function AdminLogs() {
  const { idToken } = useAuth();
  const [rows, setRows] = useState<LogRow[]>([]);
  const [limit, setLimit] = useState(100);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [users, setUsers] = useState<UsageUserRow[]>([]);
  const [filterUid, setFilterUid] = useState('');
  const [autoRefresh, setAutoRefresh] = useState(true);

  const fetchUsers = useCallback(() => {
    if (!idToken) return;
    fetch('/api/usage/all', { headers: { Authorization: `Bearer ${idToken}` }})
      .then(r => r.ok ? r.json() : r.text().then(t=>{throw new Error(t)}))
      .then(d => setUsers(d.rows || []))
      .catch(()=>{});
  }, [idToken]);

  const load = useCallback(() => {
    if (!idToken) return;
    setLoading(true); setError(null);
    const qs = new URLSearchParams();
    qs.set('limit', String(limit));
    if (filterUid) qs.set('uid', filterUid);
    fetch('/api/usage/logs?' + qs.toString(), { headers: { Authorization: `Bearer ${idToken}` }})
      .then(r => r.ok ? r.json() : r.text().then(t=>{throw new Error(t)}))
      .then(d => { setRows(d.rows || []); })
      .catch(e => setError(e.message || 'error'))
      .finally(()=> setLoading(false));
  }, [idToken, limit, filterUid]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { fetchUsers(); }, [fetchUsers]);

  // Auto refresh interval
  useEffect(() => {
    if (!autoRefresh) return;
    const id = setInterval(() => load(), 30000);
    return () => clearInterval(id);
  }, [autoRefresh, load]);

  const formatTime = (ms: number) => new Date(ms).toLocaleString();
  const formatNum = (n:number) => n.toLocaleString();
  const formatCost = (c:number) => '$' + c.toFixed(4);

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:20 }}>
      <h2 style={{ margin:0, fontSize:20 }}>Usage Logs</h2>
      <div style={{ display:'flex', flexWrap:'wrap', gap:12, alignItems:'center' }}>
        <label style={{ fontSize:12 }}>Limit:
          <select value={limit} onChange={e=> setLimit(parseInt(e.target.value,10))} style={selStyle}>
            {[50,100,250,500].map(v=> <option key={v} value={v}>{v}</option>)}
          </select>
        </label>
        <label style={{ fontSize:12 }}>User:
          <select value={filterUid} onChange={e=> setFilterUid(e.target.value)} style={selStyle}>
            <option value=''>All</option>
            {users.map(u => <option key={u.id} value={u.id}>{u.email || u.id}</option>)}
          </select>
        </label>
        <label style={{ fontSize:12 }}>Auto refresh
          <input type='checkbox' checked={autoRefresh} onChange={e=> setAutoRefresh(e.target.checked)} style={{ marginLeft:6 }} />
        </label>
        <button onClick={load} disabled={loading} style={btnStyle}>{loading? 'Loading…' : 'Refresh'}</button>
      </div>
      {error && <div style={{ background:'#411', color:'#faa', padding:10, border:'1px solid #633', borderRadius:4 }}>{error}</div>}
      <div style={{ overflow:'auto', border:'1px solid #333', borderRadius:6 }}>
        <table style={{ width:'100%', borderCollapse:'collapse', fontSize:12 }}>
          <thead style={{ background:'#222' }}>
            <tr>
              <th style={th}>Time</th>
              <th style={th}>User</th>
              <th style={th}>Tone</th>
              <th style={th}>In</th>
              <th style={th}>Out</th>
              <th style={th}>Cost</th>
              <th style={th}>Input</th>
              <th style={th}>Output</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(r => (
              <tr key={r.id} style={{ background:'#181818', borderTop:'1px solid #222' }}>
                <td style={td}>{formatTime(r.at)}</td>
                <td style={td}>{r.email || r.uid}</td>
                <td style={td}>{r.tone || '—'}</td>
                <td style={td}>{formatNum(r.inputTokens)}</td>
                <td style={td}>{formatNum(r.outputTokens)}</td>
                <td style={td}>{formatCost(r.totalCost)}</td>
                <td style={{ ...td, maxWidth:260 }} title={r.inputPreview}>{r.inputPreview || '—'}</td>
                <td style={{ ...td, maxWidth:260 }} title={r.outputPreview}>{r.outputPreview || '—'}</td>
              </tr>
            ))}
            {rows.length === 0 && !loading && (
              <tr><td style={{ ...td, textAlign:'center' }} colSpan={8}>No logs</td></tr>
            )}
          </tbody>
        </table>
      </div>
      <div style={{ fontSize:11, opacity:.7 }}>Auto refresh every 30s when enabled. Showing most recent first.</div>
    </div>
  );
}

const th: React.CSSProperties = { textAlign:'left', padding:'8px 10px', fontWeight:600, borderBottom:'1px solid #333', position:'sticky', top:0 };
const td: React.CSSProperties = { padding:'6px 10px', verticalAlign:'top', lineHeight:1.4 };
const selStyle: React.CSSProperties = { marginLeft:6, background:'#111', color:'#eee', border:'1px solid #333', padding:'4px 6px', borderRadius:4 };
const btnStyle: React.CSSProperties = { background:'#1db954', color:'#fff', border:'0', padding:'6px 12px', borderRadius:4, cursor:'pointer', fontSize:12 };
