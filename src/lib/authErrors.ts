export function getFriendlyAuthErrorMessage(error: any): string {
  const code = error?.code || '';
  
  switch (code) {
    // Registration errors
    case 'auth/email-already-in-use':
      return 'This email address is already registered. Please sign in instead.';
    case 'auth/invalid-email':
      return 'Please enter a valid email address.';
    case 'auth/weak-password':
      return 'Your password must be at least 6 characters long.';
      
    // Login errors
    case 'auth/user-not-found':
    case 'auth/wrong-password':
    case 'auth/invalid-credential':
    case 'auth/invalid-login-credentials':
      return 'Invalid email or password. Please check your credentials and try again.';
    case 'auth/user-disabled':
      return 'This account has been disabled. Please contact support.';
    case 'auth/missing-password':
      return 'Please enter your password.';
      
    // Generic & Network errors
    case 'auth/too-many-requests':
      return 'Too many failed login attempts. Please try again later.';
    case 'auth/popup-closed-by-user':
      return 'Sign-in was cancelled. Please try again.';
    case 'auth/network-request-failed':
      return 'A network error occurred. Please check your internet connection.';
    case 'auth/operation-not-allowed':
      return 'This sign-in method is not enabled. Please contact support.';
      
    // Default fallback
    default:
      if (error?.message) {
        // Fallback to Firebase's message but strip out the ugly "Firebase: " prefix if present
        let msg = error.message.replace('Firebase: ', '');
        // Strip out the error code like (auth/something)
        msg = msg.replace(/\s*\(auth\/[^\)]+\)\.?/g, '').trim();
        
        // If the resulting message is just "Error" or empty, provide a better default
        if (!msg || msg.toLowerCase() === 'error') {
          return 'An unexpected authentication error occurred. Please try again.';
        }
        return msg;
      }
      return 'An unexpected error occurred. Please try again.';
  }
}
