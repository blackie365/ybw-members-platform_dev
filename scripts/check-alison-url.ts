
import axios from 'axios';

async function checkUrl() {
  const url = 'https://storage.googleapis.com/newmembersdirectory130325.firebasestorage.app/profile-images/c65d8250b3e27281a6b0407372c0d37a.jpg';
  console.log(`Checking URL: ${url}`);
  
  try {
    const response = await axios.head(url);
    console.log('✅ URL is accessible!');
    console.log('Status:', response.status);
    console.log('Content-Type:', response.headers['content-type']);
  } catch (error: any) {
    console.error('❌ URL is NOT accessible!');
    if (error.response) {
      console.log('Status:', error.response.status);
      console.log('Headers:', error.response.headers);
    } else {
      console.log('Error:', error.message);
    }
  }
}

checkUrl().catch(console.error);
