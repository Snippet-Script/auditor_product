import React, { useEffect, useState, useCallback } from 'react';
import { useAuth } from '../../auth/auth';

interface UsageDoc {
  totalInputTokens?: number;
  totalOutputTokens?: number;
  totalCost?: number;
}

export function UsageBadge() {
  const { idToken } = useAuth();
  const [usage, setUsage] = useState<UsageDoc | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [persistence, setPersistence] = useState<boolean | null>(null);

  const load = useCallback(() => {
    if (!idToken) return;
    fetch('/api/usage/me', { headers: { Authorization: `Bearer ${idToken}` } })
      .then(async r => { if(!r.ok) throw new Error(await r.text()); return r.json(); })
      .then(d => { setUsage(d.usage); setPersistence(d.persistence); setError(null); })
      .catch(e => { setError(e.message || 'err'); });
  }, [idToken]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    const handler = () => load();
    window.addEventListener('usage-updated', handler);
    return () => window.removeEventListener('usage-updated', handler);
  }, [load]);

  if (error) return <span style={styleBase}>usage: error</span>;
  if (!usage) return <span style={styleBase}>tokens: —</span>;
  return (
    <span style={styleBase}>
      in {(usage.totalInputTokens||0).toLocaleString()} · out {(usage.totalOutputTokens||0).toLocaleString()} · ${(usage.totalCost||0).toFixed(4)}{persistence===false ? ' (local)' : ''}
    </span>
  );
}

const styleBase: React.CSSProperties = {
  fontSize: 12,
  background: '#222222',
  color: '#ccc',
  padding: '4px 8px',
  borderRadius: 16,
  border: '1px solid #333'
};
