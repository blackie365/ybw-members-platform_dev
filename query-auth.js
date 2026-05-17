const admin = require('firebase-admin');
const serviceAccount = require('./serviceAccountKey.json');

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}

async function run() {
  try {
    const user = await admin.auth().getUserByEmail('natalie@simononthestreets.co.uk');
    console.log(user);
  } catch (e) {
    console.error(e);
  }
}
run();
