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
        console.log('✅ Loaded credentials from serviceAccountKey.json');
    } else {
        console.error('❌ serviceAccountKey.json not found');
        process.exit(1);
    }
} catch (e) {
    console.error('❌ Initialization error:', e?.message);
    process.exit(1);
}

const db = admin?.firestore();

async function checkMissingActiveMembers() {
    const snapshot = await db?.collection('newMemberCollection')?.get();
    
    console.log(`\n🔍 Checking for missing active members...\n`);

    const potentiallyActive = [];

    snapshot?.docs?.forEach(doc => {
        const data = doc?.data();
        const tier = (data?.membershipTier || '')?.toLowerCase();
        
        // If it's NOT premium/founder, but looks active
        if (tier !== 'premium' && tier !== 'founder') {
            const isPaid = data?.status === 'paid' || data?.['Member status'] === 'paid' || data?.isPremium === true;
            const hasActiveFlag = data?.Active === 'true' || data?.Active === true;
            
            if (isPaid || hasActiveFlag) {
                potentiallyActive?.push({
                    id: doc?.id,
                    name: data?.displayName || `${data?.firstName || ''} ${data?.lastName || ''}`?.trim(),
                    tier: data?.membershipTier,
                    status: data?.status,
                    isPremium: data?.isPremium,
                    activeFlag: data?.Active
                });
            }
        }
    });

    console.log(`✅ Found ${potentiallyActive?.length} potentially active members NOT in Premium/Founder tier.`);
    potentiallyActive?.forEach(p => {
        console.log(`- ${p?.name}: Tier=${p?.tier}, Status=${p?.status}, isPremium=${p?.isPremium}, Active=${p?.activeFlag}`);
    });
}

checkMissingActiveMembers()?.catch(console.error);
