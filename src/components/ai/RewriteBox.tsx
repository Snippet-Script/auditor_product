import React from 'react';
import { rewriteWithAI } from '../../lib/ai';

export function RewriteBox() {
  const [value, setValue] = React.useState('B.E. ELECTRONICS & COMMUNICATION ENGINEERING');
  const [tone, setTone] = React.useState('Concise');
  const [out, setOut] = React.useState('');
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const onRewrite = async () => {
    setLoading(true);
    setError(null);
    try {
      const text = await rewriteWithAI(value, tone);
      setOut(text);
    } catch (e: any) {
      setError(e.message || 'Failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ maxWidth: 640, margin: '1rem auto', padding: '1rem', border: '1px solid #ddd', borderRadius: 8 }}>
      <h3>Rewrite with AI</h3>
      <label style={{ display: 'block', fontSize: 12, color: '#666' }}>Input</label>
      <textarea value={value} onChange={(e) => setValue(e.target.value)} rows={4} style={{ width: '100%' }} />
      <div style={{ marginTop: 8, display: 'flex', gap: 8 }}>
        <select value={tone} onChange={(e) => setTone(e.target.value)}>
          <option>Concise</option>
          <option>Friendly</option>
          <option>Professional</option>
          <option>Expand</option>
        </select>
        <button onClick={onRewrite} disabled={loading}>
          {loading ? 'Rewriting…' : 'Rewrite'}
        </button>
      </div>
      {error && <p style={{ color: 'crimson' }}>{error}</p>}
      <div style={{ marginTop: 12, background: '#fafafa', padding: 8, borderRadius: 6 }}>
        <label style={{ display: 'block', fontSize: 12, color: '#666' }}>Output</label>
        <div>{out || '—'}</div>
      </div>
    </div>
  );
}
