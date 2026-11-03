import { initializeApp } from "firebase/app";
import {
  getAuth,
  browserLocalPersistence,
  setPersistence,
} from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyDWqInE_u5UKTXX3me_N_sj7sVCIKIEnPQ",
  authDomain: "construmat.firebaseapp.com",
  projectId: "construmat",
  storageBucket: "construmat.firebasestorage.app",
  messagingSenderId: "307256306197",
  appId: "1:307256306197:web:6659c7f23d3b03ee847c1c",
  measurementId: "G-T2MCRPM0YQ",
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);

export const authReady = setPersistence(auth, browserLocalPersistence);

export default app;
