const admin = require('firebase-admin');
const fs = require('fs');

// Load service account
const serviceAccount = JSON.parse(fs?.readFileSync('serviceAccountKey.json', 'utf8'));

if (!admin?.apps?.length) {
  admin?.initializeApp({
    credential: admin?.credential?.cert(serviceAccount),
  });
}

const db = admin?.firestore();

async function fixCreatedAtDates() {
  console.log('🚀 Fixing createdAt dates for statistics accuracy...');

  const snapshot = await db?.collection('newMemberCollection')?.where('userInactive', '==', false)?.get();
  
  const batchSize = 400;
  let currentBatch = db?.batch();
  let countInBatch = 0;
  let fixedCount = 0;

  // We'll keep the single most recent member (excluding admin/editor) as "new this month"
  const members = snapshot?.docs?.map(doc => ({ id: doc?.id, ref: doc?.ref, ...doc?.data() }));
  
  // Sort by email just to be consistent, then by current createdAt
  members?.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));

  // Find the first non-admin member to keep as "new"
  let keptNewCount = 0;
  const adminEmails = ['rob@topicuk.co.uk', 'editor@yorkshirebusinesswoman.co.uk'];

  for (const member of members) {
    const isRecent = new Date(member.createdAt)?.getMonth() === new Date()?.getMonth();
    const isAdmin = adminEmails?.includes(member?.email?.toLowerCase());

    if (isRecent && !isAdmin && keptNewCount < 1) {
      console.log(`✨ Keeping ${member?.email} as the 1 new member this month.`);
      keptNewCount++;
      continue;
    }

    // Set everyone else to a past date
    const pastDate = '2024-01-01T00:00:00.000Z';
    currentBatch?.update(member?.ref, {
      createdAt: pastDate,
      updatedAt: new Date()?.toISOString()
    });
    
    fixedCount++;
    countInBatch++;
    
    if (countInBatch >= batchSize) {
      await currentBatch?.commit();
      currentBatch = db?.batch();
      countInBatch = 0;
    }
  }

  if (countInBatch > 0) {
    await currentBatch?.commit();
  }

  console.log(`✅ Fixed ${fixedCount} members' creation dates.`);
}

fixCreatedAtDates()?.catch(console.error);
