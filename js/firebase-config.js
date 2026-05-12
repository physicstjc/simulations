// Firebase configuration for Physics Simulations
// The API key is intentionally in client-side code — this is the standard Firebase web
// pattern. Security is enforced by Firestore Security Rules, not by the API key.
// Required Firestore rules (set in Firebase Console -> Firestore -> Rules):
//
//   rules_version = '2';
//   service cloud.firestore {
//     match /databases/{database}/documents {
//       match /simulations/{simId} {
//         allow read: if true;              // public read
//         allow write: if request.auth != null
//           && (
//             request.auth.token.email == 'wboson2007@gmail.com'
//             || request.auth.token.email.matches('.*@moe\\.edu\\.sg$')
//           );
//       }
//
//       match /auditLogs/{logId} {
//         allow create: if request.auth != null
//           && (
//             request.auth.token.email == 'wboson2007@gmail.com'
//             || request.auth.token.email.matches('.*@moe\\.edu\\.sg$')
//           );
//         allow read: if request.auth != null
//           && (
//             request.auth.token.email == 'wboson2007@gmail.com'
//             || request.auth.token.email.matches('.*@moe\\.edu\\.sg$')
//           );
//         allow update, delete: if false;
//       }
//     }
//   }

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js";

const firebaseConfig = {
  apiKey: "AIzaSyB5yRAy0P8fm3ntdnAT8GMMRLShy1mCGk0",
  authDomain: "simulations-8798d.firebaseapp.com",
  projectId: "simulations-8798d",
  storageBucket: "simulations-8798d.firebasestorage.app",
  messagingSenderId: "347758246308",
  appId: "1:347758246308:web:93481785d61d7222dbe931",
  measurementId: "G-LYQ8R8WR9M"
};

export const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);
