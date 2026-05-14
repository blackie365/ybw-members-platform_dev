const { initializeApp } = require('firebase/app');
const { getAuth } = require('firebase/auth');
try {
  const app = initializeApp({
    apiKey: undefined,
    projectId: undefined
  });
  getAuth(app);
  console.log('Success');
} catch (err) {
  console.log('Error:', err.message);
}
