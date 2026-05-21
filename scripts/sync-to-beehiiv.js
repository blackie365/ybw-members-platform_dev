/**
 * Beehiiv Migration Script
 * 
 * This script exports all active newsletter recipients from Firestore to Beehiiv.
 */

require('dotenv').config({ path: '.env.local' });
const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');
const fetch = require('node-fetch'); // Ensure you have node-fetch or use native fetch if on Node 18+

// Beehiiv Config
const BEEHIIV_API_KEY = process.env.BEEHIIV_API_KEY;
const BEEHIIV_PUBLICATION_ID = process.env.BEEHIIV_PUBLICATION_ID;
const BEEHIIV_API_URL = 'https://api.beehiiv.com/v2';

// Initialize Firebase Admin
try {
    const serviceAccountPath = path.join(process.cwd(), 'serviceAccountKey.json');
    if (fs.existsSync(serviceAccountPath)) {
        const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'));
        admin.initializeApp({
            credential: admin.credential.cert(serviceAccount),
        });
        console.log('✅ Loaded credentials from serviceAccountKey.json');
    } else {
        throw new Error('serviceAccountKey.json not found');
    }
} catch (e) {
    console.error('❌ Failed to initialize Firebase Admin:', e.message);
    process.exit(1);
}

const db = admin.firestore();

async function syncToBeehiiv() {
    if (!BEEHIIV_API_KEY || !BEEHIIV_PUBLICATION_ID) {
        console.error('❌ BEEHIIV_API_KEY or BEEHIIV_PUBLICATION_ID missing in .env.local');
        return;
    }

    console.log(`\n🐝 Starting Beehiiv Sync (STRICT 88 Authorized Members Only)...`);

    const snapshot = await db.collection('newMemberCollection')
        .where('isNewsletterAuthorized', '==', true)
        .get();

    const validSubscribers = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

    console.log(`Found ${validSubscribers.length} members flagged as isNewsletterAuthorized in Firestore.`);

    if (validSubscribers.length === 0) {
        console.log('⚠️ No authorized members found. Please run scripts/isolate-88.js first.');
        return;
    }

    let successCount = 0;
    let failCount = 0;

    for (const m of validSubscribers) {
        const email = m.email;

        if (!email) continue;

        try {
            const response = await fetch(`${BEEHIIV_API_URL}/publications/${BEEHIIV_PUBLICATION_ID}/subscriptions`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${BEEHIIV_API_KEY}`
                },
                body: JSON.stringify({
                    email,
                    reactivate_existing: true,
                    send_welcome_email: false, // Don't spam them during migration
                    utm_source: 'firestore-migration',
                    custom_fields: [
                        { name: 'first_name', value: m.firstName || '' },
                        { name: 'last_name', value: m.lastName || '' },
                        { name: 'industry', value: m.industrySector || '' },
                        { name: 'membership_tier', value: m.membershipTier || 'free' }
                    ]
                })
            });

            if (response.ok) {
                successCount++;
                process.stdout.write('.');
                await doc.ref.update({ beehiivSync: true });
            } else {
                const err = await response.json();
                console.error(`\n❌ Failed for ${email}:`, err.errors?.[0]?.message || response.statusText);
                failCount++;
            }
        } catch (error) {
            console.error(`\n❌ Error for ${email}:`, error.message);
            failCount++;
        }

        // Rate limiting protection
        await new Promise(resolve => setTimeout(resolve, 150));
    }

    console.log(`\n\n✅ Sync complete!`);
    console.log(`Success: ${successCount}`);
    console.log(`Failed: ${failCount}`);
}

syncToBeehiiv().catch(console.error);
