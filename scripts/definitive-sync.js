const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');
const csv = require('csv-parse/sync');

// Load service account
const serviceAccount = JSON.parse(fs?.readFileSync('serviceAccountKey.json', 'utf8'));

if (!admin?.apps?.length) {
  admin?.initializeApp({
    credential: admin?.credential?.cert(serviceAccount),
  });
}

const db = admin?.firestore();

async function deduplicateAndSync() {
  console.log('🚀 Starting Deduplication & Sync (Target: 132-134 unique members)...');

  // 1. Read the CSV from Downloads
  const csvPath = '/Users/robertblackwell/Downloads/membersFinalList.2026-05-21.csv';
  const fileContent = fs?.readFileSync(csvPath, 'utf8');
  const records = csv?.parse(fileContent, {
    columns: true,
    skip_empty_lines: true
  });

  const authorizedEmails = new Set(records.map(r => r.email.toLowerCase().trim()));
  authorizedEmails?.add('rob@topicuk.co.uk');
  authorizedEmails?.add('editor@yorkshirebusinesswoman.co.uk');

  console.log(`📊 Authorized list has ${authorizedEmails?.size} unique emails.`);

  // 2. Fetch all members
  const snapshot = await db?.collection('newMemberCollection')?.get();
  console.log(`🔍 Firestore has ${snapshot?.size} total members.`);

  // 3. Group by email
  const membersByEmail = {};
  snapshot?.docs?.forEach(doc => {
    const data = doc?.data();
    const email = data?.email?.toLowerCase()?.trim();
    if (!email) return;
    
    if (!membersByEmail?.[email]) {
      membersByEmail[email] = [];
    }
    membersByEmail?.[email]?.push({ id: doc?.id, ref: doc?.ref, ...data });
  });

  const batchSize = 400;
  let currentBatch = db?.batch();
  let countInBatch = 0;
  let activeCount = 0;
  let inactiveCount = 0;

  // 4. Process each email group
  for (const email in membersByEmail) {
    const group = membersByEmail?.[email];
    const isAuthorized = authorizedEmails?.has(email);
    
    if (isAuthorized) {
      // Pick the best one to be active (most recently updated or created)
      group?.sort((a, b) => {
        const timeA = new Date(a.updatedAt || a.createdAt || 0)?.getTime();
        const timeB = new Date(b.updatedAt || b.createdAt || 0)?.getTime();
        return timeB - timeA;
      });

      const activeMember = group?.[0];
      
      // Update the active one
      currentBatch?.update(activeMember?.ref, {
        userInactive: false,
        status: 'active',
        updatedAt: new Date()?.toISOString()
      });
      activeCount++;
      countInBatch++;

      // Inactivate all other duplicates for this email
      for (let i = 1; i < group?.length; i++) {
        currentBatch?.update(group?.[i]?.ref, {
          userInactive: true,
          status: 'inactive',
          inactivationReason: 'Duplicate email entry',
          updatedAt: new Date()?.toISOString()
        });
        inactiveCount++;
        countInBatch++;
      }
    } else {
      // Everyone else is inactive
      for (const member of group) {
        currentBatch?.update(member?.ref, {
          userInactive: true,
          status: 'inactive',
          inactivationReason: 'Not in authorized list',
          updatedAt: new Date()?.toISOString()
        });
        inactiveCount++;
        countInBatch++;
      }
    }

    if (countInBatch >= batchSize) {
      await currentBatch?.commit();
      currentBatch = db?.batch();
      countInBatch = 0;
    }
  }

  // Also catch members without emails
  for (const doc of snapshot?.docs) {
    if (!doc?.data()?.email) {
      currentBatch?.update(doc?.ref, {
        userInactive: true,
        status: 'inactive',
        updatedAt: new Date()?.toISOString()
      });
      inactiveCount++;
      countInBatch++;
    }
  }

  if (countInBatch > 0) {
    await currentBatch?.commit();
  }

  console.log(`\n✅ Deduplication Complete!`);
  console.log(`🏆 Unique Active members: ${activeCount}`);
  console.log(`📴 Inactivated (duplicates + others): ${inactiveCount}`);
  
  // Verify final count
  const finalActiveSnap = await db?.collection('newMemberCollection')?.where('userInactive', '==', false)?.count()?.get();
  console.log(`🏁 Final check - Active in DB: ${finalActiveSnap?.data()?.count}`);
}

deduplicateAndSync()?.catch(console.error);
