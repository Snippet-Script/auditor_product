import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import { adminAuth, adminDb, adminReady } from './firebaseAdmin.js';
import { estimateTokens, costForTokens } from './tokenUtil.js';

const app = express();
app.use(cors());
// Allow larger JSON payloads (default ~100kb) since canvas state can include base64 images.
const BODY_LIMIT = process.env.BODY_LIMIT || '4mb';
app.use(express.json({ limit: BODY_LIMIT }));

const PORT = process.env.PORT || 3000;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-1.5-flash';
const ADMIN_EMAILS = (process.env.ADMIN_EMAILS || '').split(',').map(e=>e.trim()).filter(Boolean);

if (!GEMINI_API_KEY) {
  console.warn('GEMINI_API_KEY is not set. Set it in the environment.');
}

const ALLOW_UNAUTH_AI = process.env.ALLOW_UNAUTH_AI === 'true';

// Middleware to verify Firebase ID token from Authorization: Bearer <token>
async function authMiddleware(req, res, next) {
  if (!adminReady || !adminAuth) {
    if (ALLOW_UNAUTH_AI) {
      // mark pseudo-user for anonymous usage (not persisted)
      req.user = { uid: 'dev-anon' };
      return next();
    }
    return res.status(500).json({ error: 'Auth not configured' });
  }
  const authHeader = req.headers.authorization || '';
  const [, token] = authHeader.split(' ');
  if (!token) return res.status(401).json({ error: 'Missing bearer token' });
  try {
    const decoded = await adminAuth.verifyIdToken(token);
    req.user = decoded; // contains uid, email, etc.
    next();
  } catch (e) {
    return res.status(401).json({ error: 'Invalid token' });
  }
}

// User state document path helper
function userStateRef(uid) { return adminDb.collection('userStates').doc(uid); }

// GET user state
app.get('/api/user/state', authMiddleware, async (req, res) => {
  if (!adminReady || !adminDb) return res.status(500).json({ error: 'DB not configured' });
  try {
    const snap = await userStateRef(req.user.uid).get();
    if (!snap.exists) return res.json({ state: null });
    res.json({ state: snap.data(), updatedAt: snap.updateTime });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to fetch state' });
  }
});

// POST user state (replace / upsert)
app.post('/api/user/state', authMiddleware, async (req, res) => {
  if (!adminReady || !adminDb) return res.status(500).json({ error: 'DB not configured' });
  try {
    const { state } = req.body || {};
    if (state == null) return res.status(400).json({ error: 'Missing state' });
    await userStateRef(req.user.uid).set({ state, updatedAt: Date.now() }, { merge: true });
    res.json({ ok: true });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to save state' });
  }
});

