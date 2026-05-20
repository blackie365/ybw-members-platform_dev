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

async function scanImages() {
    const snapshot = await db.collection('newMemberCollection')
        .where('membershipTier', 'in', ['premium', 'founder'])
        .get();
    
    console.log(`\n📸 Scanning ${snapshot.size} Premium Members for images...\n`);

    snapshot.docs.forEach(doc => {
        const data = doc.data();
        const imageFields = {};
        
        Object.entries(data).forEach(([key, value]) => {
            if (typeof value === 'string' && (value.includes('http') || value.includes('storage'))) {
                if (key.toLowerCase().includes('image') || key.toLowerCase().includes('avatar') || key.toLowerCase().includes('url') || key.toLowerCase().includes('logo')) {
                    imageFields[key] = value;
                }
            }
        });

        if (Object.keys(imageFields).length > 0) {
            console.log(`Member: ${data.displayName || doc.id}`);
            console.log(JSON.stringify(imageFields, null, 2));
            console.log('---');
        }
    });
}

scanImages().catch(console.error);
