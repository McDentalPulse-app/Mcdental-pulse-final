import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey: "AIzaSyDCKbMZKp46Dn0QGr5KmjFtrbCH3H6LeEc",
  authDomain: "mcdental-pulse.firebaseapp.com",
  projectId: "mcdental-pulse",
  storageBucket: "mcdental-pulse.firebasestorage.app",
  messagingSenderId: "181118152189",
  appId: "1:181118152189:web:e99c719584322b081abd94"
};

const app = initializeApp(firebaseConfig);

export const db = getFirestore(app);
export const storage = getStorage(app);