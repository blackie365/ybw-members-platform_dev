require('dotenv').config({ path: '.env.local' });
const { sendEmail } = require('./src/lib/email');

console.log("MAILGUN_API_KEY:", process.env.MAILGUN_API_KEY ? "Set" : "Not Set");
console.log("MAILGUN_DOMAIN:", process.env.MAILGUN_DOMAIN);

// Test firebase-admin
const admin = require('firebase-admin');
const serviceAccount = require('./serviceAccountKey.json');

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}

async function run() {
  try {
    const link = await admin.auth().generatePasswordResetLink('rob@topicuk.co.uk');
    console.log("LINK:", link);
  } catch (e) {
    console.error("FIREBASE ERROR:", e);
  }
}
run();

