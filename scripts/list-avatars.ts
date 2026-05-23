
import { adminDb } from '../src/lib/firebase-admin';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

async function listAllAvatarUrls() {
  const snapshot = await adminDb.collection('newMemberCollection')
    .where('userInactive', '==', false)
    .get();
    
  console.log(`Active members: ${snapshot.size}`);
  
  snapshot.docs.forEach(doc => {
    const data = doc.data();
    const avatar = data.avatarUrl || data.profileImage || data.image || 'NONE';
    if (avatar !== 'NONE') {
      console.log(`- ${data.displayName || data.name}: ${avatar}`);
    }
  });
}

listAllAvatarUrls().catch(console.error);
