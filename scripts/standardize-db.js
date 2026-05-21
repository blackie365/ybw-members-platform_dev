/**
 * Firestore Database Standardization Script
 * 
 * This script will:
 * 1. Connect to the 'newMemberCollection'
 * 2. Create a backup of the current state
 * 3. Map all legacy field names (e.g. 'First Name', 'Category') to camelCase standard
 * 4. Clean up redundant fields
 * 
 * Usage: node scripts/standardize-db.js --dry-run
 */

require('dotenv').config({ path: '.env.local' });
const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');

// Initialize Firebase Admin
let privateKey = process.env.FIREBASE_PRIVATE_KEY;
const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
const projectId = process.env.FIREBASE_PROJECT_ID || 'newmembersdirectory130325';

if (privateKey) {
    privateKey = privateKey.replace(/\\n/g, '\n');
}

if (!admin.apps.length) {
    try {
        const serviceAccountPath = path.join(process.cwd(), 'serviceAccountKey.json');
        if (fs.existsSync(serviceAccountPath)) {
            const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'));
            admin.initializeApp({
                credential: admin.credential.cert(serviceAccount),
            });
            console.log('✅ Loaded credentials from serviceAccountKey.json');
        } else if (privateKey && clientEmail) {
            admin.initializeApp({
                credential: admin.credential.cert({
                    projectId,
                    clientEmail,
                    privateKey,
                }),
            });
            console.log('✅ Loaded credentials from environment variables');
        } else {
            throw new Error('No Firebase credentials found (serviceAccountKey.json or env vars)');
        }
    } catch (e) {
        console.error('❌ Failed to initialize Firebase Admin:', e.message);
        process.exit(1);
    }
}

const db = admin.firestore();
const COLLECTION_NAME = 'newMemberCollection';
const isDryRun = process.argv.includes('--dry-run');

// Mapping of legacy/messy fields to standard camelCase fields
const FIELD_MAP = {
    // Names
    'First Name': 'firstName',
    'Last Name': 'lastName',
    'displayName': 'displayName',
    'searchName': 'searchName',
    'memberSlug': 'memberSlug',
    
    // Contact
    'Email': 'email',
    'email': 'email',
    
    // Professional
    'Company Name': 'companyName',
    'Job Title': 'jobTitle',
    'jobTitle': 'jobTitle',
    'companyName': 'companyName',
    'Website': 'website',
    'website': 'website',
    'LinkedIn URL': 'linkedinUrl',
    'linkedinUrl': 'linkedinUrl',
    'Facebook URL': 'facebookUrl',
    'facebookUrl': 'facebookUrl',
    'Instagram URL': 'instagramUrl',
    'instagramUrl': 'instagramUrl',
    'Twitter URL': 'twitterUrl',
    'twitterUrl': 'twitterUrl',
    
    // Location
    'Location': 'location',
    'location': 'location',
    
    // Membership & Status
    'Member status': 'status', // mapping 'paid'/'comped' etc to status
    'membershipTier': 'membershipTier',
    'isPremium': 'isPremium',
    'isAdmin': 'isAdmin',
    'status': 'status',
    'subscriptionStatus': 'subscriptionStatus',
    'stripeSubscriptionId': 'stripeSubscriptionId',
    'stripeCustomerId': 'stripeCustomerId',
    
    // Content & Bio
    'Bio': 'bio',
    'bio': 'bio',
    'Headline': 'headline',
    'headline': 'headline',
    'Avatar URL': 'avatarUrl',
    'avatarUrl': 'avatarUrl',
    'Logo URL': 'logoUrl',
    'logoUrl': 'logoUrl',
    
    // Categories/Tags
    'Category': 'industrySector',
    'category': 'industrySector',
    'industry': 'industrySector',
    'industrySector': 'industrySector',
    'Tags': 'tags',
    'tags': 'tags',
    'Services': 'services',
    'services': 'services',
    
    // Timestamps
    'Join Date': 'createdAt',
    'joinDate': 'createdAt',
    'createdAt': 'createdAt',
    'updatedAt': 'updatedAt',
    'lastUpdated': 'updatedAt',
    'Last Active': 'lastActive',
};

// Fields to remove entirely (redundant or useless)
const FIELDS_TO_REMOVE = [
    'Email marketing',
    'Gamification level',
    'Posts',
    'Likes',
    'Comments',
    'Profile URL',
    'UID',
    'uid',
    'featuredPriority',
    'searchName' // We can regenerate this or just use display name
];

