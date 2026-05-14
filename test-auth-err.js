const { initializeApp } = require('firebase/app');
const { getAuth, signInWithEmailAndPassword } = require('firebase/auth');

const app = initializeApp({ apiKey: "AIzaSyDummyKeyDummyKeyDummyKeyDummyKey", projectId: "dummy" });
const auth = getAuth(app);

signInWithEmailAndPassword(auth, 'test@example.com', 'wrongpassword')
  .catch(err => {
    console.log('CODE:', err.code);
    console.log('MESSAGE:', err.message);
  });
