const fs = require('fs');
const csv = require('csv-parser');
const admin = require('firebase-admin');
const path = require('path');

// Load env vars
require('dotenv')?.config({ path: '.env.local' });

if (!admin?.apps?.length) {
  // Use absolute path for reliability
  const serviceAccountPath = path?.join(process.cwd(), 'serviceAccountKey.json');
  if (fs?.existsSync(serviceAccountPath)) {
    const serviceAccount = require(serviceAccountPath);
    admin?.initializeApp({
      credential: admin?.credential?.cert(serviceAccount)
    });
    console.log('Firebase Admin initialized successfully.');
  } else {
    console.error('ERROR: Firebase Admin credentials not found at:', serviceAccountPath);
    process.exit(1);
  }
}

const db = admin?.firestore();
const csvFilePath = 'active_members_recent.csv';
const results = [];

fs?.createReadStream(csvFilePath)?.pipe(csv({
    mapHeaders: ({ header }) => header?.trim()
  }))?.on('data', (data) => results?.push(data))?.on('end', async () => {
    console.log(`Found ${results?.length} members in CSV.`);
    
    let updatedCount = 0;
    let skipCount = 0;

    for (const row of results) {
      const email = row?.Email;
      const stripeSubscriptionId = row?.['Subscription ID'];
      const stripeCustomerId = row?.['Customer ID'];
      
      if (!email) continue;

      try {
        const membersRef = db?.collection('newMemberCollection');
        const snapshot = await membersRef?.where('email', '==', email)?.get();
        
        if (snapshot?.empty) {
          // console.log(`User ${email} not found in Firestore.`);
          skipCount++;
          continue;
        }

        const uid = snapshot?.docs?.[0]?.id;
        await membersRef?.doc(uid)?.set({
          stripeSubscriptionId,
          stripeCustomerId,
          subscriptionStatus: 'active',
          membershipTier: 'premium',
          status: 'active',
          updatedAt: new Date()?.toISOString()
        }, { merge: true });

        console.log(`✅ Updated: ${email}`);
        updatedCount++;
      } catch (error) {
        console.error(`❌ Error for ${email}:`, error?.message);
      }
    }
    console.log(`\nSync completed: ${updatedCount} updated, ${skipCount} not found in Firestore.`);
    process.exit(0);
  });