async function runMigration() {
    console.log(`\n🚀 Starting Firestore Standardization on '${COLLECTION_NAME}'`);
    console.log(isDryRun ? "🧪 DRY RUN MODE - No changes will be written to Firestore" : "⚠️ PRODUCTION MODE - Data will be updated");

    const snapshot = await db.collection(COLLECTION_NAME).get();
    console.log(`Found ${snapshot.size} documents.\n`);

    // 1. Backup
    const backupData = {};
    snapshot.docs.forEach(doc => {
        backupData[doc.id] = doc.data();
    });
    
    const backupFile = path.join(process.cwd(), `scripts/backup_${Date.now()}.json`);
    fs.writeFileSync(backupFile, JSON.stringify(backupData, null, 2));
    console.log(`📦 Backup created: ${backupFile}`);

    let updateCount = 0;

    for (const doc of snapshot.docs) {
        const originalData = doc.data();
        const standardizedData = {};
        const keysToDelete = [];

        // Apply mapping
        Object.entries(originalData).forEach(([key, value]) => {
            if (FIELD_MAP[key]) {
                const standardKey = FIELD_MAP[key];
                // Only set if not already set (prevents overwriting newer camelCase fields with legacy data)
                if (standardizedData[standardKey] === undefined || standardizedData[standardKey] === null || standardizedData[standardKey] === '') {
                    standardizedData[standardKey] = value;
                }
                
                // If it's a legacy key name, mark for deletion
                if (key !== standardKey) {
                    keysToDelete.push(key);
                }
            } else if (!FIELDS_TO_REMOVE.includes(key)) {
                // Keep unknown fields that aren't on the remove list
                standardizedData[key] = value;
            } else {
                keysToDelete.push(key);
            }
        });

        // --- NEW IMAGE HEURISTICS ---
        // Look through ALL fields for a storage URL to set as the primary avatar
        let bestImage = null;
        Object.entries(originalData).forEach(([k, v]) => {
            if (typeof v === 'string' && v.includes('storage.googleapis.com')) {
                bestImage = v;
            }
        });
        
        // If we found a storage URL, prioritize it over everything else (like gravatar)
        if (bestImage) {
            standardizedData.avatarUrl = bestImage;
            standardizedData.profileImage = bestImage;
        }
        // --- END IMAGE HEURISTICS ---

        // Ensure display name exists
        if (!standardizedData.displayName && (standardizedData.firstName || standardizedData.lastName)) {
            standardizedData.displayName = `${standardizedData.firstName || ''} ${standardizedData.lastName || ''}`.trim();
        }

        // --- NEW NAME CLEANING HEURISTICS ---
        if (standardizedData.displayName) {
            const originalName = standardizedData.displayName;
            
            // Function to clean name (strips Mr, Mrs, Ms, Miss, Dr and Title Cases)
            const toTitleCase = (str) => {
                if (!str) return '';
                return str.toLowerCase().split(/([\s\-])/).map(part => {
                    if (part === ' ' || part === '-') return part;
                    return part.charAt(0).toUpperCase() + part.slice(1);
                }).join('');
            };

            const cleanName = (name) => {
                if (!name) return '';
                let cleaned = name.replace(/^(mr|mrs|ms|miss|dr|prof|sir|lady|rev)\.?\s+/gi, '');
                cleaned = cleaned.trim();
                return toTitleCase(cleaned);
            };

            const cleanedName = cleanName(originalName);
            if (originalName !== cleanedName) {
                standardizedData.displayName = cleanedName;
                const nameParts = cleanedName.split(' ');
                standardizedData.firstName = nameParts[0] || '';
                standardizedData.lastName = nameParts.slice(1).join(' ') || '';
            }
        }
        // --- END NAME CLEANING HEURISTICS ---

        // --- NEW STATUS/TIER HEURISTICS ---
        // If they have a storage image, are 'paid', 'comped', or 'isPremium', ensure they are in the 'premium' tier
        const isActuallyPremium = 
            !!bestImage ||
            standardizedData.status === 'paid' || 
            standardizedData.status === 'comped' || 
            standardizedData.isPremium === true || 
            standardizedData.membershipTier === 'Active Member' ||
            originalData['Member status'] === 'paid' ||
            originalData['Member status'] === 'comped' ||
            originalData['Active'] === 'true' ||
            originalData['Active'] === true;

        if (isActuallyPremium && (!standardizedData.membershipTier || standardizedData.membershipTier === 'free' || standardizedData.membershipTier === 'undefined')) {
            standardizedData.membershipTier = 'premium';
            standardizedData.status = 'active';
        }
        // --- END STATUS/TIER HEURISTICS ---

        // Clean up empty strings or nulls for critical fields if necessary
        if (standardizedData.tags && typeof standardizedData.tags === 'string') {
            try {
                standardizedData.tags = JSON.parse(standardizedData.tags);
            } catch (e) {
                standardizedData.tags = [];
            }
        }

        // Check if any change actually happened
        const hasChanges = keysToDelete.length > 0 || JSON.stringify(originalData) !== JSON.stringify(standardizedData);

        if (hasChanges) {
            updateCount++;
            if (isDryRun) {
                if (updateCount <= 3) {
                    console.log(`\n[DRY RUN] Would update doc: ${doc.id}`);
                    console.log(`- Removing: ${keysToDelete.join(', ')}`);
                    console.log(`- Resulting fields: ${Object.keys(standardizedData).join(', ')}`);
                }
            } else {
                // Perform the update:
                // First delete legacy fields
                const deletions = {};
                keysToDelete.forEach(k => {
                    deletions[k] = admin.firestore.FieldValue.delete();
                });
                
                await db.collection(COLLECTION_NAME).doc(doc.id).update({
                    ...standardizedData,
                    ...deletions,
                    updatedAt: admin.firestore.FieldValue.serverTimestamp()
                });
            }
        }
    }

    console.log(`\n✅ Migration finished.`);
    console.log(`${updateCount} documents ${isDryRun ? 'would be' : 'were'} standardized.`);
    if (isDryRun) {
        console.log(`\n👉 Run without --dry-run to apply changes: 'node scripts/standardize-db.js'`);
    }
}

runMigration().catch(console.error);
