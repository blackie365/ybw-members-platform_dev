import { adminAuth, adminDb } from '../src/lib/firebase-admin';
import * as dotenv from 'dotenv';
import { Resend } from 'resend';
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
    } catch (err: any) {
      console.error(`❌ Firebase test failed: ${err.message}`);
    }
  }

  // 2. Check Resend
  console.log('\n2. Checking Resend...');
  const resendKey = process.env.RESEND_API_KEY;
  if (!resendKey) {
    console.error('❌ RESEND_API_KEY missing from .env.local');
  } else {
    try {
      const resend = new Resend(resendKey);
      const { data, error } = await resend.domains.list();
      if (error) throw error;
      console.log(`✅ Resend API connection successful. Found ${data?.data.length} domains.`);
    } catch (err: any) {
      console.error(`❌ Resend connection failed: ${err.message}`);
    }
  }

  // 3. Check Environment Variables
  console.log('\n3. Checking Environment Variables...');
  const required = ['NEXT_PUBLIC_APP_URL', 'NEXT_PUBLIC_FIREBASE_API_KEY', 'CLERK_SECRET_KEY'];
  required.forEach(v => {
    if (!process.env[v]) {
      console.warn(`⚠️  Missing ${v}`);
    } else {
      console.log(`✅ ${v} is set.`);
    }
  });

  console.log('\n--- HEALTH CHECK COMPLETE ---');
}

checkSystemHealth();
