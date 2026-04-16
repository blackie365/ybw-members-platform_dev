const { initializeApp } = require('firebase/app');
const { getFirestore, collection, getDocs } = require('firebase/firestore');
require('dotenv').config({ path: '.env.local' });

const app = initializeApp({
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
});
const db = getFirestore(app);

async function run() {
  const users = await getDocs(collection(db, 'users'));
  console.log('users count:', users.size);
  const members = await getDocs(collection(db, 'members'));
  console.log('members count:', members.size);
  process.exit(0);
}
run().catch(console.error);
