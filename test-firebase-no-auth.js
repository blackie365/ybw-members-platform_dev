const admin = require('firebase-admin');

admin.initializeApp({
  projectId: 'newmembersdirectory130325',
});

const { getFirestore } = require('firebase-admin/firestore');

async function test() {
  try {
    const db = getFirestore(admin.app(), 'ybm-db20032026');
    const snapshot = await db.collection('newMemberCollection').limit(1).get();
    console.log('Successfully fetched from ybm-db20032026:', snapshot.docs.length);
  } catch (e) {
    console.error('Error fetching from ybm-db20032026:', e.message);
  }
}

test();