const fs = require('fs');
const csv = require('csv-parser');
const admin = require('firebase-admin');

// Load env vars
require('dotenv').config({ path: '.env.local' });

if (!admin.apps.length) {
  const serviceAccountPath = './serviceAccountKey.json';
  if (fs.existsSync(serviceAccountPath)) {
    const serviceAccount = require('.' + serviceAccountPath);
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount)
    });
    console.log('Firebase Admin initialized successfully using serviceAccountKey.json.');
  } else if (process.env.FIREBASE_SERVICE_ACCOUNT_KEY) {
    try {
      const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
      });
      console.log('Firebase Admin initialized successfully using FIREBASE_SERVICE_ACCOUNT_KEY.');
    } catch (error) {
      console.error('Error parsing FIREBASE_SERVICE_ACCOUNT_KEY:', error);
      process.exit(1);
    }
  } else {
    console.error('ERROR: Firebase Admin credentials not found.');
    console.error('Please either:');
    console.error('1. Download your Service Account JSON from Firebase Console (Project Settings -> Service Accounts -> Generate new private key)');
    console.error('2. Save it as `serviceAccountKey.json` in the ybw-frontend folder.');
    console.error('OR set FIREBASE_SERVICE_ACCOUNT_KEY in .env.local');
    process.exit(1);
  }
}

const db = admin.firestore();
const auth = admin.auth();

const csvFilePath = 'members.csv';
const results = [];

// Helper function to generate a random strong password
function generateRandomPassword() {
  const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*()_+";
  let password = "";
  for (let i = 0; i < 16; i++) {
    password += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return password;
}

fs.createReadStream(csvFilePath)
  .pipe(csv())
  .on('data', (data) => results.push(data))
  .on('end', async () => {
    console.log(`Found ${results.length} members in CSV.`);
    
    // Process all members
    const testMembers = results;
    console.log(`Processing ${testMembers.length} members for full migration...`);
    
    for (const row of testMembers) {
      const email = row.email;
      const name = row.name;
      const stripeCustomerId = row.stripe_customer_id;
      // In Ghost, members might be complimentary or have a stripe customer ID
      const isPremium = !!stripeCustomerId || !!row.complimentary_plan || row.tiers?.toLowerCase().includes('premium'); 
      const isAdmin = row.isAdmin ? row.isAdmin.toLowerCase() === 'true' || row.isAdmin === '1' : false;
      
      console.log(`\nProcessing: ${email} - Premium: ${isPremium} - Admin: ${isAdmin}`);
      
      try {
        let userRecord;
        // 1. Check/Create Firebase Auth User
        try {
          userRecord = await auth.getUserByEmail(email);
          console.log(`Auth user already exists: ${userRecord.uid}`);
        } catch (error) {
          if (error.code === 'auth/user-not-found') {
            console.log(`Creating new Auth user for ${email}`);
            userRecord = await auth.createUser({
              email: email,
              displayName: name,
              password: generateRandomPassword(), // Dummy secure password
            });
            console.log(`Successfully created new Auth user: ${userRecord.uid}`);
          } else {
            console.error(`Error checking auth for ${email}:`, error);
            continue; // Skip to next user
          }
        }

        const uid = userRecord.uid;

        // 2. Surgical Merge into Firestore
        const userRef = db.collection('newMemberCollection').doc(uid);
        
        // We check if the document exists first to decide what to log
        const docSnap = await userRef.get();
        if (docSnap.exists) {
          console.log(`Firestore profile exists. Surgically merging billing data...`);
          // Use merge: true so we don't overwrite existing profile data like bios or images
          await userRef.set({
            isPremium: isPremium,
            ...(stripeCustomerId && { stripeCustomerId }),
            ...(row.isAdmin && { isAdmin: isAdmin }), // Only update if explicitly in CSV
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
          }, { merge: true });
        } else {
          console.log(`Firestore profile missing. Creating new base profile...`);
          // Document doesn't exist, create a base profile
          await userRef.set({
            email: email,
            displayName: name,
            firstName: name ? name.split(' ')[0] : '',
            lastName: name ? name.split(' ').slice(1).join(' ') : '',
            isPremium: isPremium,
            isAdmin: isAdmin,
            ...(stripeCustomerId && { stripeCustomerId }),
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
          });
        }
        
        console.log(`Successfully processed ${email}`);
        
      } catch (err) {
        console.error(`Failed processing ${email}:`, err);
      }
    }
    
    console.log('\nTest migration complete!');
  });
