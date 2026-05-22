
import { adminStorage } from '../src/lib/firebase-admin';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

async function checkMetadata() {
  const bucket = adminStorage.bucket();
  const fileName = 'profile-images/c65d8250b3e27281a6b0407372c0d37a.jpg';
  const file = bucket.file(fileName);
  
  try {
    const [metadata] = await file.getMetadata();
    console.log('Metadata:', JSON.stringify(metadata, null, 2));
    
    const [isPublic] = await file.isPublic();
    console.log('Is Public:', isPublic);
    
    if (!isPublic) {
      console.log('Setting file to public...');
      await file.makePublic();
      console.log('File is now public.');
    }
  } catch (error: any) {
    console.error('Error:', error.message);
  }
}

checkMetadata().catch(console.error);
