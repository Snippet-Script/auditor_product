import admin from 'firebase-admin';

// Prefer individual credential fields; fallback to base64 JSON if not provided
const DEBUG = process.env.FIREBASE_DEBUG === 'true';
function getSanitizedPrivateKey() {
  let raw = process.env.FIREBASE_PRIVATE_KEY || '';
  // Remove accidental surrounding quotes
  if (raw.startsWith('"') && raw.endsWith('"')) {
    raw = raw.slice(1, -1);
  }
  // Convert literal \n to real newlines
  let pk = raw.replace(/\\n/g, '\n');
  // Normalize CRLF just in case
  pk = pk.replace(/\r\n/g, '\n');
  return pk;
}
const hasIndividual = Boolean(process.env.FIREBASE_PROJECT_ID && process.env.FIREBASE_CLIENT_EMAIL && process.env.FIREBASE_PRIVATE_KEY);
const b64 = process.env.FIREBASE_SERVICE_ACCOUNT_B64;

let initialized = false;
try {
  if (!admin.apps.length) {
    if (hasIndividual) {
      if (DEBUG) console.log('[firebaseAdmin][debug] Initializing with individual credential fields.');
      const privateKey = getSanitizedPrivateKey();
      if (DEBUG) {
        console.log('[firebaseAdmin][debug] PRIVATE_KEY length:', privateKey.length);
        console.log('[firebaseAdmin][debug] PRIVATE_KEY starts with BEGIN header:', privateKey.trim().startsWith('-----BEGIN PRIVATE KEY-----'));
      }
      admin.initializeApp({
        credential: admin.credential.cert({
          projectId: process.env.FIREBASE_PROJECT_ID,
          clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
          privateKey,
        }),
      });
      initialized = true;
    } else if (b64) {
      try {
        const decoded = Buffer.from(b64, 'base64').toString('utf8');
        const json = JSON.parse(decoded);
        if (DEBUG) {
          const keys = Object.keys(json).slice(0, 6).join(', ');
          console.log(`[firebaseAdmin][debug] Using base64 service account. Keys: ${keys}`);
        }
        admin.initializeApp({ credential: admin.credential.cert(json) });
        initialized = true;
      } catch (e) {
        console.error('[firebaseAdmin] Failed to parse FIREBASE_SERVICE_ACCOUNT_B64:', e.message);
        // Fallback to individual if available
        if (process.env.FIREBASE_PROJECT_ID && process.env.FIREBASE_CLIENT_EMAIL && process.env.FIREBASE_PRIVATE_KEY) {
          const privateKey = getSanitizedPrivateKey();
          if (DEBUG) {
            console.log('[firebaseAdmin][debug] (fallback) PRIVATE_KEY length:', privateKey.length);
            console.log('[firebaseAdmin][debug] (fallback) PRIVATE_KEY starts with BEGIN header:', privateKey.trim().startsWith('-----BEGIN PRIVATE KEY-----'));
          }
          admin.initializeApp({
            credential: admin.credential.cert({
              projectId: process.env.FIREBASE_PROJECT_ID,
              clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
              privateKey,
            }),
          });
          initialized = true;
          if (DEBUG) console.log('[firebaseAdmin][debug] Fallback to individual fields after base64 parse failure.');
        }
      }
    } else {
      const missing = [];
      if (!hasIndividual && !b64) {
        if (!process.env.FIREBASE_PROJECT_ID) missing.push('FIREBASE_PROJECT_ID');
        if (!process.env.FIREBASE_CLIENT_EMAIL) missing.push('FIREBASE_CLIENT_EMAIL');
        if (!process.env.FIREBASE_PRIVATE_KEY) missing.push('FIREBASE_PRIVATE_KEY');
      }
      console.warn('[firebaseAdmin] Firebase admin not fully configured. Provide FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY or FIREBASE_SERVICE_ACCOUNT_B64. Missing:', missing.join(', ') || 'service account base64');
      console.warn('[firebaseAdmin] Firestore + auth dependent endpoints will return DB not configured.');
      if (DEBUG) {
        console.log('[firebaseAdmin][debug] FIREBASE_SERVICE_ACCOUNT_B64 length:', b64 ? b64.length : 'none');
      }
    }
  } else {
    initialized = true;
  }
} catch (e) {
  console.error('Failed to initialize Firebase admin:', e);
}

export const adminReady = initialized;
export const adminAuth = initialized ? admin.auth() : null;
export const adminDb = initialized ? admin.firestore() : null;
