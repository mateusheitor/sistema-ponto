import { auth, onAuthStateChanged, signOut, db, collection, addDoc, query, where, getDocs } from './firebase-config.js';

const userNameSpan = document.getElementById('user-name');
const btnLogout = document.getElementById('btn-logout');
const clockDisplay = document.getElementById('clock');
const dateDisplay = document.getElementById('date');
const tableBody = document.getElementById('records-table-body');

// Botões de Ponto
const buttons = {
  entrada: document.getElementById('btn-entrada'),
  pausa: document.getElementById('btn-pausa'),
  volta: document.getElementById('btn-volta'),
  saida: document.getElementById('btn-saida')
};

let currentUser = null;

// Relógio em tempo real
function updateClock() {
  const now = new Date();
  clockDisplay.innerText = now.toLocaleTimeString('pt-BR');
  dateDisplay.innerText = now.toLocaleDateString('pt-BR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
}
setInterval(updateClock, 1000);
updateClock();

// Verifica a autenticação
onAuthStateChanged(auth, async (user) => {
  if (user) {
    currentUser = user;
    userNameSpan.innerText = user.email; // Idealmente seria o nome pego do Firestore
    await loadTodayRecords();
  } else {
    // Se não estiver logado, manda para o login
    window.location.href = 'index.html';
  }
});

// Logout
btnLogout.addEventListener('click', async () => {
  await signOut(auth);
  window.location.href = 'index.html';
});

// Função para registrar o ponto
async function registerPunch(type) {
  if (!currentUser) return;
  
  try {
    const now = new Date();
    await addDoc(collection(db, 'time_records'), {
      userId: currentUser.uid,
      userEmail: currentUser.email,
      timestamp: now,
      type: type,
      dateString: now.toISOString().split('T')[0] // Formato YYYY-MM-DD para busca
    });
    alert(`Ponto registrado com sucesso: ${type}`);
    await loadTodayRecords(); // Recarrega a tabela
  } catch (error) {
    console.error("Erro ao registrar ponto: ", error);
    alert('Erro ao registrar ponto. Tente novamente.');
  }
}

// Event Listeners dos Botões
buttons.entrada.addEventListener('click', () => registerPunch('Entrada'));
buttons.pausa.addEventListener('click', () => registerPunch('Pausa para Almoço'));
buttons.volta.addEventListener('click', () => registerPunch('Volta do Almoço'));
buttons.saida.addEventListener('click', () => registerPunch('Saída'));

// Carregar registros de hoje
async function loadTodayRecords() {
  if (!currentUser) return;
  tableBody.innerHTML = '<tr><td colspan="2" class="text-center"><span class="loader"></span></td></tr>';
  
  const todayStr = new Date().toISOString().split('T')[0];
  
  try {
    // Query sem orderBy para evitar necessidade de índice composto
    const q = query(
      collection(db, 'time_records'),
      where('userId', '==', currentUser.uid),
      where('dateString', '==', todayStr)
    );
    
    const querySnapshot = await getDocs(q);
    tableBody.innerHTML = '';
    
    if (querySnapshot.empty) {
      tableBody.innerHTML = '<tr><td colspan="2" class="text-center text-muted">Nenhum registro encontrado hoje.</td></tr>';
      return;
    }

    // Ordena por timestamp no cliente
    const records = [];
    querySnapshot.forEach((doc) => records.push({ id: doc.id, ...doc.data() }));
    records.sort((a, b) => a.timestamp.toDate() - b.timestamp.toDate());

    records.forEach((data) => {
      const timeStr = data.timestamp.toDate().toLocaleTimeString('pt-BR');
      
      let badgeClass = '';
      if (data.type === 'Entrada') badgeClass = 'badge-entrada';
      else if (data.type.includes('Pausa')) badgeClass = 'badge-pausa';
      else if (data.type.includes('Volta')) badgeClass = 'badge-volta';
      else if (data.type === 'Saída') badgeClass = 'badge-saida';

      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td><span class="badge ${badgeClass}">${data.type}</span></td>
        <td><strong>${timeStr}</strong></td>
      `;
      tableBody.appendChild(tr);
    });
  } catch (error) {
    console.error('Erro ao buscar registros:', error);
    tableBody.innerHTML = '<tr><td colspan="2" class="text-center" style="color: var(--danger);">Erro ao carregar dados. Verifique as permissões no Firebase.</td></tr>';
  }
}
