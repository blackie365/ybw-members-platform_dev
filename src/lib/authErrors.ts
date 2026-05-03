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
      return 'Invalid email or password. Please check your credentials and try again.';
    case 'auth/user-disabled':
      return 'This account has been disabled. Please contact support.';
      
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
        // Also strip out (auth/...)
        msg = msg.replace(/\s*\(auth\/[^\)]+\)\.?/g, '');
        return msg.trim() || 'An unexpected error occurred. Please try again.';
      }
      return 'An unexpected error occurred. Please try again.';
  }
}
