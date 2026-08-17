import { auth, onAuthStateChanged, signOut, db, collection, query, where, getDocs, orderBy, getDoc, doc, addDoc } from './firebase-config.js';
import { setDoc } from 'https://www.gstatic.com/firebasejs/10.7.0/firebase-firestore.js';

const FIREBASE_API_KEY = 'AIzaSyAlhwyEr5-IxqvfSL6V6oUzwQ980V7_FIc';

const userNameSpan = document.getElementById('user-name');
const btnLogout = document.getElementById('btn-logout');
const filterDate = document.getElementById('filter-date');
const filterEmployee = document.getElementById('filter-employee');
const btnFilter = document.getElementById('btn-filter');
const tableBody = document.getElementById('admin-records-table-body');

// Modal elements
const modalOverlay = document.getElementById('modal-novo-user');
const btnNovoUser = document.getElementById('btn-novo-user');
const btnCloseModal = document.getElementById('btn-close-modal');
const btnCriarUser = document.getElementById('btn-criar-user');
const msgNovoUser = document.getElementById('msg-novo-user');

let currentUser = null;

// Seta data de hoje por padrão
const today = new Date().toISOString().split('T')[0];
filterDate.value = today;

// Verifica a autenticação e Role
onAuthStateChanged(auth, async (user) => {
  if (user) {
    // Verifica se é admin
    const userDocRef = doc(db, 'users', user.uid);
    const userDocSnap = await getDoc(userDocRef);
    
    if (userDocSnap.exists() && userDocSnap.data().role === 'admin') {
      currentUser = user;
      userNameSpan.innerText = user.email;
      await loadEmployees();
      await loadRecords(); // Carrega os de hoje por padrão
    } else {
      // Se não for admin, volta pro index ou dashboard
      window.location.href = 'index.html';
    }
  } else {
    window.location.href = 'index.html';
  }
});

// Logout
btnLogout.addEventListener('click', async () => {
  await signOut(auth);
  window.location.href = 'index.html';
});

// ── Modal: abrir e fechar ────────────────────────────────────────
btnNovoUser.addEventListener('click', () => {
  modalOverlay.classList.add('active');
  msgNovoUser.innerText = '';
  msgNovoUser.style.color = '';
  document.getElementById('new-name').value = '';
  document.getElementById('new-email').value = '';
  document.getElementById('new-password').value = '';
  document.getElementById('role-employee').checked = true;
});

btnCloseModal.addEventListener('click', () => modalOverlay.classList.remove('active'));
modalOverlay.addEventListener('click', (e) => { if (e.target === modalOverlay) modalOverlay.classList.remove('active'); });

