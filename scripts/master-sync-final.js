/**
 * Master Sync Script
 * 
 * Aligns Firestore with membersFinalList.2026-05-21.csv
 * - Categorizes into: free, complimentary, paid (monthly/annual)
 * - Marks non-list members as userInactive: true
 * - Cleans names and applies schema
 */

require('dotenv').config({ path: '.env.local' });
const admin = require('firebase-admin');
const path = require('path');
const fs = require('fs');
const csv = require('csv-parse/sync');
const Stripe = require('stripe');

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

// Initialize Firebase Admin
try {
    const serviceAccountPath = path.join(process.cwd(), 'serviceAccountKey.json');
    if (fs.existsSync(serviceAccountPath)) {
        const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'));
        if (!admin.apps.length) {
            admin.initializeApp({
                credential: admin.credential.cert(serviceAccount),
            });
        }
    }
} catch (e) {}

const db = admin.firestore();

// Name cleaning helper
function toTitleCase(str) {
    if (!str) return '';
    return str.toLowerCase().split(/([\s\-])/).map(part => {
        if (part === ' ' || part === '-') return part;
        return part.charAt(0).toUpperCase() + part.slice(1);
    }).join('');
}

function cleanName(name) {
    if (!name) return '';
    let cleaned = name.replace(/^(mr|mrs|ms|miss|dr|prof|sir|lady|rev)\.?\s+/gi, '');
    cleaned = cleaned.trim();
    return toTitleCase(cleaned);
}

async function masterSync() {
    console.log(`\n🚀 Starting Master Sync from Final Source of Truth...\n`);

    // 1. Read the CSV
    const csvPath = path.join(process.cwd(), 'membersFinalList.2026-05-21.csv');
    const fileContent = fs.readFileSync(csvPath, 'utf8');
    const records = csv.parse(fileContent, {
        columns: true,
        skip_empty_lines: true
    });

    console.log(`📊 Found ${records.length} members in the Final List CSV.`);

    // 2. Fetch all current Firestore members
    const snapshot = await db.collection('newMemberCollection').get();
    const firestoreMembers = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    const authorizedEmails = new Set(records.map(r => r.email.toLowerCase().trim()));

    let updatedCount = 0;
    let inactivatedCount = 0;

    // 3. Process the Final List
    for (const record of records) {
        const email = record.email.toLowerCase().trim();
        const originalName = record.name || '';
        const cleanedDisplayName = cleanName(originalName);
        const nameParts = cleanedDisplayName.split(' ');
        const firstName = nameParts[0] || '';
        const lastName = nameParts.slice(1).join(' ') || '';

        // Determine Tier
        let tier = 'free';
        let billingInterval = null;

        if (record.complimentary_plan === 'true' || record.note?.toLowerCase().includes('complimentary') || record.note?.toLowerCase().includes('free')) {
            tier = 'complimentary';
        } else if (record.stripe_customer_id) {
            // Default to paid_monthly, then refine
            tier = 'paid_monthly';
            
            // Try to get billing interval from Stripe if key is present
            if (process.env.STRIPE_SECRET_KEY) {
                try {
                    const subscriptions = await stripe.subscriptions.list({
                        customer: record.stripe_customer_id,
                        status: 'active',
                        limit: 1
                    });
                    if (subscriptions.data.length > 0) {
                        billingInterval = subscriptions.data[0].items.data[0].plan.interval; // 'month' or 'year'
                    }
                } catch (e) {
                    console.log(`⚠️ Could not fetch Stripe data for ${email}: ${e.message}`);
                }
            }
            
            // Fallback interval check from notes
            if (!billingInterval) {
                if (record.note?.toLowerCase().includes('annual') || record.note?.toLowerCase().includes('year')) {
                    billingInterval = 'year';
                } else if (record.note?.toLowerCase().includes('monthly')) {
                    billingInterval = 'month';
                }
            }

            if (billingInterval === 'year') {
                tier = 'paid_annual';
            } else if (billingInterval === 'month') {
                tier = 'paid_monthly';
            }
        }

        // Find or Create member in Firestore
        const existing = firestoreMembers.find(m => m.email?.toLowerCase() === email);
        const memberRef = existing ? db.collection('newMemberCollection').doc(existing.id) : db.collection('newMemberCollection').doc();

        await memberRef.set({
            email,
            displayName: cleanedDisplayName,
            firstName,
            lastName,
            membershipTier: tier,
            billingInterval: billingInterval || (tier.startsWith('paid_') ? (tier === 'paid_annual' ? 'year' : 'month') : 'none'),
            stripeCustomerId: record.stripe_customer_id || null,
            isNewsletterAuthorized: true,
            userInactive: false,
            status: 'active',
            updatedAt: new Date().toISOString(),
            migrationSource: 'FinalList_2026-05-21'
        }, { merge: true });

        updatedCount++;
        if (updatedCount % 20 === 0) console.log(`✅ Processed ${updatedCount} authorized members...`);
    }

    // 4. Mark everyone else as Inactive
    const batch = db.batch();
    for (const fm of firestoreMembers) {
        if (!fm.email || !authorizedEmails.has(fm.email.toLowerCase())) {
            const mRef = db.collection('newMemberCollection').doc(fm.id);
            batch.update(mRef, {
                userInactive: true,
                isNewsletterAuthorized: false,
                updatedAt: new Date().toISOString(),
                status: 'inactive'
            });
            inactivatedCount++;
        }
    }

    if (inactivatedCount > 0) {
        await batch.commit();
    }

    console.log(`\n🎉 Master Sync Complete!`);
    console.log(`✅ Authorized & Standardized: ${updatedCount} members.`);
    console.log(`❌ Marked as userInactive: ${inactivatedCount} records.`);
    console.log(`\nYour database is now 100% aligned with the final source of truth.`);
}

masterSync().catch(console.error);
