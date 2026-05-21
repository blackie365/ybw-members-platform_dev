require('dotenv').config({ path: '.env.local' });
const admin = require('firebase-admin');
const path = require('path');
const fs = require('fs');

// Initialize Firebase Admin
try {
    const serviceAccountPath = path.join(process.cwd(), 'serviceAccountKey.json');
    if (fs.existsSync(serviceAccountPath)) {
        const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'));
        admin.initializeApp({
            credential: admin.credential.cert(serviceAccount),
        });
    }
} catch (e) {}

const db = admin.firestore();

async function dryRunSync() {
    console.log(`\n🧪 Starting Beehiiv Sync DRY RUN...\n`);

    const snapshot = await db.collection('newMemberCollection')
        .where('isNewsletterAuthorized', '==', true)
        .get();

    const authorized = snapshot.docs.map(doc => doc.data());

    console.log(`Total Members Authorized in Firestore: ${authorized.length}`);
    console.log(`\n--- Verification Summary (No API calls will be made) ---`);

    const missingFields = [];
    const valid = [];

    authorized.forEach(m => {
        if (!m.email) {
            missingFields.push(`❌ ${m.displayName || 'Unknown'}: Missing Email`);
        } else {
            valid.push(m);
        }
    });

    if (missingFields.length > 0) {
        console.log(`\n⚠️ Issues Found:`);
        missingFields.forEach(msg => console.log(msg));
    }

    console.log(`\n✅ ${valid.length} members are ready for Beehiiv sync.`);
    console.log(`\nPreview of data to be sent (First 5):`);
    valid.slice(0, 5).forEach(m => {
        console.log(`- ${m.displayName} <${m.email}> (Tier: ${m.membershipTier})`);
    });

    console.log(`\n⚠️ DRY RUN COMPLETE. No data was sent to Beehiiv.`);
}

dryRunSync().catch(console.error);
