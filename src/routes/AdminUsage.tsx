import React, { useEffect, useState } from 'react';
import { useAuth } from '../auth/auth';

interface UsageRow {
  id: string;
  email?: string;
  totalInputTokens?: number;
  totalOutputTokens?: number;
  totalCost?: number;
  lastAt?: number;
  model?: string;
}

export default function AdminUsage() {
  const { idToken, user } = useAuth();
  const [rows, setRows] = useState<UsageRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!idToken) return;
    setLoading(true);
    fetch('/api/usage/all', { headers: { Authorization: `Bearer ${idToken}` } })
      .then(async r => { if(!r.ok) throw new Error(await r.text()); return r.json(); })
      .then(data => setRows(data.rows || []))
      .catch(e => setError(e.message || 'Failed'))
      .finally(()=>setLoading(false));
  }, [idToken]);

  return (
    <div style={{ padding: '1rem' }}>
      <h1>Usage (Admin)</h1>
      {!user?.email && <p>Not signed in.</p>}
      {error && <p style={{ color: 'red' }}>{error}</p>}
      {loading && <p>Loading...</p>}
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={th}>User ID</th>
              <th style={th}>Email</th>
              <th style={th}>Input Tokens</th>
              <th style={th}>Output Tokens</th>
              <th style={th}>Total Cost ($)</th>
              <th style={th}>Model</th>
              <th style={th}>Last Used</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(r => (
              <tr key={r.id}>
                <td style={td}>{r.id}</td>
                <td style={td}>{r.email || ''}</td>
                <td style={td}>{r.totalInputTokens || 0}</td>
                <td style={td}>{r.totalOutputTokens || 0}</td>
                <td style={td}>{(r.totalCost || 0).toFixed(6)}</td>
                <td style={td}>{r.model || ''}</td>
                <td style={td}>{r.lastAt ? new Date(r.lastAt).toLocaleString() : ''}</td>
              </tr>
            ))}
            {!rows.length && !loading && <tr><td style={td} colSpan={7}>No data</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}

const th: React.CSSProperties = { borderBottom: '1px solid #ccc', textAlign: 'left', padding: '4px 8px', background: '#000000ff' };
const td: React.CSSProperties = { borderBottom: '1px solid #eee', padding: '4px 8px', fontSize: 14 };
