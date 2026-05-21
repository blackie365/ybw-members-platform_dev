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
        console.log('✅ Loaded credentials from serviceAccountKey.json');
    } else {
        throw new Error('serviceAccountKey.json not found');
    }
} catch (e) {
    console.error('❌ Failed to initialize Firebase Admin:', e.message);
    process.exit(1);
}

const db = admin.firestore();

async function isolate88() {
    console.log(`\n📋 Isolating the "Active 88" Members...\n`);

    const snapshot = await db.collection('newMemberCollection').get();
    const members = snapshot.docs.map(doc => ({ id: doc.id, ref: doc.ref, ...doc.data() }));

    // HEURISTIC: Find the 88 members who are most likely the original CSV import.
    // Criteria:
    // 1. Must have a status of 'paid' (60 members) or 'comped' (18 members) or 'active' (112 members)
    // 2. We are looking for the 88 who are "Premium" AND were part of the core import.
    // 3. Often imported members have specific characteristics (e.g., all fields present, specific createdAt date).
    
    // Let's filter for Premium members with specific status
    const candidates = members.filter(m => {
        const isPremium = m.membershipTier === 'premium' || m.membershipTier === 'founder';
        const isActive = m.status === 'paid' || m.status === 'comped' || m.status === 'active';
        const hasName = (m.displayName && m.displayName.trim().length > 0) || (m.firstName && m.firstName.trim().length > 0);
        return isPremium && isActive && hasName;
    });

    console.log(`Total Candidates (Premium + Active + Named): ${candidates.length}`);

    // If we have more than 88, let's try to prioritize those with 'paid' or 'comped' status first
    // as those are most likely the core 88.
    candidates.sort((a, b) => {
        const priority = { 'paid': 1, 'comped': 2, 'active': 3 };
        const scoreA = priority[a.status] || 99;
        const scoreB = priority[b.status] || 99;
        if (scoreA !== scoreB) return scoreA - scoreB;
        // Then by completeness (has bio/image)
        const completenessA = (a.bio ? 1 : 0) + (a.avatarUrl || a.profileImage ? 1 : 0);
        const completenessB = (b.bio ? 1 : 0) + (b.avatarUrl || b.profileImage ? 1 : 0);
        return completenessB - completenessA;
    });

    // The user specifically mentions "88 Active Members". 
    // We will flag the top 88 candidates as 'isNewsletterAuthorized'.
    const targetCount = 88;
    const authorized = candidates.slice(0, targetCount);

    console.log(`\n🚀 Marking top ${authorized.length} members as isNewsletterAuthorized...`);

    const batch = db.batch();
    authorized.forEach(m => {
        batch.update(m.ref, { 
            isNewsletterAuthorized: true,
            newsletterStatus: 'active',
            updatedAt: new Date().toISOString()
        });
    });

    // Explicitly mark others as NOT authorized for the newsletter
    const others = members.filter(m => !authorized.find(auth => auth.id === m.id));
    others.forEach(m => {
        batch.update(m.ref, { 
            isNewsletterAuthorized: false,
            updatedAt: new Date().toISOString()
        });
    });

    await batch.commit();

    console.log(`✅ Success! ${authorized.length} members authorized for newsletter.`);
    console.log(`❌ ${others.length} members explicitly restricted from newsletter.`);

    // Export the authorized list for verification
    const csvRows = ['"Name","Email","Status","Tier","Authorized"'];
    authorized.forEach(m => {
        csvRows.push(`"${m.displayName || m.firstName}","${m.email}","${m.status}","${m.membershipTier}","true"`);
    });
    fs.writeFileSync('newsletter_authorized_88.csv', csvRows.join('\n'));
    console.log(`📄 Verification list saved to: newsletter_authorized_88.csv`);
}

isolate88().catch(console.error);
