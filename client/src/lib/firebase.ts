import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey: "AIzaSyCwVVmdPqgH862cvpGCJTZ39r4Wq8-UAN8",
  authDomain: "daresni-531ff.firebaseapp.com",
  projectId: "daresni-531ff",
  storageBucket: "daresni-531ff.firebasestorage.app",
  messagingSenderId: "704383154634",
  appId: "1:704383154634:web:d8c7c7260a8a757e637733",
  measurementId: "G-ZQQKCBXXGD"
};

// Initialize Firebase
export const app = initializeApp(firebaseConfig);

// Initialize Firebase services
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);

// Configure Google Auth Provider
export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({
  prompt: 'select_account',
});

export default app;