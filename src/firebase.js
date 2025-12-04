import { initializeApp } from 'firebase/app';
import { getDatabase } from 'firebase/database';
import { getAuth } from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyBu0oBBTtPA9O6Gf0OXFmXl9Gg_5YSKMxQ",
  authDomain: "jio-bp-f6bc4.firebaseapp.com",
  databaseURL: "https://jio-bp-f6bc4-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "jio-bp-f6bc4",
  storageBucket: "jio-bp-f6bc4.firebasestorage.app",
  messagingSenderId: "417260432140",
  appId: "1:417260432140:web:455faaa08017680498f729"
};

const app = initializeApp(firebaseConfig);
export const db = getDatabase(app);
export const auth = getAuth(app);
export default app;