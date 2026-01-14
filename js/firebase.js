import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';

// 🔴 YOUR CONFIG GOES HERE 🔴
const firebaseConfig = {
  apiKey: "AIzaSyBrSqpnR3U6ZbgQmwpRqk_-ILXpKg_qhwI",
  authDomain: "construction-material-movement.firebaseapp.com",
  projectId: "construction-material-movement",
  storageBucket: "construction-material-movement.firebasestorage.app",
  messagingSenderId: "960413300825",
  appId: "1:960413300825:web:78aba6afbf5ac40d289948",
  measurementId: "G-PPM6X45YTD"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);

// Initialize Auth
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
