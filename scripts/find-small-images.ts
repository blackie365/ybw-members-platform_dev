
import { adminStorage } from '../src/lib/firebase-admin';
import dotenv from 'dotenv';

dotenv?.config({ path: '.env.local' });

async function findSmallImages() {
  const bucket = adminStorage?.bucket();
  const [files] = await bucket?.getFiles({ prefix: 'profile-images/' });
  
  console.log(`Checking ${files?.length} images...`);
  
  const smallFiles = [];
  for (const file of files) {
    const [metadata] = await file?.getMetadata();
    const size = typeof metadata?.size === 'string' ? parseInt(metadata?.size) : (metadata?.size || 0);
    if (size < 1000) { // Less than 1KB is almost certainly a blank/error image
      smallFiles?.push({
        name: file?.name,
        size,
        metadata: metadata?.metadata
      });
    }
  }
  
  console.log(`\n🚨 Found ${smallFiles?.length} tiny/broken images:`);
  smallFiles?.forEach(f => {
    console.log(`- ${f?.name} (${f?.size} bytes) - Owner: ${f?.metadata?.owner || 'Unknown'}`);
  });
}

findSmallImages()?.catch(console.error);
