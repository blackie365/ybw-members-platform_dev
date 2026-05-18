import { adminDb } from '../src/lib/firebase-admin';
import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const CSV_PATH = path.join(__dirname, '../../v0-membership-app-for-ybw/active_members_recent.csv');

async function syncNewsletterRecipients() {
  console.log('Starting newsletter recipient synchronization...');
  
  if (!fs.existsSync(CSV_PATH)) {
    console.error(`CSV file not found at ${CSV_PATH}`);
    return;
  }

  if (!adminDb) {
    console.error('Firebase Admin not initialized');
    return;
  }

  const content = fs.readFileSync(CSV_PATH, 'utf8');
  const lines = content.split('\n').filter(line => line.trim() !== '');
  
  // Extract unique emails from CSV
  const activeEmails = new Set(
    lines.slice(1).map(line => {
      const parts = line.split('","').map(p => p.replace(/"/g, '').trim());
      return parts[0].toLowerCase();
    }).filter(email => !!email)
  );

  console.log(`Found ${activeEmails.size} unique active emails from Stripe CSV.`);

  const membersRef = adminDb.collection('newMemberCollection');

  // 1. Unset the flag for EVERYONE first (to ensure only these 88 have it)
  console.log('Resetting newsletter flags for all existing records...');
  const allWithFlag = await membersRef.where('isNewsletterRecipient', '==', true).get();
  const resetBatch = adminDb.batch();
  allWithFlag.docs.forEach(doc => {
    resetBatch.update(doc.ref, { isNewsletterRecipient: false });
  });
  if (allWithFlag.size > 0) {
    await resetBatch.commit();
    console.log(`Reset flags for ${allWithFlag.size} records.`);
  }

  // 2. Set the flag for our 88 members
  console.log('Setting source-of-truth flag for active members...');
  let updatedCount = 0;
  let createdCount = 0;

  for (const email of activeEmails) {
    const querySnapshot = await membersRef.where('email', '==', email).limit(1).get();
    
    if (!querySnapshot.empty) {
      // Update existing
      await querySnapshot.docs[0].ref.update({
        isNewsletterRecipient: true,
        newsletterSubscribed: true,
        status: 'active'
      });
      updatedCount++;
    } else {
      // Create lightweight record
      await membersRef.add({
        email: email,
        isNewsletterRecipient: true,
        newsletterSubscribed: true,
        status: 'active',
        membershipTier: 'Active Member',
        createdAt: new Date().toISOString()
      });
      createdCount++;
    }
  }

  console.log(`\nSync complete:`);
  console.log(`- Updated: ${updatedCount} existing members`);
  console.log(`- Created: ${createdCount} new member records`);
  console.log(`- Total recipients now flagged: ${updatedCount + createdCount}`);
}

syncNewsletterRecipients().catch(console.error);
