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

function toTitleCase(str) {
    if (!str) return '';
    return str.toLowerCase().split(/([\s\-])/).map(part => {
        if (part === ' ' || part === '-') return part;
        return part.charAt(0).toUpperCase() + part.slice(1);
    }).join('');
}

function cleanName(name) {
    if (!name) return '';
    
    // 1. Remove titles (case insensitive)
    let cleaned = name.replace(/^(mr|mrs|ms|miss|dr|prof|sir|lady|rev)\.?\s+/gi, '');
    
    // 2. Trim whitespace
    cleaned = cleaned.trim();
    
    // 3. Convert to Title Case
    return toTitleCase(cleaned);
}

async function cleanAllNames() {
    console.log(`\n🧹 Cleaning Member Names in Firestore...\n`);

    const snapshot = await db.collection('newMemberCollection').get();
    let updateCount = 0;
    const batch = db.batch();

    snapshot.docs.forEach(doc => {
        const data = doc.data();
        const originalName = data.displayName || `${data.firstName || ''} ${data.lastName || ''}`.trim();
        
        if (!originalName) return;

        const cleanedName = cleanName(originalName);
        
        // Split back into firstName/lastName if possible
        const nameParts = cleanedName.split(' ');
        const firstName = nameParts[0] || '';
        const lastName = nameParts.slice(1).join(' ') || '';

        if (originalName !== cleanedName) {
            updateCount++;
            batch.update(doc.ref, {
                displayName: cleanedName,
                firstName: firstName,
                lastName: lastName,
                updatedAt: new Date().toISOString()
            });
            console.log(`- Updated: "${originalName}" -> "${cleanedName}"`);
        }
    });

    if (updateCount > 0) {
        await batch.commit();
        console.log(`\n✅ Successfully cleaned ${updateCount} names!`);
    } else {
        console.log(`\n✨ All names already look clean!`);
    }
}

cleanAllNames().catch(console.error);
