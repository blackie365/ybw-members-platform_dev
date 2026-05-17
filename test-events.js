const admin = require('firebase-admin');
require('dotenv').config({ path: '.env.local' });
const serviceAccount = require('./serviceAccountKey.json');
if (!admin.apps.length) {
  admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
}
const db = admin.firestore();

async function checkEvents() {
  console.log('Checking events collection...');
  try {
    const snapshot = await db.collection('events').get();
    console.log(`Total events: ${snapshot.size}`);
    
    snapshot.forEach(doc => {
      console.log(doc.id, doc.data().title, doc.data().status, doc.data().startDate);
    });

    const now = new Date().toISOString();
    console.log(`\nQuerying upcoming published events (>= ${now})...`);
    const qSnapshot = await db.collection('events')
      .where('status', '==', 'published')
      .where('startDate', '>=', now)
      .orderBy('startDate', 'asc')
      .get();
      
    console.log(`Upcoming published events: ${qSnapshot.size}`);
  } catch (err) {
    console.error('Error:', err.message);
  }
}
checkEvents();
