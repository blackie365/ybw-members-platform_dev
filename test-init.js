const { initializeApp } = require('firebase/app');
try {
  initializeApp({
    apiKey: undefined,
    projectId: undefined
  });
  console.log('Success');
} catch (err) {
  console.log('Error:', err.message);
}
