
import { adminDb } from '../src/lib/firebase-admin';
import dotenv from 'dotenv';

dotenv?.config({ path: '.env.local' });

async function inspectAlison() {
  const email = 'alison.beardsell@pfgl.co.uk';
  const snapshot = await adminDb?.collection('newMemberCollection')?.where('email', '==', email)?.get();
    
  if (snapshot?.empty) {
    console.log(`No member found for ${email}`);
    return;
  }
  
  console.log(`Found ${snapshot?.size} records for ${email}:`);
  snapshot?.docs?.forEach(doc => {
    console.log(`\n--- Doc ID: ${doc?.id} ---`);
    const data = doc?.data();
    console.log(JSON.stringify(data, null, 2));
    
    // Simulate getMembers logic
    const avatarUrl = data?.avatarUrl || "";
    const profileImage = data?.profileImage || "";
    const image = [avatarUrl, profileImage, data?.image]?.find(url => 
      url && typeof url === 'string' && (url?.includes('storage.googleapis.com') || url?.includes('firebasestorage.app'))
    ) || [avatarUrl, profileImage, data?.image]?.find(url => 
      url && typeof url === 'string' && url?.startsWith('http') && !url?.includes('gravatar.com/avatar')
    ) || avatarUrl || profileImage;
    
    console.log('\n--- Simulated getMembers Logic ---');
    console.log('Resulting image URL:', image);
  });
}

inspectAlison()?.catch(console.error);
