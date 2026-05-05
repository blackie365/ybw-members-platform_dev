import * as admin from 'firebase-admin';
import { getFirestore } from 'firebase-admin/firestore';

if (!admin.apps.length) {
  try {
    let privateKey = process.env.FIREBASE_PRIVATE_KEY;
    if (privateKey) {
      // Remove surrounding quotes if Vercel adds them
      privateKey = privateKey.replace(/^"|"$/g, '');
      // Convert escaped newlines to actual newlines
      privateKey = privateKey.replace(/\\n/g, '\n');
    }
    
    const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
    const projectId = process.env.FIREBASE_PROJECT_ID || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || 'ghostpublishing-v2';

    if (privateKey && clientEmail && projectId) {
      admin.initializeApp({
        credential: admin.credential.cert({
          projectId,
          clientEmail,
          privateKey,
        }),
      });
    } else {
      console.warn('Firebase admin credentials missing. Initializing with default configuration.');
      admin.initializeApp({
        projectId: projectId || 'ghostpublishing-v2',
      });
      // Optionally throw here so the user immediately knows the ENV is missing in Vercel:
      // throw new Error("Missing FIREBASE_PRIVATE_KEY or FIREBASE_CLIENT_EMAIL environment variables.");
    }
  } catch (error) {
    console.error('Firebase admin initialization error', error);
  }
}

// Specify the correct database ID used by the production project
const dbId = process.env.FIREBASE_DATABASE_ID || process.env.NEXT_PUBLIC_FIREBASE_DATABASE_ID || 'ghost-members';
export const adminDb = getFirestore(admin.app(), dbId);
export const adminAuth = admin.auth();
