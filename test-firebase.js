const admin = require('firebase-admin');
const fs = require('fs');

const serviceAccount = JSON.parse(fs.readFileSync('/Users/robertblackwell/Downloads/newmembersdirectory130325-firebase-adminsdk-fbsvc-c49e8b157e.json', 'utf8'));

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const { getFirestore } = require('firebase-admin/firestore');

async function test() {
  try {
    const db = getFirestore(admin.app(), '(default)');
    const snapshot = await db.collection('newMemberCollection').limit(1).get();
    console.log('Successfully fetched from newmembersdirectory130325 (default):', snapshot.docs.length);
  } catch (e) {
    console.error('Error fetching:', e.message);
  }
}

test();