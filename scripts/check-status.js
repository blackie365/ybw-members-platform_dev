require('dotenv')?.config({ path: '.env.local' });
const admin = require('firebase-admin');
const path = require('path');
const fs = require('fs');

// Initialize Firebase Admin
try {
    const serviceAccountPath = path?.join(process.cwd(), 'serviceAccountKey.json');
    if (fs?.existsSync(serviceAccountPath)) {
        const serviceAccount = JSON.parse(fs?.readFileSync(serviceAccountPath, 'utf8'));
        admin?.initializeApp({
            credential: admin?.credential?.cert(serviceAccount),
        });
    } else {
        throw new Error('serviceAccountKey.json not found');
    }
} catch (e) {
    console.error('❌ Failed to initialize Firebase Admin:', e?.message);
    process.exit(1);
}

const db = admin?.firestore();

async function checkStatusDistribution() {
    const snapshot = await db?.collection('newMemberCollection')?.get();
    const distribution = {};
    
    snapshot?.docs?.forEach(doc => {
        const data = doc?.data();
        const status = data?.status || 'undefined';
        distribution[status] = (distribution?.[status] || 0) + 1;
    });

    console.log('\n📊 Status Distribution:');
    console.log(JSON.stringify(distribution, null, 2));
    
    // Also check membershipTier
    const tierDistribution = {};
    snapshot?.docs?.forEach(doc => {
        const data = doc?.data();
        const tier = data?.membershipTier || 'undefined';
        tierDistribution[tier] = (tierDistribution?.[tier] || 0) + 1;
    });
    console.log('\n📊 Tier Distribution:');
    console.log(JSON.stringify(tierDistribution, null, 2));

    // Check combined status/tier
    const combined = {};
    snapshot?.docs?.forEach(doc => {
        const data = doc?.data();
        const key = `${data?.status || 'no-status'}_${data?.membershipTier || 'no-tier'}`;
        combined[key] = (combined?.[key] || 0) + 1;
    });
    console.log('\n📊 Combined Distribution:');
    console.log(JSON.stringify(combined, null, 2));
}

checkStatusDistribution()?.catch(console.error);