// ── Criar novo usuário via Firebase Auth REST API ────────────────
// Usamos a REST API para não fazer logout do admin atual
btnCriarUser.addEventListener('click', async () => {
  const name     = document.getElementById('new-name').value.trim();
  const email    = document.getElementById('new-email').value.trim();
  const password = document.getElementById('new-password').value;
  const role     = document.querySelector('input[name="role"]:checked').value;

  if (!name || !email || !password) {
    msgNovoUser.style.color = 'var(--danger)';
    msgNovoUser.innerText = 'Preencha todos os campos.';
    return;
  }
  if (password.length < 6) {
    msgNovoUser.style.color = 'var(--danger)';
    msgNovoUser.innerText = 'A senha deve ter no mínimo 6 caracteres.';
    return;
  }

  btnCriarUser.disabled = true;
  btnCriarUser.innerText = 'Criando...';
  msgNovoUser.innerText = '';

  try {
    // 1. Cria o usuário no Firebase Auth via REST (não afeta a sessão do admin)
    const authRes = await fetch(
      `https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${FIREBASE_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, returnSecureToken: true })
      }
    );
    const authData = await authRes.json();

    if (!authRes.ok) {
      const errMsg = authData.error?.message || 'Erro desconhecido';
      throw new Error(errMsg === 'EMAIL_EXISTS' ? 'Este e-mail já está cadastrado.' : `Erro: ${errMsg}`);
    }

    const newUid = authData.localId;

    // 2. Salva o perfil no Firestore
    await setDoc(doc(db, 'users', newUid), { name, email, role });

    msgNovoUser.style.color = 'var(--success)';
    msgNovoUser.innerText = `✅ Usuário "${name}" criado com sucesso!`;

    // Recarrega o select de funcionários se for employee
    if (role === 'employee') {
      const option = document.createElement('option');
      option.value = newUid;
      option.textContent = name || email;
      filterEmployee.appendChild(option);
    }

    // Fecha o modal após 2 segundos
    setTimeout(() => modalOverlay.classList.remove('active'), 2000);

  } catch (error) {
    msgNovoUser.style.color = 'var(--danger)';
    msgNovoUser.innerText = error.message;
  } finally {
    btnCriarUser.disabled = false;
    btnCriarUser.innerText = 'Criar Usuário';
  }
});

// Carrega os funcionários para o select
async function loadEmployees() {
  try {
    const q = query(collection(db, 'users'), where('role', '==', 'employee'));
    const snapshot = await getDocs(q);
    
    snapshot.forEach(doc => {
      const data = doc.data();
      const option = document.createElement('option');
      option.value = doc.id;
      // Idealmente teria nome, vamos usar o email ou um fallback
      option.textContent = data.name || data.email;
      filterEmployee.appendChild(option);
    });
  } catch (error) {
    console.error('Erro ao carregar funcionários', error);
  }
}

// Filtra e carrega os registros
async function loadRecords() {
  const dateValue = filterDate.value; // YYYY-MM-DD
  const employeeId = filterEmployee.value;

  tableBody.innerHTML = '<tr><td colspan="5" class="text-center"><span class="loader"></span></td></tr>';

  try {
    let q;
    
    // Constrói a query SEM orderBy para evitar necessidade de índice composto no Firestore
    // A ordenação é feita no lado do cliente (JavaScript) após buscar os dados
    if (employeeId === 'all') {
      if (dateValue) {
        q = query(collection(db, 'time_records'), where('dateString', '==', dateValue));
      } else {
        q = query(collection(db, 'time_records'));
      }
    } else {
      if (dateValue) {
        q = query(collection(db, 'time_records'), where('userId', '==', employeeId), where('dateString', '==', dateValue));
      } else {
        q = query(collection(db, 'time_records'), where('userId', '==', employeeId));
      }
    }

    const snapshot = await getDocs(q);
    tableBody.innerHTML = '';
    
    if (snapshot.empty) {
      tableBody.innerHTML = '<tr><td colspan="5" class="text-center text-muted">Nenhum registro encontrado para estes filtros.</td></tr>';
      return;
    }

    // Ordena os resultados por timestamp no lado do cliente
    const records = [];
    snapshot.forEach((d) => records.push({ id: d.id, ...d.data() }));
    records.sort((a, b) => a.timestamp.toDate() - b.timestamp.toDate());

    records.forEach((data) => {
      const dateStr = data.timestamp.toDate().toLocaleDateString('pt-BR');
      const timeStr = data.timestamp.toDate().toLocaleTimeString('pt-BR');
      
      let badgeClass = '';
      if (data.type === 'Entrada') badgeClass = 'badge-entrada';
      else if (data.type.includes('Pausa')) badgeClass = 'badge-pausa';
      else if (data.type.includes('Volta')) badgeClass = 'badge-volta';
      else if (data.type === 'Saída') badgeClass = 'badge-saida';

      const tr = document.createElement('tr');

      const locationCell = (data.latitude != null && data.longitude != null)
        ? `<a href="https://www.google.com/maps?q=${data.latitude},${data.longitude}" target="_blank" rel="noopener noreferrer" title="Precisão: ±${Math.round(data.accuracy ?? 0)}m">📍 Ver no Mapa</a>`
        : '<span style="color: var(--text-muted);">—</span>';

      tr.innerHTML = `
        <td>${dateStr}</td>
        <td><strong>${data.userEmail}</strong></td>
        <td><span class="badge ${badgeClass}">${data.type}</span></td>
        <td>${timeStr}</td>
        <td>${locationCell}</td>
      `;
      tableBody.appendChild(tr);
    });

  } catch (error) {
    console.error('Erro ao buscar registros:', error);
    tableBody.innerHTML = '<tr><td colspan="5" class="text-center" style="color: var(--danger);">Erro ao carregar dados. (Você pode precisar criar um Índice no Firestore para esta Query)</td></tr>';
  }
}

// Evento do botão de filtro
btnFilter.addEventListener('click', loadRecords);
