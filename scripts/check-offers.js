const { getFirestore } = require('firebase-admin/firestore');
const admin = require('firebase-admin');
const path = require('path');
const fs = require('fs');

const serviceAccountPath = path?.join(process.cwd(), 'serviceAccountKey.json');
if (fs?.existsSync(serviceAccountPath)) {
  const serviceAccount = JSON.parse(fs?.readFileSync(serviceAccountPath, 'utf8'));
  admin?.initializeApp({
    credential: admin?.credential?.cert(serviceAccount)
  });
} else {
  admin?.initializeApp({
    credential: admin?.credential?.cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    })
  });
}

const db = getFirestore();

async function checkOffers() {
  const offersRef = db?.collection('offer_requests');
  const snapshot = await offersRef?.get();
  
  if (snapshot?.empty) {
    console.log('No offers found in offer_requests.');
    return;
  }

  snapshot?.forEach(doc => {
    const data = doc?.data();
    console.log(`ID: ${doc?.id} | Status: ${data?.status} | Title: ${data?.title}`);
  });
}

checkOffers()?.catch(console.error);
