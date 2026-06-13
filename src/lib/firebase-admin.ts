import * as admin from 'firebase-admin';
import { getFirestore } from 'firebase-admin/firestore';
import fs from 'fs';
import path from 'path';

if (!admin?.apps?.length) {
  try {
    let privateKey = process.env.FIREBASE_PRIVATE_KEY;
    let clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
    const projectId = process.env.FIREBASE_PROJECT_ID || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || 'newmembersdirectory130325';

    // Local development fallback using serviceAccountKey.json
    if (!privateKey || !clientEmail) {
      try {
        const searchPaths = [
          path?.join(process.cwd(), 'serviceAccountKey.json'),
          path?.join(process.cwd(), '..', 'serviceAccountKey.json'),
          path?.join(__dirname, '..', '..', 'serviceAccountKey.json'),
          '/Users/robertblackwell/ybw-members-platform/ybw-frontend/serviceAccountKey.json'
        ];
        
        for (const serviceAccountPath of searchPaths) {
          if (fs?.existsSync(serviceAccountPath)) {
            const serviceAccount = JSON.parse(fs?.readFileSync(serviceAccountPath, 'utf8'));
            privateKey = serviceAccount?.private_key;
            clientEmail = serviceAccount?.client_email;
            console.log(`Loaded Firebase Admin credentials from ${serviceAccountPath}`);
            break;
          }
        }
      } catch (e) {
        console.warn('Could not load local serviceAccountKey.json', e);
      }
    }
    if (privateKey) {
      // If the user accidentally pasted the entire JSON file contents
      if (privateKey?.trim()?.startsWith('{')) {
        try {
          const parsed = JSON.parse(privateKey);
          if (parsed?.private_key) privateKey = parsed?.private_key;
        } catch (e) {}
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

    if (privateKey && clientEmail) {
      try {
        const finalProjectId = projectId || 'newmembersdirectory130325';
        console.log(`[Firebase Admin] Initializing for project: ${finalProjectId}`);
        
        admin?.initializeApp({
          credential: admin?.credential?.cert({
            projectId: finalProjectId,
            clientEmail,
            privateKey,
          }),
          projectId: finalProjectId,
          storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || `${finalProjectId}.firebasestorage.app`
        });
        
        console.log('[Firebase Admin] Initialization successful');
      } catch (initError) {
        console.error('[Firebase Admin] Critical initialization error:', initError);
      }
    } else {
      console.warn('[Firebase Admin] Missing credentials. Some admin features may fail.');
      console.log('[Firebase Admin] Check: privateKey exists:', !!privateKey, 'clientEmail exists:', !!clientEmail);
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
    firestore.settings({ ignoreUndefinedProperties: true });
  } catch (e: any) {
    firestoreInitError = String(e?.message || e || 'Unknown Firestore init error');
    try {
      firestore = getFirestore(admin.app());
      firestore.settings({ ignoreUndefinedProperties: true });
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
