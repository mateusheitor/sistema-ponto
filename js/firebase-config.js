// JS - Configuração e Inicialização do Firebase
// Importar as funções necessárias dos SDKs do Firebase
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.0/firebase-app.js";
import { getAuth, onAuthStateChanged, signInWithEmailAndPassword, signOut } from "https://www.gstatic.com/firebasejs/10.7.0/firebase-auth.js";
import { getFirestore, collection, addDoc, query, where, getDocs, doc, getDoc, setDoc, orderBy } from "https://www.gstatic.com/firebasejs/10.7.0/firebase-firestore.js";

// TODO: Substitua pelas configurações do seu projeto Firebase
// 1. Vá para o console do Firebase (https://console.firebase.google.com/)
// 2. Crie um novo projeto web e copie as configurações (Configuração do SDK do Firebase)
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyAlhwyEr5-IxqvfSL6V6oUzwQ980V7_FIc",
  authDomain: "sistema-ponto-ce2f0.firebaseapp.com",
  projectId: "sistema-ponto-ce2f0",
  storageBucket: "sistema-ponto-ce2f0.firebasestorage.app",
  messagingSenderId: "847620124704",
  appId: "1:847620124704:web:a28d58585306c79ba2cc45",
  measurementId: "G-N80ZPN1GD4"
};
// Inicializa o Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

export { firebaseConfig, auth, db, onAuthStateChanged, signInWithEmailAndPassword, signOut, collection, addDoc, query, where, getDocs, doc, getDoc, setDoc, orderBy };
