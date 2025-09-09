import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3000;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-1.5-flash';

if (!GEMINI_API_KEY) {
  console.warn('GEMINI_API_KEY is not set. Set it in the environment.');
}

app.post('/api/rewrite', async (req, res) => {
  try {
    const { text, tone } = req.body || {};
    if (!text || typeof text !== 'string') {
      return res.status(400).json({ error: 'Missing text' });
    }
    if (!GEMINI_API_KEY) {
      return res.status(500).json({ error: 'Server missing GEMINI_API_KEY' });
    }
    const prompt = tone ? `${tone} rewrite: ${text}` : text;
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${encodeURIComponent(GEMINI_API_KEY)}`;
  const resp = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': GEMINI_API_KEY || ''
      },
      body: JSON.stringify({
        contents: [
          { parts: [{ text: prompt }] }
        ]
      })
    });
    let data;
    if (!resp.ok) {
      const text = await resp.text();
      let parsed;
      try { parsed = JSON.parse(text); } catch { /* ignore */ }
      const detail = parsed?.error?.message || parsed?.message || text || 'Unknown error';
      return res.status(resp.status).json({ error: 'Gemini API error', detail, model: GEMINI_MODEL });
    } else {
      data = await resp.json();
    }
    const out = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
    res.json({ text: out });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Health endpoint to verify config
app.get('/api/health', (_req, res) => {
  res.json({ ok: true, model: GEMINI_MODEL, hasKey: Boolean(GEMINI_API_KEY) });
});

// Serve static built assets if present (optional)
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const distDir = path.resolve(__dirname, '../dist');
app.use(express.static(distDir));
app.get('*', (req, res) => {
  res.sendFile(path.join(distDir, 'index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server listening on http://0.0.0.0:${PORT}`);
});
