export type RewriteUsage = {
  inputTokens: number;
  outputTokens: number;
  inputCost: number;
  outputCost: number;
  totalCost: number;
};

export async function rewriteWithAI(input: string, tone: string | undefined, idToken: string | null): Promise<{ text: string; usage?: RewriteUsage }> {
  const resp = await fetch('/api/rewrite', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(idToken ? { Authorization: `Bearer ${idToken}` } : {}) },
    body: JSON.stringify({ text: input, tone }),
  });
  if (!resp.ok) {
    const detail = await resp.text();
    throw new Error(`AI rewrite failed: ${resp.status} ${detail}`);
  }
  const data = await resp.json();
  return { text: data.text as string, usage: data.usage };
}
