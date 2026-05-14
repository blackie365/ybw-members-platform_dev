import * as admin from 'firebase-admin';
import { getFirestore } from 'firebase-admin/firestore';
import fs from 'fs';
import path from 'path';

if (!admin.apps.length) {
  try {
    let privateKey = process.env.FIREBASE_PRIVATE_KEY;
    let clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
    const projectId = process.env.FIREBASE_PROJECT_ID || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || 'newmembersdirectory130325';

    // Local development fallback using serviceAccountKey.json
    if (!privateKey || !clientEmail) {
      try {
        const serviceAccountPath = path.join(process.cwd(), 'serviceAccountKey.json');
        if (fs.existsSync(serviceAccountPath)) {
          const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'));
          privateKey = serviceAccount.private_key;
          clientEmail = serviceAccount.client_email;
          console.log('Loaded Firebase Admin credentials from local serviceAccountKey.json');
        }
      } catch (e) {
        console.warn('Could not load local serviceAccountKey.json', e);
      }
    }
    if (privateKey) {
      // If the user accidentally pasted the entire JSON file contents
      if (privateKey.trim().startsWith('{')) {
        try {
          const parsed = JSON.parse(privateKey);
          if (parsed.private_key) privateKey = parsed.private_key;
        } catch (e) {}
      }
      
      if (privateKey) {
        // Remove surrounding quotes if Vercel adds them
        privateKey = privateKey.replace(/^"|"$/g, '');
        // Convert escaped newlines to actual newlines
        privateKey = privateKey.replace(/\\n/g, '\n');
        
        // If the user only copied the base64 string without the header/footer
        if (!privateKey.includes('-----BEGIN PRIVATE KEY-----')) {
          privateKey = `-----BEGIN PRIVATE KEY-----\n${privateKey.trim()}\n-----END PRIVATE KEY-----\n`;
        }
      }
    }

    if (privateKey && clientEmail && projectId) {
      admin.initializeApp({
        credential: admin.credential.cert({
          projectId: 'newmembersdirectory130325', // Hardcode to ensure correctness during build
          clientEmail,
          privateKey,
        }),
        projectId: 'newmembersdirectory130325' // Force project ID
      });
    } else {
      console.warn('Firebase admin credentials missing. Initializing with default configuration.');
      admin.initializeApp({
        projectId: projectId || 'newmembersdirectory130325',
      });
      // Optionally throw here so the user immediately knows the ENV is missing in Vercel:
      // throw new Error("Missing FIREBASE_PRIVATE_KEY or FIREBASE_CLIENT_EMAIL environment variables.");
    }
  } catch (error) {
    console.error('Firebase admin initialization error', error);
  }
}

// Specify the correct database ID used by the project
const dbId = process.env.NEXT_PUBLIC_FIREBASE_DATABASE_ID || '(default)';
export const adminDb = getFirestore(admin.app(), dbId);
export const adminAuth = admin.auth();
