const { initializeApp } = require('firebase/app');
const { getAuth, sendPasswordResetEmail } = require('firebase/auth');

const app = initializeApp({ apiKey: "AIzaSyDummyKeyDummyKeyDummyKeyDummyKey", projectId: "dummy" });
const auth = getAuth(app);

sendPasswordResetEmail(auth, 'nonexistent@example.com')
  .catch(err => {
    console.log('CODE:', err.code);
    console.log('MESSAGE:', err.message);
  });
