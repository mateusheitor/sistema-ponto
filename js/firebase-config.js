

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.0/firebase-app.js";
import { getAuth, onAuthStateChanged, signInWithEmailAndPassword, signOut, updatePassword } from "https://www.gstatic.com/firebasejs/10.7.0/firebase-auth.js";
import { getFirestore, collection, addDoc, query, where, getDocs, doc, getDoc, setDoc, orderBy, updateDoc, deleteDoc, serverTimestamp, Timestamp } from "https://www.gstatic.com/firebasejs/10.7.0/firebase-firestore.js";
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

export { firebaseConfig, auth, db, storage, onAuthStateChanged, signInWithEmailAndPassword, signOut, updatePassword, collection, addDoc, query, where, getDocs, doc, getDoc, setDoc, orderBy, updateDoc, deleteDoc, serverTimestamp, Timestamp, ref, uploadBytes, getDownloadURL };

