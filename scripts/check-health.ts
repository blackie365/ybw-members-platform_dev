import { adminAuth, adminDb } from '../src/lib/firebase-admin';
import * as dotenv from 'dotenv';
import { execSync } from 'child_process';
dotenv.config({ path: '.env.local' });

async function checkSystemHealth() {
  console.log('--- SYSTEM HEALTH CHECK ---');
  
  // 1. Check Firebase Admin
  console.log('\n1. Checking Firebase Admin...');
  if (!adminAuth || !adminDb) {
    console.error('❌ Firebase Admin failed to initialize.');
  } else {
    try {
      const testEmail = 'rob@topicuk.co.uk';
      console.log(`Attempting to fetch user: ${testEmail}`);
      const user = await adminAuth.getUserByEmail(testEmail);
      console.log(`✅ Firebase Auth connection successful. User UID: ${user.uid}`);
      
      console.log('Attempting to generate a test reset link...');
      const link = await adminAuth.generatePasswordResetLink(testEmail);
      console.log(`✅ Firebase link generation successful.`);
      console.log(`Link: ${link.substring(0, 50)}...`);
    } catch (err: any) {
      console.error(`❌ Firebase test failed: ${err.message}`);
      if (err.message.includes('INTERNAL ASSERT FAILED')) {
        console.error('   This is a known SDK bug. The fallback logic will be used.');
      }
    }
  }

  // 2. Check Sendmail
  console.log('\n2. Checking Sendmail...');
  try {
    const sendmailPath = execSync('which sendmail').toString().trim();
    console.log(`✅ Sendmail binary found at: ${sendmailPath}`);
  } catch (err) {
    console.error('❌ Sendmail binary not found in system path.');
    console.warn('   Note: Sendmail might still work if configured with an absolute path in src/lib/email.ts');
  }

  // 3. Check Environment Variables
  console.log('\n3. Checking Environment Variables...');
  const required = ['NEXT_PUBLIC_APP_URL', 'NEXT_PUBLIC_FIREBASE_API_KEY'];
  required.forEach(v => {
    if (!process.env[v]) {
      console.warn(`⚠️  Missing ${v} - this may cause link errors on the website.`);
    } else {
      console.log(`✅ ${v} is set.`);
    }
  });

  console.log('\n--- HEALTH CHECK COMPLETE ---');
}

checkSystemHealth();
