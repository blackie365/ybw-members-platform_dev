
import { adminDb, adminStorage } from '../src/lib/firebase-admin';
import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

async function migrateExternalAvatars() {
  console.log('🚀 Starting external avatar migration...');
  
  const snapshot = await adminDb.collection('newMemberCollection')
    .where('userInactive', '==', false)
    .get();
    
  const bucket = adminStorage.bucket();
  let migratedCount = 0;
  let failedCount = 0;

  for (const doc of snapshot.docs) {
    const data = doc.data();
    const avatarUrl = data.avatarUrl;
    const name = data.name || data.displayName || 'Unknown';

    if (!avatarUrl || avatarUrl.includes('firebasestorage.googleapis.com') || avatarUrl.includes('storage.googleapis.com')) {
      continue;
    }

    console.log(`\n📦 Migrating avatar for ${name}...`);
    console.log(`🔗 Source: ${avatarUrl}`);

    try {
      // Download image
      const response = await axios.get(avatarUrl, { 
        responseType: 'arraybuffer',
        timeout: 10000,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
        }
      });

      const buffer = Buffer.from(response.data);
      const contentType = (response.headers['content-type'] as string) || 'image/jpeg';
      const extension = contentType.split('/')[1] || 'jpg';
      const fileName = `profile-images/${doc.id}-${Date.now()}.${extension}`;
      
      const file = bucket.file(fileName);
      await file.save(buffer, {
        contentType,
        public: true
      });

      const publicUrl = `https://storage.googleapis.com/${bucket.name}/${fileName}`;
      
      // Update Firestore
      await doc.ref.update({
        avatarUrl: publicUrl,
        lastUpdated: new Date()
      });

      console.log(`✅ Success! New URL: ${publicUrl}`);
      migratedCount++;
    } catch (error: any) {
      console.error(`❌ Failed to migrate ${name}: ${error.message}`);
      failedCount++;
    }
  }

  console.log(`\n🏁 Migration Finished!`);
  console.log(`- Successfully migrated: ${migratedCount}`);
  console.log(`- Failed: ${failedCount}`);
}

migrateExternalAvatars().catch(console.error);
