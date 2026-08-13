import { auth, onAuthStateChanged, signOut, db, collection, query, where, getDocs, orderBy, getDoc, doc } from './firebase-config.js';

const userNameSpan = document.getElementById('user-name');
const btnLogout = document.getElementById('btn-logout');
const filterDate = document.getElementById('filter-date');
const filterEmployee = document.getElementById('filter-employee');
const btnFilter = document.getElementById('btn-filter');
const tableBody = document.getElementById('admin-records-table-body');

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

  tableBody.innerHTML = '<tr><td colspan="4" class="text-center"><span class="loader"></span></td></tr>';

  try {
    let q;
    
    // Constrói a query com base nos filtros
    if (employeeId === 'all') {
      if (dateValue) {
        q = query(collection(db, 'time_records'), where('dateString', '==', dateValue), orderBy('timestamp', 'asc'));
      } else {
        // Se não tiver data, pega os últimos 50 (simplificação, Firestore exige índice para queries complexas)
        q = query(collection(db, 'time_records'), orderBy('timestamp', 'desc')); 
      }
    } else {
      if (dateValue) {
        q = query(collection(db, 'time_records'), where('userId', '==', employeeId), where('dateString', '==', dateValue), orderBy('timestamp', 'asc'));
      } else {
        q = query(collection(db, 'time_records'), where('userId', '==', employeeId), orderBy('timestamp', 'desc'));
      }
    }

    const snapshot = await getDocs(q);
    tableBody.innerHTML = '';
    
    if (snapshot.empty) {
      tableBody.innerHTML = '<tr><td colspan="4" class="text-center text-muted">Nenhum registro encontrado para estes filtros.</td></tr>';
      return;
    }

    snapshot.forEach((doc) => {
      const data = doc.data();
      const dateStr = data.timestamp.toDate().toLocaleDateString('pt-BR');
      const timeStr = data.timestamp.toDate().toLocaleTimeString('pt-BR');
      
      let badgeClass = '';
      if (data.type === 'Entrada') badgeClass = 'badge-entrada';
      else if (data.type.includes('Pausa')) badgeClass = 'badge-pausa';
      else if (data.type.includes('Volta')) badgeClass = 'badge-volta';
      else if (data.type === 'Saída') badgeClass = 'badge-saida';

      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${dateStr}</td>
        <td><strong>${data.userEmail}</strong></td>
        <td><span class="badge ${badgeClass}">${data.type}</span></td>
        <td>${timeStr}</td>
      `;
      tableBody.appendChild(tr);
    });

  } catch (error) {
    console.error('Erro ao buscar registros:', error);
    tableBody.innerHTML = '<tr><td colspan="4" class="text-center" style="color: var(--danger);">Erro ao carregar dados. (Você pode precisar criar um Índice no Firestore para esta Query)</td></tr>';
  }
}

// Evento do botão de filtro
btnFilter.addEventListener('click', loadRecords);
