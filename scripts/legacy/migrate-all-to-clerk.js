const admin = require('firebase-admin');
const axios = require('axios');
const fs = require('fs');
const path = require('path');

// Load env vars
require('dotenv')?.config({ path: '.env.local' });

const CLERK_SECRET_KEY = process.env.CLERK_SECRET_KEY;
if (!CLERK_SECRET_KEY) {
  console.error('CLERK_SECRET_KEY not found in .env.local');
  process.exit(1);
}

// Initialize Firebase Admin
try {
  const serviceAccountPath = path?.join(process.cwd(), 'serviceAccountKey.json');
  if (fs?.existsSync(serviceAccountPath)) {
    const serviceAccount = JSON.parse(fs?.readFileSync(serviceAccountPath, 'utf8'));
    if (!admin?.apps?.length) {
      admin?.initializeApp({
        credential: admin?.credential?.cert(serviceAccount),
      });
    }
  } else {
    console.error('serviceAccountKey.json not found');
    process.exit(1);
  }
} catch (e) {
  console.error('Error initializing Firebase:', e?.message);
  process.exit(1);
}

const db = admin?.firestore();

async function migrateAllToClerk() {
  console.log('🚀 Starting full migration from Firestore to Clerk Production...');

  // 1. Fetch all members from Firestore
  const snapshot = await db?.collection('newMemberCollection')?.get();
  const members = snapshot?.docs?.map(doc => ({ id: doc?.id, ...doc?.data() }));
  console.log(`📊 Found ${members?.length} members in Firestore.`);

  // 2. Clean up Clerk (EXCEPT ADMIN)
  console.log('\n--- Cleaning up existing Clerk users (keeping rob@topicuk.co.uk) ---');
  try {
    let hasMore = true;
    while (hasMore) {
      const listResponse = await axios?.get('https://api.clerk.com/v1/users?limit=100', {
        headers: { 'Authorization': `Bearer ${CLERK_SECRET_KEY}` }
      });
      
      const users = listResponse?.data;
      if (users?.length === 0) {
        hasMore = false;
        break;
      }

      for (const user of users) {
        const email = user?.email_addresses?.[0]?.email_address;
        if (email === 'rob@topicuk.co.uk') {
          console.log(`Skipping admin: ${email}`);
          continue;
        }

        try {
          await axios?.delete(`https://api.clerk.com/v1/users/${user?.id}`, {
            headers: { 'Authorization': `Bearer ${CLERK_SECRET_KEY}` }
          });
          console.log(`Deleted: ${email}`);
        } catch (e) {
          console.error(`Failed to delete ${email}: ${e?.message}`);
        }
      }
      
      if (users?.length < 100) hasMore = false;
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    console.log('Cleanup complete.');
  } catch (error) {
    console.error('Error during cleanup:', error?.message);
  }

  // 3. Import all members
  console.log(`\n--- Importing ${members?.length} members to Clerk ---`);
  let successCount = 0;
  let skipCount = 0;

  for (const member of members) {
    const email = member?.email?.toLowerCase()?.trim();
    if (!email) {
      console.log('Skipping member without email');
      skipCount++;
      continue;
    }

    if (email === 'rob@topicuk.co.uk') {
      console.log(`Skipping admin import (should already exist): ${email}`);
      skipCount++;
      continue;
    }

    console.log(`Importing: ${email}...`);
    try {
      await axios?.post('https://api.clerk.com/v1/users', {
        email_address: [email],
        first_name: member?.firstName || '',
        last_name: member?.lastName || '',
        public_metadata: {
          firestoreId: member?.id,
          membershipTier: member?.membershipTier || 'free',
          isPremium: member?.membershipTier && member?.membershipTier !== 'free' ? true : false
        },
        skip_password_requirement: true,
        skip_password_checks: true,
      }, {
        headers: {
          'Authorization': `Bearer ${CLERK_SECRET_KEY}`,
          'Content-Type': 'application/json'
        }
      });
      console.log(`✅ Success: ${email}`);
      successCount++;
    } catch (error) {
      const errMsg = error?.response?.data?.errors?.[0]?.message || error?.message;
      if (errMsg?.includes('already exists')) {
        console.log(`ℹ️ Already exists: ${email}`);
        successCount++;
      } else {
        console.error(`❌ Error for ${email}:`, errMsg);
      }
    }
    // Rate limiting prevention
    await new Promise(resolve => setTimeout(resolve, 200));
  }

  console.log(`\nMigration complete.`);
  console.log(`Total members processed: ${members?.length}`);
  console.log(`Successfully imported/verified: ${successCount}`);
  console.log(`Skipped: ${skipCount}`);
}

migrateAllToClerk()?.catch(console.error);
