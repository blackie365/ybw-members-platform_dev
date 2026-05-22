
import { adminDb } from '../src/lib/firebase-admin';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

async function checkMemberHealth() {
  console.log('🔍 Checking member profile health...');
  
  const snapshot = await adminDb.collection('newMemberCollection')
    .where('userInactive', '==', false)
    .get();
    
  console.log(`Found ${snapshot.size} active members.`);
  
  const results = {
    total: snapshot.size,
    missingBio: [] as string[],
    missingAvatar: [] as string[],
    externalAvatar: [] as string[], // Avatars not hosted on Firebase Storage
    storageAvatar: [] as string[],  // Avatars hosted on Firebase Storage
    details: [] as any[]
  };
  
  snapshot.docs.forEach(doc => {
    const data = doc.data();
    const name = data.name || data.displayName || 'Unknown';
    const email = data.email || 'No Email';
    const bio = data.bio || '';
    const avatarUrl = data.avatarUrl || '';
    
    const isStorage = avatarUrl.includes('firebasestorage.googleapis.com') || avatarUrl.includes('storage.googleapis.com');
    
    if (!bio || bio.length < 10) results.missingBio.push(name);
    if (!avatarUrl) results.missingAvatar.push(name);
    else if (!isStorage) results.externalAvatar.push(`${name} (${avatarUrl})`);
    else results.storageAvatar.push(name);
    
    results.details.push({
      name,
      email,
      hasBio: !!bio && bio.length >= 10,
      hasAvatar: !!avatarUrl,
      isStorage,
      avatarUrl
    });
  });
  
  console.log(`\n📊 Health Summary:`);
  console.log(`- Missing Bio: ${results.missingBio.length}`);
  console.log(`- Missing Avatar: ${results.missingAvatar.length}`);
  console.log(`- External Avatar (needs migration): ${results.externalAvatar.length}`);
  console.log(`- Storage Avatar (migrated): ${results.storageAvatar.length}`);
  
  fs.writeFileSync('member-health-report.json', JSON.stringify(results, null, 2));
  console.log('\n✅ Report saved to member-health-report.json');
}

checkMemberHealth().catch(console.error);
