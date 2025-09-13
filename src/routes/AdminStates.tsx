import React, { useEffect, useState } from 'react';
import { useAuth } from '../auth/auth';

interface StateRow { id: string; updatedAt?: number; pages?: number; assets?: number; }

export default function AdminStates() {
  const { idToken, user } = useAuth();
  const [rows, setRows] = useState<StateRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!idToken) return;
    setLoading(true);
    fetch('/api/admin/states', { headers: { Authorization: `Bearer ${idToken}` } })
      .then(async r => { if(!r.ok) throw new Error(await r.text()); return r.json(); })
      .then(d => setRows(d.rows || []))
      .catch(e => setError(e.message || 'Failed'))
      .finally(()=> setLoading(false));
  }, [idToken]);

  return (
    <div style={{ padding: '1rem' }}>
      <h1>User States (Admin)</h1>
      {!user?.email && <p>Not signed in.</p>}
      {error && <p style={{ color: 'red' }}>{error}</p>}
      {loading && <p>Loading...</p>}
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={th}>User ID</th>
              <th style={th}>Pages</th>
              <th style={th}>Assets</th>
              <th style={th}>Updated</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(r => (
              <tr key={r.id}>
                <td style={td}>{r.id}</td>
                <td style={td}>{r.pages ?? '-'}</td>
                <td style={td}>{r.assets ?? '-'}</td>
                <td style={td}>{r.updatedAt ? new Date(r.updatedAt).toLocaleString() : ''}</td>
              </tr>
            ))}
            {!rows.length && !loading && <tr><td style={td} colSpan={4}>No data</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}

const th: React.CSSProperties = { borderBottom: '1px solid #ccc', textAlign: 'left', padding: '4px 8px', background: '#f8f8f8' };
const td: React.CSSProperties = { borderBottom: '1px solid #eee', padding: '4px 8px', fontSize: 14 };
