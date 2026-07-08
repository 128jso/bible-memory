import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyCRNn2PUj5113RcRfZDpBlTZLQpOCYtroQ",
  authDomain: "bible-memory-5df4f.firebaseapp.com",
  projectId: "bible-memory-5df4f",
  storageBucket: "bible-memory-5df4f.firebasestorage.app",
  messagingSenderId: "533000227589",
  appId: "1:533000227589:web:155dcdf6d5afcba66ec56c",
  measurementId: "G-KLW53VP18S"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const googleProvider = new GoogleAuthProvider();
