import admin from 'firebase-admin';

// Expect base64 service account json in FIREBASE_SERVICE_ACCOUNT_B64 or individual creds
const b64 = process.env.FIREBASE_SERVICE_ACCOUNT_B64;
const DEBUG = process.env.FIREBASE_DEBUG === 'true';
let initialized = false;
try {
  if (!admin.apps.length) {
    if (b64) {
      try {
        const decoded = Buffer.from(b64, 'base64').toString('utf8');
        const json = JSON.parse(decoded);
        if (DEBUG) {
          const keys = Object.keys(json).slice(0,6).join(', ');
          console.log(`[firebaseAdmin][debug] Using base64 service account. Keys: ${keys}`);
        }
        admin.initializeApp({ credential: admin.credential.cert(json) });
        initialized = true;
      } catch (e) {
        console.error('[firebaseAdmin] Failed to parse FIREBASE_SERVICE_ACCOUNT_B64:', e.message);
      }
    } else if (process.env.FIREBASE_PROJECT_ID && process.env.FIREBASE_CLIENT_EMAIL && process.env.FIREBASE_PRIVATE_KEY) {
      admin.initializeApp({
        credential: admin.credential.cert({
          projectId: process.env.FIREBASE_PROJECT_ID,
          clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
          privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
        }),
      });
      initialized = true;
      if (DEBUG) console.log('[firebaseAdmin][debug] Initialized with individual credential fields.');
    } else {
      const missing = [];
      if (!b64) {
        if (!process.env.FIREBASE_PROJECT_ID) missing.push('FIREBASE_PROJECT_ID');
        if (!process.env.FIREBASE_CLIENT_EMAIL) missing.push('FIREBASE_CLIENT_EMAIL');
        if (!process.env.FIREBASE_PRIVATE_KEY) missing.push('FIREBASE_PRIVATE_KEY');
      }
      console.warn('[firebaseAdmin] Firebase admin not fully configured. Provide FIREBASE_SERVICE_ACCOUNT_B64 or all individual vars. Missing:', missing.join(', ') || 'service account base64');
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
