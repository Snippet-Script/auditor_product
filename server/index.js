import express from 'express';
import cors from 'cors';

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3000;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

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
    const resp = await fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent', {
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
    if (!resp.ok) {
      const detail = await resp.text();
      return res.status(resp.status).json({ error: 'Gemini API error', detail });
    }
    const data = await resp.json();
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
