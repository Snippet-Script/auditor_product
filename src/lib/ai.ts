export async function rewriteWithAI(input: string, tone?: string): Promise<string> {
  const resp = await fetch('/api/rewrite', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text: input, tone }),
  });
  if (!resp.ok) {
    const detail = await resp.text();
    throw new Error(`AI rewrite failed: ${resp.status} ${detail}`);
  }
  const data = await resp.json();
  return data.text as string;
}
