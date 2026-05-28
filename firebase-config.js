// ============================================================
//  firebase-config.js
//  Replace the firebaseConfig object with YOUR project values.
//  Get them from: Firebase Console → Project Settings → General
// ============================================================

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth, GoogleAuthProvider } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const firebaseConfig = {
    apiKey:            "AIzaSyBwER6jCb2WBnO8obXmsVD-FHksH16n0bo",
    authDomain:        "sparkchat-b278d.firebaseapp.com",
    projectId:         "sparkchat-b278d",
    storageBucket:     "sparkchat-b278d.firebasestorage.app",
    messagingSenderId: "570398289246",
    appId:             "1:570398289246:web:e5ae03430150aac87973cf"
};

const app      = initializeApp(firebaseConfig);
export const auth     = getAuth(app);
export const db       = getFirestore(app);
export const googleProvider = new GoogleAuthProvider();