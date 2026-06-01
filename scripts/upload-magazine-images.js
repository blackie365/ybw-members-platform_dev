/**
 * MAGAZINE IMAGE UPLOADER
 * 
 * This script migrates magazine assets from your local Dropbox to Firebase Storage.
 * 
 * Usage: node scripts/upload-magazine-images.js
 */

require('dotenv').config({ path: '.env.local' });
const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');

// --- CONFIGURATION ---
const DROPBOX_BASE = "/Volumes/Data/Dropbox/CurrentYBW/april2026";
const STORAGE_PATH = "magazine/apr-may-2026";
const BUCKET_NAME = process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || "newmembersdirectory130325.firebasestorage.app";

// Mapping of Dropbox files to their Storage names
const FILE_MAPPINGS = [
  { 
    src: "Lesley Beach/Lesley copy.jpg", 
    dest: "cover.jpg" 
  },
  { 
    src: "Linda & Vicky/wetransfer_vicky-cheetham-headshot-lgt-stage-credit-ant-robling-jpg_2026-03-10_1724/Dame Linda Pollard, Vicky Cheetham LGT auditorium (standing). Credit Ant Robling.jpg", 
    dest: "linda-vicky.jpg" 
  },
  { 
    src: "Rebecca Rhoades/Banner 08.jpg", 
    dest: "rebecca-rhoades-08.jpg" 
  },
  { 
    src: "Rebecca Rhoades/Banner 12b.jpg", 
    dest: "rebecca-rhoades-12b.jpg" 
  },
  { 
    src: "Rebecca Rhoades/Banner 14b.jpg", 
    dest: "rebecca-rhoades-14b.jpg" 
  },
  { 
    src: "Rebecca Rhoades/Banner 15b.jpg", 
    dest: "rebecca-rhoades-15b.jpg" 
  },
  { 
    src: "Member profile (Vicky)/Vicky Clapham.jpg", 
    dest: "vicky-clapham.jpg" 
  },
  { 
    src: "Ambers Restaurant/Unknown-1.jpeg", 
    dest: "ambers.jpg" 
  }
];

// --- INITIALIZE FIREBASE ADMIN ---
try {
  const serviceAccountPath = path.join(process.cwd(), 'serviceAccountKey.json');
  if (!fs.existsSync(serviceAccountPath)) {
    console.error('❌ ERROR: serviceAccountKey.json not found in root directory.');
    process.exit(1);
  }

  const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'));
  
  if (!admin.apps.length) {
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      storageBucket: BUCKET_NAME
    });
  }
  
  console.log('✅ Firebase Admin initialized.');
} catch (e) {
  console.error('❌ Failed to initialize Firebase Admin:', e.message);
  process.exit(1);
}

const bucket = admin.storage().bucket();

// --- UPLOAD FUNCTION ---
async function uploadImages() {
  console.log(`🚀 Starting upload to bucket: ${BUCKET_NAME}...`);
  console.log(`📂 Destination path: ${STORAGE_PATH}\n`);

  for (const mapping of FILE_MAPPINGS) {
    const localPath = path.join(DROPBOX_BASE, mapping.src);
    const destination = `${STORAGE_PATH}/${mapping.dest}`;

    if (!fs.existsSync(localPath)) {
      console.warn(`⚠️  SKIP: Local file not found: ${localPath}`);
      continue;
    }

    try {
      console.log(`⬆️  Uploading: ${mapping.dest}...`);
      await bucket.upload(localPath, {
        destination: destination,
        public: true, // Make it readable by the website
        metadata: {
          cacheControl: 'public, max-age=31536000',
        }
      });
      console.log(`✅ SUCCESS: ${destination}`);
    } catch (error) {
      console.error(`❌ FAILED: ${destination}`, error.message);
    }
  }

  console.log('\n✨ Migration complete!');
}

uploadImages().catch(console.error);
