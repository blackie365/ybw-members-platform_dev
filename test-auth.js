const { signInWithEmailAndPassword } = require('firebase/auth');
try {
  signInWithEmailAndPassword(null, 'test@test.com', 'password').catch(err => console.log('Promise rejected:', err.message));
} catch (err) {
  console.log('Synchronous throw:', err.message);
}
