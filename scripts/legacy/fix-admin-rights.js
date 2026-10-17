const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');

// Load env vars
require('dotenv')?.config({ path: '.env.local' });

if (!admin?.apps?.length) {
  const serviceAccountPath = path?.join(__dirname, '../serviceAccountKey.json');
  if (fs?.existsSync(serviceAccountPath)) {
    const serviceAccount = require(serviceAccountPath);
    admin?.initializeApp({
      credential: admin?.credential?.cert(serviceAccount)
    });
  } else {
    console.error('ERROR: Firebase Admin credentials not found at:', serviceAccountPath);
    process.exit(1);
  }
}

const db = admin?.firestore();
const adminEmails = ['rob@topicuk.co.uk', 'rob@ghost-communications.com'];

async function fixAdminRights() {
  console.log('--- Checking Admin Rights in Firestore ---');
  
  for (const email of adminEmails) {
    console.log(`\nChecking: ${email}`);
    try {
      const membersRef = db?.collection('newMemberCollection');
      const snapshot = await membersRef?.where('email', '==', email)?.get();
      
      if (snapshot?.empty) {
        console.log(`❌ No Firestore profile found for ${email}`);
        continue;
      }

      for (const doc of snapshot?.docs) {
        const data = doc?.data();
        console.log(`Current Role: ${data?.role}, isAdmin: ${data?.isAdmin}`);
        
        if (data?.role !== 'super_admin' || data?.isAdmin !== true) {
          await membersRef?.doc(doc?.id)?.update({
            role: 'super_admin',
            isAdmin: true,
            updatedAt: new Date()?.toISOString()
          });
          console.log(`✅ Fixed! Updated ${email} to super_admin and isAdmin: true`);
        } else {
          console.log(`✨ ${email} already has full admin rights.`);
        }
      }
    } catch (error) {
      console.error(`Error processing ${email}:`, error?.message);
    }
  }
  console.log('\nDone.');
  process.exit(0);
}

fixAdminRights();
