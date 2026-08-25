import * as admin from 'firebase-admin';
import { getFirestore } from 'firebase-admin/firestore';

if (!admin?.apps?.length) {
  try {
    let privateKey = process.env.FIREBASE_PRIVATE_KEY;
    let clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
    const projectId = process.env.FIREBASE_PROJECT_ID || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
    if (privateKey) {
      // If the user accidentally pasted the entire JSON file contents
      if (privateKey?.trim()?.startsWith('{')) {
        try {
          const parsed = JSON.parse(privateKey);
          if (parsed?.private_key) privateKey = parsed?.private_key;
        } catch (e) {
          console.warn('[Firebase Admin] Failed to parse private key JSON');
        }
      }
      
      if (privateKey) {
        // Remove surrounding quotes if Vercel adds them
        privateKey = privateKey?.replace(/^"|"$/g, '');
        // Convert escaped newlines to actual newlines
        privateKey = privateKey?.replace(/\\n/g, '\n');
        
        // If the user only copied the base64 string without the header/footer
        if (!privateKey?.includes('-----BEGIN PRIVATE KEY-----')) {
          privateKey = `-----BEGIN PRIVATE KEY-----\n${privateKey?.trim()}\n-----END PRIVATE KEY-----\n`;
        }
      }
    }

    const keyMasked = (() => {
      if (!privateKey) return '(unset)';
      const raw = privateKey.replace(/\n/g, '');
      const match = raw.match(/-----BEGIN PRIVATE KEY-----(.*)-----END PRIVATE KEY-----/);
      const core = match ? match[1] : raw;
      if (core.length <= 12) return '***';
      return core.slice(0, 6) + '…' + core.slice(-6);
    })();
    const emailMasked = (() => {
      if (!clientEmail) return '(unset)';
      if (clientEmail.length <= 8) return '***';
      return clientEmail.slice(0, 3) + '…' + clientEmail.slice(-6);
    })();

    console.info(
      `[Firebase Admin] init projectId=${JSON.stringify(projectId || '(unset)')} ` +
      `clientEmail=${emailMasked} privateKey=${keyMasked} ` +
      `NEXT_PUBLIC_FIREBASE_PROJECT_ID=${JSON.stringify(process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || '')}`
    );

    if (privateKey && clientEmail) {
      try {
        const finalProjectId = projectId;
        admin?.initializeApp({
          credential: admin?.credential?.cert({
            projectId: finalProjectId,
            clientEmail,
            privateKey,
          }),
          projectId: finalProjectId,
          storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || `${finalProjectId}.firebasestorage.app`
        });
        console.info(`[Firebase Admin] initializeApp OK apps.length=${admin.apps.length}`);
      } catch (initError) {
        console.error('[Firebase Admin] Critical initialization error:', initError);
      }
    } else {
      console.warn('[Firebase Admin] Missing credentials. Some admin features may fail.');
    }
  } catch (error) {
    console.error('Firebase admin initialization error', error);
  }
}

// Specify the correct database ID used by the project
const dbIdRaw = process.env.NEXT_PUBLIC_FIREBASE_DATABASE_ID;
const dbId = typeof dbIdRaw === 'string' && dbIdRaw.trim() ? dbIdRaw.trim() : '(default)';

// Safely export services only if the app is initialized
let firestore: ReturnType<typeof getFirestore> | null = null;
let firestoreInitError: string | null = null;
let firestoreUsedFallback = false;

if (admin?.apps?.length > 0) {
  try {
    firestore = getFirestore(admin.app(), dbId);
    try {
      firestore.settings({ ignoreUndefinedProperties: true });
    } catch (e: any) {
      if (!e.message?.includes('has already been initialized')) {
        throw e;
      }
    }
  } catch (e: any) {
    firestoreInitError = String(e?.message || e || 'Unknown Firestore init error');
    try {
      firestore = getFirestore(admin.app());
      try {
        firestore.settings({ ignoreUndefinedProperties: true });
      } catch (e2: any) {
        if (!e2.message?.includes('has already been initialized')) {
          throw e2;
        }
      }
      firestoreUsedFallback = true;
    } catch (e2: any) {
      const fallbackErr = String(e2?.message || e2 || 'Unknown Firestore init error (fallback)');
      firestoreInitError = `${firestoreInitError} | fallback: ${fallbackErr}`;
      firestore = null;
    }
  }
}

export const adminDb = firestore;
export const adminDbInit = {
  ok: Boolean(firestore),
  databaseId: dbId,
  usedFallback: firestoreUsedFallback,
  error: firestoreInitError,
};
export const adminAuth = admin?.apps?.length > 0 ? admin?.auth() : null;
export const adminStorage = admin?.apps?.length > 0 ? admin?.storage() : null;

(function _firestoreDbSummaryLog() {
  const storage = process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || '';
  console.info(
    `[Firebase Admin] firestore ready=${Boolean(firestore)} databaseId=${JSON.stringify(dbId)} ` +
    `usedFallback=${firestoreUsedFallback} storageBucket=${JSON.stringify(storage)} ` +
    `NEXT_PUBLIC_FIREBASE_DATABASE_ID=${JSON.stringify(process.env.NEXT_PUBLIC_FIREBASE_DATABASE_ID || '')}` +
    (firestoreInitError ? ` error=${firestoreInitError}` : '')
  );
})();
