
import { adminDb } from '../src/lib/firebase-admin';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

async function listLocations() {
  const snapshot = await adminDb.collection('newMemberCollection')
    .where('userInactive', '==', false)
    .get();
    
  const locations = new Set();
  snapshot.docs.forEach(doc => {
    const data = doc.data();
    if (data.location) locations.add(data.location);
  });
  
  console.log('📍 Current Normalized Locations:');
  console.log(Array.from(locations).sort());
}

listLocations().catch(console.error);
