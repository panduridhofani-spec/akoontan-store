import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyDylw_PN8LYxGMW7BRnLKYPwspoirGdwjw",
  authDomain: "akoontan-store.firebaseapp.com",
  projectId: "akoontan-store",
  storageBucket: "akoontan-store.firebasestorage.app",
  messagingSenderId: "723505036516",
  appId: "1:723505036516:web:4bc509e136f3bb1fd600f1"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
