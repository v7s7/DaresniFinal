// client/src/lib/firebase.ts
import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey: "AIzaSyDuSJH6NBSjFmZXYJ_2-hJ_ScpmU6t6yB8",
  authDomain: "daresni-c9b13.firebaseapp.com",
  projectId: "daresni-c9b13",
  storageBucket: "daresni-c9b13.firebasestorage.app",
  messagingSenderId: "731954028532",
  appId: "1:731954028532:web:c9d818aebf6550e8e2e3a1",
  measurementId: "G-V0DL2SLXQF" // optional
};

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);

// Google provider
export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: "select_account" });
