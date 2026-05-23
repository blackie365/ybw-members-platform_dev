
import { adminDb } from '../src/lib/firebase-admin';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

async function findClerkAvatars() {
  const snapshot = await adminDb.collection('newMemberCollection')
    .where('userInactive', '==', false)
    .get();
    
  console.log(`Checking ${snapshot.size} members...`);
  
  const results = [];
  snapshot.docs.forEach(doc => {
    const data = doc.data();
    const avatar = data.avatarUrl || data.profileImage || data.image || '';
    if (avatar && (avatar.includes('clerk.com') || avatar.includes('gravatar.com'))) {
      results.push({
        name: data.displayName || data.name,
        email: data.email,
        url: avatar
      });
    }
  });
  
  console.log(`\n🚨 Found ${results.length} members with Clerk/Gravatar URLs:`);
  results.forEach(r => {
    console.log(`- ${r.name}: ${r.url}`);
  });
}

findClerkAvatars().catch(console.error);
