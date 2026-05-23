
import { adminDb } from '../src/lib/firebase-admin';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

async function findGenericAvatars() {
  console.log('🔍 Searching for generic/Clerk avatars...');
  
  const snapshot = await adminDb.collection('newMemberCollection')
    .where('userInactive', '==', false)
    .get();
    
  console.log(`Checking ${snapshot.size} active members...`);
  
  const genericPatterns = [
    'clerk.com',
    'gravatar.com',
    'img-s-msn-com',
    'default-avatar',
    'placeholder'
  ];

  const results = [];

  for (const doc of snapshot.docs) {
    const data = doc.data();
    const name = data.displayName || data.name || 'Unknown';
    const avatarUrl = data.avatarUrl || data.profileImage || data.image || '';
    
    if (avatarUrl && typeof avatarUrl === 'string') {
      const isGeneric = genericPatterns.some(p => avatarUrl.toLowerCase().includes(p));
      
      if (isGeneric) {
        results.push({
          id: doc.id,
          name,
          email: data.email,
          url: avatarUrl
        });
      }
    }
  }
  
  console.log(`\n🚨 Found ${results.length} generic avatars:`);
  results.forEach(r => {
    console.log(`- ${r.name} (${r.email}): ${r.url}`);
  });
  
  return results;
}

findGenericAvatars().catch(console.error);
