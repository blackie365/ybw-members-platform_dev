import { initializeApp } from 'firebase/app';
import { getFirestore, collection, addDoc } from 'firebase/firestore';
import * as dotenv from 'dotenv';

dotenv.config({ path: './.env.local' });

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app, "ybm-db20032026"); // Explicit database ID

async function insert() {
  try {
    const insight = {
      title: "Yorkshire Women in Business: Economic Impact",
      points: [
        "Test database connection"
      ],
      createdAt: new Date().toISOString()
    };

    const docRef = await addDoc(collection(db, 'marketInsights'), insight);
    console.log('Successfully inserted market insight with ID:', docRef.id);
  } catch (error) {
    console.error('Error inserting data:', error);
  }
}

insert();