app.post('/api/rewrite', authMiddleware, async (req, res) => {
  // In bypass mode allow rewrite without Firestore persistence
  const canPersist = adminReady && adminDb && req.user?.uid && req.user.uid !== 'dev-anon';
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

    // Token accounting (heuristic)
    const inputTokens = estimateTokens(prompt);
    const outputTokens = estimateTokens(out);
    const { inputCost, outputCost, totalCost } = costForTokens(inputTokens, outputTokens);

    // Persist usage aggregate per user + append log row
    let cumulative;
    if (canPersist) {
      const usageRef = adminDb.collection('usage').doc(req.user.uid);
      const logsCol = adminDb.collection('usageLogs');
      const now = Date.now();
      await adminDb.runTransaction(async (tx) => {
        const snap = await tx.get(usageRef);
        const prev = snap.exists ? snap.data() : {};
        const updated = {
          email: req.user.email || prev.email || null,
          totalInputTokens: (prev.totalInputTokens || 0) + inputTokens,
          totalOutputTokens: (prev.totalOutputTokens || 0) + outputTokens,
          totalCost: (prev.totalCost || 0) + totalCost,
          lastAt: now,
          model: GEMINI_MODEL,
        };
        tx.set(usageRef, updated, { merge: true });
        cumulative = updated;
        // Store a trimmed log entry (avoid huge payloads)
        const logDoc = logsCol.doc();
        tx.set(logDoc, {
          uid: req.user.uid,
            email: req.user.email || null,
          at: now,
          model: GEMINI_MODEL,
          tone: tone || null,
          inputTokens,
          outputTokens,
          totalCost,
          inputPreview: prompt.slice(0, 180),
          outputPreview: out.slice(0, 180),
        });
      });
    }

    res.json({ text: out, usage: { inputTokens, outputTokens, inputCost, outputCost, totalCost, cumulative } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Current user usage summary
app.get('/api/usage/me', authMiddleware, async (req, res) => {
  if (!adminReady || !adminDb) return res.json({ usage: null, persistence: false });
  try {
    const ref = adminDb.collection('usage').doc(req.user.uid);
    const snap = await ref.get();
    res.json({ usage: snap.exists ? snap.data() : null, persistence: true });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to fetch usage' });
  }
});

// Admin: list all users usage
app.get('/api/usage/all', authMiddleware, async (req, res) => {
  if (!adminReady || !adminDb) return res.status(500).json({ error: 'DB not configured' });
  if (!req.user?.email || !ADMIN_EMAILS.includes(req.user.email)) return res.status(403).json({ error: 'Forbidden' });
  try {
    const snap = await adminDb.collection('usage').get();
    const rows = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    res.json({ rows });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to list usage' });
  }
});

// Admin: list all user states (metadata + size)
app.get('/api/admin/states', authMiddleware, async (req, res) => {
  if (!adminReady || !adminDb) return res.status(500).json({ error: 'DB not configured' });
  if (!req.user?.email || !ADMIN_EMAILS.includes(req.user.email)) return res.status(403).json({ error: 'Forbidden' });
  try {
    const snap = await adminDb.collection('userStates').get();
    const rows = snap.docs.map(d => {
      const data = d.data();
      const state = data.state;
      let pages = 0;
      try { if (state?.pages && Array.isArray(state.pages)) pages = state.pages.length; } catch {}
      return {
        id: d.id,
        updatedAt: data.updatedAt || null,
        pages,
        assets: Array.isArray(state?.assets) ? state.assets.length : 0,
        // state omitted here by default to limit payload size; include minimal summary
      };
    });
    res.json({ rows });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to list states' });
  }
});

// Admin: list usage logs (recent first) with optional uid filter
app.get('/api/usage/logs', authMiddleware, async (req, res) => {
  if (!adminReady || !adminDb) return res.status(500).json({ error: 'DB not configured' });
  if (!req.user?.email || !ADMIN_EMAILS.includes(req.user.email)) return res.status(403).json({ error: 'Forbidden' });
  try {
    const { uid, limit } = req.query;
    const lim = Math.min( parseInt(limit, 10) || 100, 500);
    let q = adminDb.collection('usageLogs').orderBy('at', 'desc').limit(lim);
    if (uid && typeof uid === 'string' && uid.trim()) {
      q = adminDb.collection('usageLogs').where('uid', '==', uid).orderBy('at', 'desc').limit(lim);
    }
    const snap = await q.get();
    const rows = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    res.json({ rows });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to list logs' });
  }
});

// Health endpoint to verify config
app.get('/api/health', (_req, res) => {
  res.json({ ok: true, model: GEMINI_MODEL, hasKey: Boolean(GEMINI_API_KEY), adminReady });
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
  console.log(`[config] JSON body limit set to ${BODY_LIMIT}`);
});

// Generic error handler (after all routes) to produce JSON for large payload errors
// (Express will call this if a body parse error bubbles)
app.use((err, _req, res, _next) => {
  if (err && err.type === 'entity.too.large') {
    return res.status(413).json({ error: 'Payload too large', limit: BODY_LIMIT });
  }
  if (err) {
    console.error('Unhandled server error:', err);
    return res.status(500).json({ error: 'Server error' });
  }
});
