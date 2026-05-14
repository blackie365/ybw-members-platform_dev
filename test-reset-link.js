const admin = require('firebase-admin');
const serviceAccount = require('./serviceAccountKey.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

async function run() {
  try {
    const link = await admin.auth().generatePasswordResetLink('rob@topicuk.co.uk');
    console.log('Success:', link);
  } catch(e) {
    console.log('Error Code:', e.code);
    console.log('Error Message:', e.message);
  }
}
run();
