const admin = require('firebase-admin');
const fs = require('fs');

const serviceAccount = require('../serviceAccountKey.json');

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
}

const auth = admin.auth();
const db = admin.firestore();

// Helper to escape CSV strings
function escapeCsv(str) {
  if (str === null || str === undefined) return '';
  const stringified = String(str);
  if (stringified.includes(',') || stringified.includes('"') || stringified.includes('\n')) {
    return `"${stringified.replace(/"/g, '""')}"`;
  }
  return stringified;
}

async function generateLinks() {
  try {
    console.log('Fetching all users from newMemberCollection...');
    const snapshot = await db.collection('newMemberCollection').get();
    
    let csvContent = 'FirstName,LastName,Email,ResetLink\n';
    let count = 0;
    
    for (const doc of snapshot.docs) {
      const data = doc.data();
      const email = data.email;
      
      if (!email) {
        console.warn(`No email found for document ${doc.id}`);
        continue;
      }
      
      try {
        const rawLink = await auth.generatePasswordResetLink(email);
        
        // Convert the default Firebase action link to our custom Next.js auth/action route
        // This keeps the user on the corporate domain and bypasses the allowlist issue
        const customLink = rawLink.replace(
          /https:\/\/[^/]+\/__\/auth\/action/,
          'https://www.yorkshirebusinesswoman.co.uk/auth/action'
        );
        
        csvContent += `${escapeCsv(data.firstName)},${escapeCsv(data.lastName)},${escapeCsv(email)},${escapeCsv(customLink)}\n`;
        count++;
        console.log(`Generated link for ${email}`);
      } catch (err) {
        console.error(`Failed to generate link for ${email}:`, err.message);
      }
    }
    
    if (count > 0) {
      fs.writeFileSync('members-with-links.csv', csvContent);
      console.log(`\nSuccess! Wrote ${count} records to members-with-links.csv`);
    } else {
      console.log('\nNo records processed.');
    }
    
  } catch (err) {
    console.error('Script failed:', err);
  }
}

generateLinks();
