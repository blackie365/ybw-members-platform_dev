require('dotenv')?.config({ path: '.env.local' });
const admin = require('firebase-admin');
const path = require('path');
const fs = require('fs');
const fetch = require('node-fetch');

// Beehiiv Config
const BEEHIIV_API_KEY = process.env.BEEHIIV_API_KEY;
const BEEHIIV_PUBLICATION_ID = process.env.BEEHIIV_PUBLICATION_ID;
const BEEHIIV_API_URL = 'https://api.beehiiv.com/v2';

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
    }
} catch (e) {}

const db = admin?.firestore();

async function addRobToNewsletter() {
    const email = 'rob@topicuk.co.uk';
    console.log(`\n📧 Adding ${email} to Authorized Newsletter List...\n`);

    // 1. Update/Create in Firestore with the authorization flag
    const memberRef = db?.collection('newMemberCollection')?.doc('rob_test_user');
    await memberRef?.set({
        email: email,
        displayName: 'Rob Blackwell',
        firstName: 'Rob',
        lastName: 'Blackwell',
        isNewsletterAuthorized: true,
        status: 'active',
        membershipTier: 'premium',
        updatedAt: new Date()?.toISOString()
    }, { merge: true });

    console.log(`✅ Firestore updated with isNewsletterAuthorized: true`);

    // 2. Add directly to Beehiiv
    if (!BEEHIIV_API_KEY || !BEEHIIV_PUBLICATION_ID) {
        console.error('❌ Beehiiv credentials missing');
        return;
    }

    try {
        const response = await fetch(`${BEEHIIV_API_URL}/publications/${BEEHIIV_PUBLICATION_ID}/subscriptions`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${BEEHIIV_API_KEY}`
            },
            body: JSON.stringify({
                email: email,
                reactivate_existing: true,
                send_welcome_email: true,
                utm_source: 'manual-test-add',
                custom_fields: [
                    { name: 'first_name', value: 'Rob' },
                    { name: 'last_name', value: 'Blackwell' },
                    { name: 'is_test_user', value: 'true' }
                ]
            })
        });

        if (response?.ok) {
            console.log(`✅ Successfully added ${email} to Beehiiv!`);
            console.log(`📬 You should receive a welcome email shortly.`);
        } else {
            const err = await response?.json();
            console.error(`❌ Beehiiv error:`, err?.errors?.[0]?.message || response?.statusText);
        }
    } catch (error) {
        console.error(`❌ Sync error:`, error?.message);
    }
}

addRobToNewsletter()?.catch(console.error);
