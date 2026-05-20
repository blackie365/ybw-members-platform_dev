/**
 * Firestore Full Backup Script
 * 
 * This script exports all documents from the specified collections into JSON files.
 * It uses the serviceAccountKey.json for authentication.
 */

require('dotenv').config({ path: '.env.local' });
const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');

const COLLECTIONS = ['newMemberCollection', 'events', 'messageThreads', 'newsletters'];
const BACKUP_DIR = path.join(process.cwd(), 'backups');

// Ensure backup directory exists
if (!fs.existsSync(BACKUP_DIR)) {
    fs.mkdirSync(BACKUP_DIR);
}

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

async function createBackup() {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const sessionDir = path.join(BACKUP_DIR, `backup-${timestamp}`);
    fs.mkdirSync(sessionDir);

    console.log(`\n📦 Starting full backup to: ${sessionDir}`);

    for (const collectionName of COLLECTIONS) {
        try {
            console.log(`Reading collection: ${collectionName}...`);
            const snapshot = await db.collection(collectionName).get();
            
            const data = {};
            snapshot.docs.forEach(doc => {
                data[doc.id] = doc.data();
            });

            const filePath = path.join(sessionDir, `${collectionName}.json`);
            fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
            console.log(`✅ Exported ${snapshot.size} documents to ${collectionName}.json`);
        } catch (error) {
            console.error(`❌ Failed to export collection ${collectionName}:`, error.message);
        }
    }

    console.log(`\n✨ Backup complete! All files are in ${sessionDir}`);
}

createBackup().catch(console.error);
