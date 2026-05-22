
import { adminDb } from '../src/lib/firebase-admin';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

async function inspectAlison() {
  const email = 'alison.beardsell@pfgl.co.uk';
  const snapshot = await adminDb.collection('newMemberCollection')
    .where('email', '==', email)
    .get();
    
  if (snapshot.empty) {
    console.log(`No member found for ${email}`);
    return;
  }
  
  console.log(`Found ${snapshot.size} records for ${email}:`);
  snapshot.docs.forEach(doc => {
    console.log(`\n--- Doc ID: ${doc.id} ---`);
    console.log(JSON.stringify(doc.data(), null, 2));
  });
}

inspectAlison().catch(console.error);
