import express from 'express';
import cors from 'cors';

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
    const prompt = tone ? `${tone} rewrite: ${text}` : text;
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;
  const resp = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-goog-api-key': GEMINI_API_KEY || ''
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

// Serve static built assets if present (optional)
app.use(express.static('dist'));
app.get('*', (req, res) => {
  res.sendFile(new URL('../dist/index.html', import.meta.url).pathname);
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server listening on http://0.0.0.0:${PORT}`);
});
