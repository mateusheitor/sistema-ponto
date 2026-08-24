import { auth, signInWithEmailAndPassword, db, doc, getDoc } from './firebase-config.js';
import { insertSVGs } from './svg.js';

const loginForm = document.getElementById('login-form');
const emailInput = document.getElementById('email');
const passwordInput = document.getElementById('password');
const errorMessage = document.getElementById('error-message');
const btnLogin = document.getElementById('btn-login');
const btnTogglePassword = document.getElementById('btn-toggle-password');

if (btnTogglePassword) {
  btnTogglePassword.addEventListener('click', () => {
    if (passwordInput.type === 'password') {
      passwordInput.type = 'text';
      btnTogglePassword.innerHTML = '<span data-icon="eye-off" class="icon-sm"></span>';
    } else {
      passwordInput.type = 'password';
      btnTogglePassword.innerHTML = '<span data-icon="eye" class="icon-sm"></span>';
    }
    insertSVGs();
  });
}

if (loginForm) {
  loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = emailInput.value;
    const password = passwordInput.value;
    
    errorMessage.classList.add('hidden');
    btnLogin.disabled = true;
    btnLogin.innerText = 'Entrando...';

    try {
      // Faz login no Firebase Auth
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;

      // Busca o documento do usuário no Firestore para saber a role
      const userDocRef = doc(db, 'users', user.uid);
      const userDocSnap = await getDoc(userDocRef);

      if (userDocSnap.exists()) {
        const userData = userDocSnap.data();
        
        // Redireciona com base na role
        if (userData.role === 'admin') {
          window.location.href = 'admin.html';
        } else {
          window.location.href = 'dashboard.html';
        }
      } else {
        throw new Error('Usuário não encontrado no banco de dados.');
      }
    } catch (error) {
      console.error('Erro no login:', error);
      errorMessage.classList.remove('hidden');
      if (error.code === 'auth/invalid-credential') {
          errorMessage.innerText = 'Email ou senha incorretos.';
      } else {
          errorMessage.innerText = 'Erro ao fazer login. Tente novamente.';
      }
    } finally {
      btnLogin.disabled = false;
      btnLogin.innerText = 'Entrar no Sistema';
    }
  });
}
