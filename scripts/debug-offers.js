const admin = require('firebase-admin');
const path = require('path');
const fs = require('fs');

const serviceAccountPath = path.join(process.cwd(), 'serviceAccountKey.json');
if (fs.existsSync(serviceAccountPath)) {
  const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'));
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
} else {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    })
  });
}

const db = admin.firestore();

async function listOffers() {
  const offersRef = db.collection('offer_requests');
  const snapshot = await offersRef.get();
  
  console.log(`Total offers: ${snapshot.size}`);
  snapshot.forEach(doc => {
    console.log(`ID: ${doc.id} | Status: ${doc.data().status} | Title: ${doc.data().title}`);
  });
}

listOffers().catch(console.error);
