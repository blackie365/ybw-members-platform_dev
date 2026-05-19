import { adminDb } from '../src/lib/firebase-admin';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

async function getCancelledMembers() {
  console.log('Fetching cancelled/inactive members from Firestore...');
  
  try {
    if (!adminDb) {
      console.error('Firestore admin instance not initialized.');
      return;
    }

    const membersSnapshot = await adminDb.collection('newMemberCollection')
      .where('status', 'in', ['canceled', 'cancelled', 'inactive', 'expired'])
      .get();

    console.log(`Found ${membersSnapshot.size} members with cancelled/inactive status.`);
    
    const members = membersSnapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        email: data.email,
        name: data.displayName || `${data.firstName || ''} ${data.lastName || ''}`.trim(),
        status: data.status,
        membershipTier: data.membershipTier
      };
    });

    if (members.length > 0) {
      console.table(members);
      console.log('\nEmails of cancelled members:');
      console.log(members.map(m => m.email).join(', '));
    } else {
      console.log('No members found with cancelled/inactive status.');
    }

  } catch (error) {
    console.error('Error fetching members:', error);
  }
}

getCancelledMembers();
