import * as admin from 'firebase-admin';
import { getFirestore } from 'firebase-admin/firestore';

if (!admin.apps.length) {
  try {
    const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');
    const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
    const projectId = process.env.FIREBASE_PROJECT_ID || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;

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
    }
  } catch (error) {
    console.error('Firebase admin initialization error', error);
  }
}

// Specify the correct database ID used by the production project
export const adminDb = getFirestore(admin.app(), 'ybm-db20032026');
export const adminAuth = admin.auth();
