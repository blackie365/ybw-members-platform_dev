
import { adminDb, adminStorage } from '../src/lib/firebase-admin';
import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

async function fixMilly() {
  const email = 'milly@millyjohnson.co.uk';
  const imageUrl = 'https://p16-cc-image-search-sign-sg.ibyteimg.com/tos-alisg-i-h9hire4aei-sg/image/fc5b417b074f92a71b3f2e942e03efe6~tplv-h9hire4aei-image.jpeg?rk3s=add9cc80&x-expires=1784668817&x-signature=b%2BHO%2BDyWCSxABlHwMF2o4Ry6DDM%3D';
  
  console.log(`🚀 Fixing image for Milly Johnson (${email})...`);
  
  const snapshot = await adminDb.collection('newMemberCollection')
    .where('email', '==', email)
    .get();
    
  if (snapshot.empty) {
    console.log('❌ Milly Johnson not found in Firestore.');
    return;
  }

  const doc = snapshot.docs[0];
  const bucket = adminStorage.bucket();

  try {
    console.log(`📥 Downloading image from: ${imageUrl}`);
    const response = await axios.get(imageUrl, { 
      responseType: 'arraybuffer',
      timeout: 15000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      }
    });

    const buffer = Buffer.from(response.data);
    const contentType = (response.headers['content-type'] as string) || 'image/jpeg';
    const extension = contentType.includes('/') ? contentType.split('/')[1] : 'jpg';
    const fileName = `profile-images/${doc.id}-${Date.now()}.${extension}`;
    
    console.log(`📤 Uploading to Storage: ${fileName}`);
    const file = bucket.file(fileName);
    await file.save(buffer, {
      contentType,
      metadata: { 
        metadata: { owner: email }
      },
      public: true
    });

    const publicUrl = `https://storage.googleapis.com/${bucket.name}/${fileName}`;
    console.log(`✅ Upload successful: ${publicUrl}`);

    // Update Firestore
    await doc.ref.update({
      avatarUrl: publicUrl,
      profileImage: publicUrl,
      image: publicUrl,
      lastUpdated: new Date()
    });

    console.log(`🎉 Firestore updated for ${email}`);
  } catch (error: any) {
    console.error(`❌ Failed to fix Milly Johnson: ${error.message}`);
    if (error.response) {
      console.log(`Status: ${error.response.status}`);
    }
  }
}

fixMilly().catch(console.error);
