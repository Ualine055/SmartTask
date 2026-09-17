/** Firebase auth error codes are not presentable; map the common ones. */
const MESSAGES: Record<string, string> = {
  "auth/invalid-email": "That email address is not valid.",
  "auth/user-disabled": "This account has been disabled.",
  "auth/user-not-found": "No account found with that email address.",
  "auth/wrong-password": "Incorrect password.",
  "auth/invalid-credential": "Incorrect email or password.",
  "auth/email-already-in-use": "An account with that email already exists.",
  "auth/weak-password": "Password must be at least 6 characters.",
  "auth/too-many-requests": "Too many attempts. Please wait a moment and try again.",
  "auth/network-request-failed": "Network problem — check your connection.",
  "permission-denied": "You do not have permission to do that.",
};

export function authErrorMessage(error: unknown, fallback = "Something went wrong."): string {
  const code = (error as { code?: string })?.code;
  if (code && MESSAGES[code]) return MESSAGES[code];
  const message = (error as { message?: string })?.message;
  return message || fallback;
}
