/* =============================================================================
   FIREBASE CONFIG — REPLACE WITH YOUR OWN PROJECT
   Create a free project at https://console.firebase.google.com
   Enable: Authentication > Email/Password, and Firestore Database.
   See SETUP.md for the full step-by-step + security rules.
   This is the ONLY file you need to touch to connect a Firebase project.
   ============================================================================= */
const firebaseConfig = {
  apiKey: "AIzaSyBM3C9QWgIxYTDSKGkkV2yKVPymu-15RdA",
  authDomain: "pacificwisdomagrotech-b8d36.firebaseapp.com",
  projectId: "pacificwisdomagrotech-b8d36",
  storageBucket: "pacificwisdomagrotech-b8d36.firebasestorage.app",
  messagingSenderId: "706520531855",
  appId: "1:706520531855:web:a50634e36e258cf48b41fa"
};

/* Your WhatsApp number (with country code, e.g. 91XXXXXXXXXX) — used by the
 * "Forgot password?" link on the login screen. Since accounts don't use
 * real email inboxes, password recovery goes through you on WhatsApp
 * instead of an email link. */
const SUPPORT_WHATSAPP = "919975374625";
