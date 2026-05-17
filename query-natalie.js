const admin = require('firebase-admin');
const serviceAccount = require('./serviceAccountKey.json');

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}

async function run() {
  const db = admin.firestore();
  const snapshot = await db.collection('newMemberCollection')
    .where('email', '==', 'natalie@simononthestreets.co.uk')
    .get();
    
  snapshot.forEach(doc => {
    console.log(doc.id, doc.data());
  });
}
run();
