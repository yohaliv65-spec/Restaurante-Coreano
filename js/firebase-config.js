
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth, GoogleAuthProvider } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyCoqmxaj7Jg1xE5wD6ZclqpjtHuJkwI15o",
  authDomain: "restaurante-coreano.firebaseapp.com",
  projectId: "restaurante-coreano",
  storageBucket: "restaurante-coreano.firebasestorage.app",
  messagingSenderId: "657233762705",
  appId: "1:657233762705:web:9e9bc7c5163bfb112b6230",
  measurementId: "G-8XNV12YMR3"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const googleProvider = new GoogleAuthProvider();

export const ADMIN_EMAILS = [
  "yohaliv65@gmail.com"  
];