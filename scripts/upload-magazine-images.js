/**
 * MAGAZINE IMAGE UPLOADER (with PSD Conversion)
 * 
 * This script migrates magazine assets from your local Dropbox to Firebase Storage.
 * It automatically detects Photoshop (PSD) files and converts them to high-quality JPEGs.
 * 
 * Usage: node scripts/upload-magazine-images.js
 */

require('dotenv').config({ path: '.env.local' });
const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');
const PSD = require('psd');
const sharp = require('sharp');

// --- CONFIGURATION ---
const DROPBOX_BASE = "/Volumes/Data/Dropbox/CurrentYBW/april2026";
const STORAGE_PATH = "magazine/apr-may-2026";
const BUCKET_NAME = process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || "newmembersdirectory130325.firebasestorage.app";
const TEMP_DIR = path.join(process.cwd(), 'temp_conversion');

// Mapping of Dropbox files to their Storage names
const FILE_MAPPINGS = [
  { 
    src: "/Users/robertblackwell/Desktop/ybm_APRil-MAY_2026.jpg", 
    dest: "cover.jpg",
    absolute: true
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

// Ensure temp directory exists
if (!fs.existsSync(TEMP_DIR)) {
  fs.mkdirSync(TEMP_DIR);
}

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

/**
 * Checks if a file is a PSD by reading the magic bytes (8BPS)
 */
function isPSD(filePath) {
  const buffer = Buffer.alloc(4);
  const fd = fs.openSync(filePath, 'r');
  fs.readSync(fd, buffer, 0, 4, 0);
  fs.closeSync(fd);
  return buffer.toString() === '8BPS';
}

/**
 * Converts PSD to high-quality JPEG
 */
async function convertPSD(localPath, destName) {
  const tempJpegPath = path.join(TEMP_DIR, destName);
  console.log(`🎨 Converting PSD: ${destName}...`);
  
  try {
    const psd = PSD.fromFile(localPath);
    psd.parse();
    
    // Get the flattened preview image (Pixel Data)
    const image = psd.image;
    const pixelData = image.pixelData;
    const width = image.width();
    const height = image.height();
    
    // Create a buffer from the raw RGBA pixel data
    // Sharp can handle raw pixel data if we provide the dimensions
    await sharp(pixelData, {
      raw: {
        width: width,
        height: height,
        channels: 4
      }
    })
      .jpeg({ quality: 90, progressive: true })
      .toFile(tempJpegPath);
      
    return tempJpegPath;
  } catch (error) {
    throw new Error(`Conversion failed: ${error.message}`);
  }
}

// --- UPLOAD FUNCTION ---
async function uploadImages() {
  console.log(`🚀 Starting upload to bucket: ${BUCKET_NAME}...`);
  console.log(`📂 Destination path: ${STORAGE_PATH}\n`);

  for (const mapping of FILE_MAPPINGS) {
    const localPath = mapping.absolute ? mapping.src : path.join(DROPBOX_BASE, mapping.src);
    const destination = `${STORAGE_PATH}/${mapping.dest}`;
    let uploadPath = localPath;
    let isConverted = false;

    if (!fs.existsSync(localPath)) {
      console.warn(`⚠️  SKIP: Local file not found: ${localPath}`);
      continue;
    }

    try {
      // Check if it's actually a PSD disguised as a JPG
      if (isPSD(localPath)) {
        console.log(`🔍 PSD detected: ${mapping.dest}`);
        uploadPath = await convertPSD(localPath, mapping.dest);
        isConverted = true;
      }

      console.log(`⬆️  Uploading: ${mapping.dest}${isConverted ? ' (Converted)' : ''}...`);
      await bucket.upload(uploadPath, {
        destination: destination,
        public: true,
        metadata: {
          cacheControl: 'public, max-age=31536000',
          contentType: 'image/jpeg'
        }
      });
      console.log(`✅ SUCCESS: ${destination}`);

      // Clean up temp file if we created one
      if (isConverted && fs.existsSync(uploadPath)) {
        fs.unlinkSync(uploadPath);
      }
    } catch (error) {
      console.error(`❌ FAILED: ${destination}`, error.message);
    }
  }

  // Cleanup temp dir
  if (fs.existsSync(TEMP_DIR) && fs.readdirSync(TEMP_DIR).length === 0) {
    fs.rmdirSync(TEMP_DIR);
  }

  console.log('\n✨ Migration complete!');
}

uploadImages().catch(console.error);
