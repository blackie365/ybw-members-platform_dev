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

async function exhaustiveImageScan() {
    const snapshot = await db.collection('newMemberCollection').get();
    
    console.log(`\n🔍 Exhaustive Image Scan: Checking all ${snapshot.size} members...\n`);

    const findings = [];

    snapshot.docs.forEach(doc => {
        const data = doc.data();
        const imageFields = {};
        
        // Look through EVERY field for anything that looks like an image URL
        Object.entries(data).forEach(([key, value]) => {
            if (typeof value === 'string' && value.startsWith('http')) {
                const lowerKey = key.toLowerCase();
                const lowerValue = value.toLowerCase();
                
                // Potential image indicators
                const isPotentialImage = 
                    lowerKey.includes('image') || 
                    lowerKey.includes('avatar') || 
                    lowerKey.includes('photo') || 
                    lowerKey.includes('url') || 
                    lowerKey.includes('logo') ||
                    lowerValue.includes('.jpg') || 
                    lowerValue.includes('.jpeg') || 
                    lowerValue.includes('.png') || 
                    lowerValue.includes('.webp') ||
                    lowerValue.includes('storage.googleapis.com');

                // Filter out obviously non-image URLs
                const isNonImage = 
                    lowerValue.includes('linkedin.com') || 
                    lowerValue.includes('facebook.com') || 
                    lowerValue.includes('twitter.com') || 
                    lowerValue.includes('instagram.com') ||
                    lowerValue.includes('website') ||
                    lowerValue.includes('Profile URL');

                if (isPotentialImage && !isNonImage) {
                    imageFields[key] = value;
                }
            }
        });

        if (Object.keys(imageFields).length > 0) {
            findings.push({
                id: doc.id,
                name: data.displayName || `${data.firstName || ''} ${data.lastName || ''}`.trim(),
                tier: data.membershipTier,
                fields: imageFields
            });
        }
    });

    console.log(`✅ Found ${findings.length} members with potential image URLs.`);
    
    // Detailed output for investigation
    findings.forEach(f => {
        console.log(`\nMember: ${f.name} (${f.tier || 'no-tier'}) [ID: ${f.id}]`);
        Object.entries(f.fields).forEach(([k, v]) => {
            console.log(`  - ${k}: ${v}`);
        });
    });

    // Summarize unique field names found
    const uniqueFields = new Set();
    findings.forEach(f => Object.keys(f.fields).forEach(k => uniqueFields.add(k)));
    console.log(`\n📋 Unique field names containing images:`, Array.from(uniqueFields));
}

exhaustiveImageScan().catch(console.error);
