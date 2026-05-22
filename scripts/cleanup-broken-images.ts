
import { adminDb, adminStorage } from '../src/lib/firebase-admin';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

async function cleanupBrokenImages() {
  console.log('🧹 Cleaning up broken (tiny) images...');
  
  const bucket = adminStorage.bucket();
  const [files] = await bucket.getFiles({ prefix: 'profile-images/' });
  
  let deletedCount = 0;
  let clearedFirestoreCount = 0;

  for (const file of files) {
    const [metadata] = await file.getMetadata();
    const size = typeof metadata.size === 'string' ? parseInt(metadata.size) : (metadata.size || 0);
    
    // 301 bytes is the exact size of a Gravatar "blank" fallback
    if (size === 301 || size < 500) {
      const ownerEmail = metadata.metadata?.owner;
      console.log(`\n🗑️ Deleting broken image: ${file.name} (${size} bytes)`);
      if (ownerEmail) console.log(`👤 Owner: ${ownerEmail}`);

      try {
        // 1. Delete from Storage
        await file.delete();
        deletedCount++;

        // 2. Clear from Firestore
        if (ownerEmail) {
          const snapshot = await adminDb.collection('newMemberCollection')
            .where('email', '==', ownerEmail)
            .get();
          
          for (const doc of snapshot.docs) {
            const data = doc.data();
            const updates: any = {};
            
            // Clear all possible image fields if they point to this file
            const publicUrl = `https://storage.googleapis.com/${bucket.name}/${file.name}`;
            const firestoreUrl = data.avatarUrl || data.profileImage || data.image;
            
            if (firestoreUrl && (firestoreUrl.includes(file.name) || firestoreUrl === publicUrl)) {
              updates.avatarUrl = "";
              updates.profileImage = "";
              updates.image = "";
              await doc.ref.update(updates);
              clearedFirestoreCount++;
              console.log(`✅ Cleared Firestore fields for ${ownerEmail}`);
            }
          }
        }
      } catch (error: any) {
        console.error(`❌ Failed to cleanup ${file.name}: ${error.message}`);
      }
    }
  }

  console.log(`\n🏁 Cleanup Finished!`);
  console.log(`- Deleted from Storage: ${deletedCount}`);
  console.log(`- Cleared in Firestore: ${clearedFirestoreCount}`);
}

cleanupBrokenImages().catch(console.error);
