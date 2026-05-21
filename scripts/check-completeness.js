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

async function checkPremiumCompleteness() {
    const snapshot = await db.collection('newMemberCollection')
        .where('membershipTier', 'in', ['premium', 'founder'])
        .get();
    
    let complete = 0;
    let missingImage = 0;
    let missingBio = 0;
    let missingName = 0;

    snapshot.docs.forEach(doc => {
        const data = doc.data();
        const hasImage = !!(data.profileImage || data.avatarUrl || data.image);
        const hasBio = !!data.bio && data.bio.trim().length > 5;
        const hasName = !!(data.displayName || data.firstName || data.lastName);

        if (hasImage && hasBio && hasName) complete++;
        if (!hasImage) missingImage++;
        if (!hasBio) missingBio++;
        if (!hasName) missingName++;
    });

    console.log(`Total Premium/Founder: ${snapshot.size}`);
    console.log(`Complete: ${complete}`);
    console.log(`Missing Image: ${missingImage}`);
    console.log(`Missing Bio: ${missingBio}`);
    console.log(`Missing Name: ${missingName}`);
}

checkPremiumCompleteness().catch(console.error);
