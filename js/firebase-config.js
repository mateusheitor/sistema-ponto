import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.0/firebase-app.js";
import { getAuth, onAuthStateChanged, signInWithEmailAndPassword, signOut, updatePassword, sendPasswordResetEmail, signInWithPhoneNumber, RecaptchaVerifier, verifyPasswordResetCode, confirmPasswordReset } from "https://www.gstatic.com/firebasejs/10.7.0/firebase-auth.js";
import { getFirestore, collection, addDoc, query, where, getDocs, doc, getDoc, setDoc, orderBy, updateDoc, deleteDoc, serverTimestamp, Timestamp, runTransaction, writeBatch } from "https://www.gstatic.com/firebasejs/10.7.0/firebase-firestore.js";
import { getStorage, ref, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/10.7.0/firebase-storage.js";

const firebaseConfig = {
  apiKey: "AIzaSyAlhwyEr5-IxqvfSL6V6oUzwQ980V7_FIc",
  authDomain: "sistema-ponto-ce2f0.firebaseapp.com",
  projectId: "sistema-ponto-ce2f0",
  storageBucket: "sistema-ponto-ce2f0.firebasestorage.app",
  messagingSenderId: "847620124704",
  appId: "1:847620124704:web:a28d58585306c79ba2cc45",
  measurementId: "G-N80ZPN1GD4"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);

// ── Item 8: Firebase App Check ────────────────────────────────────────────────
// O App Check foi temporariamente removido do código para restaurar o login.
// O erro "auth/firebase-app-check-token-is-invalid" indica que o console do Firebase
// exige um token válido, mas o domínio pode não estar configurado corretamente no reCAPTCHA.
// 
// Para reativar com segurança no futuro:
// 1. Verifique se o domínio do Vercel está no painel do reCAPTCHA admin.
// 2. Coloque o Firebase Authentication e Firestore em "Monitorando" no painel do App Check.
// 3. Adicione este código de volta:
// import { initializeAppCheck, ReCaptchaV3Provider } from "https://www.gstatic.com/firebasejs/10.7.0/firebase-app-check.js";
// initializeAppCheck(app, {
//   provider: new ReCaptchaV3Provider('SUA_CHAVE_SITE_AQUI'),
//   isTokenAutoRefreshEnabled: true,
// });

export { firebaseConfig, auth, db, storage, onAuthStateChanged, signInWithEmailAndPassword, signOut, updatePassword, sendPasswordResetEmail, signInWithPhoneNumber, RecaptchaVerifier, collection, addDoc, query, where, getDocs, doc, getDoc, setDoc, orderBy, updateDoc, deleteDoc, serverTimestamp, Timestamp, runTransaction, writeBatch, ref, uploadBytes, getDownloadURL };
