import { auth, onAuthStateChanged, signOut, db, collection, addDoc, query, where, getDocs, doc, getDoc } from './firebase-config.js';

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

// Obtém a geolocalização atual como Promise
function getCurrentPosition() {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('Geolocalização não é suportada por este navegador.'));
      return;
    }
    navigator.geolocation.getCurrentPosition(resolve, reject, {
      enableHighAccuracy: true,
      timeout: 10000,
      maximumAge: 0
    });
  });
}

// Calcula a distância em metros entre duas coordenadas GPS (Fórmula de Haversine)
function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371e3; // Raio da Terra em metros
  const phi1 = lat1 * Math.PI / 180;
  const phi2 = lat2 * Math.PI / 180;
  const deltaPhi = (lat2 - lat1) * Math.PI / 180;
  const deltaLambda = (lon2 - lon1) * Math.PI / 180;

  const a = Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
            Math.cos(phi1) * Math.cos(phi2) *
            Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c; // Distância em metros
}

// Função para registrar o ponto
async function registerPunch(type) {
  if (!currentUser) return;

  // Desabilita todos os botões durante o processo
  Object.values(buttons).forEach(btn => btn.disabled = true);

  try {
    // 1. Obtém a localização — obrigatória para bater o ponto
    let latitude, longitude, accuracy;
    try {
      const position = await getCurrentPosition();
      latitude  = position.coords.latitude;
      longitude = position.coords.longitude;
      accuracy  = position.coords.accuracy;
    } catch (geoError) {
      let msg = 'É necessário permitir o acesso à localização para registrar o ponto.';
      if (geoError.code === 1) {
        msg = '⛔ Permissão de localização negada. Permita o acesso ao GPS nas configurações do navegador e tente novamente.';
      } else if (geoError.code === 2) {
        msg = '📡 Não foi possível determinar sua localização. Verifique sua conexão e tente novamente.';
      } else if (geoError.code === 3) {
        msg = '⏱️ Tempo esgotado ao obter a localização. Tente novamente.';
      }
      alert(msg);
      return; // Bloqueia o registro
    }

    // 2. Verifica a Cerca Virtual (Geofencing) configurada pelo Administrador
    try {
      const workspaceDoc = await getDoc(doc(db, 'settings', 'workspace'));
      if (workspaceDoc.exists()) {
        const workspace = workspaceDoc.data();
        if (workspace.latitude != null && workspace.longitude != null && workspace.radius) {
          const distance = calculateDistance(latitude, longitude, workspace.latitude, workspace.longitude);

          if (distance > workspace.radius) {
            const distanceFormatted = Math.round(distance);
            const addressInfo = workspace.address ? `\n\n📍 Local configurado: ${workspace.address}` : '';
            alert(`⛔ Registro Bloqueado!\n\nVocê está fora da região do local de trabalho.\n\n• Sua distância: ${distanceFormatted} metros\n• Raio permitido: ${workspace.radius} metros${addressInfo}\n\nAproxime-se do local de trabalho para conseguir bater o ponto.`);
            return; // Bloqueia o registro
          }
        }
      }
    } catch (fenceError) {
      console.warn('Aviso: Não foi possível validar a cerca geográfica no momento:', fenceError);
      // Se houver erro de leitura das configurações, pode continuar ou registrar aviso
    }

    // 3. Salva o ponto com as coordenadas no Firestore
    const now = new Date();
    await addDoc(collection(db, 'time_records'), {
      userId: currentUser.uid,
      userEmail: currentUser.email,
      timestamp: now,
      type: type,
      dateString: now.toISOString().split('T')[0], // Formato YYYY-MM-DD para busca
      latitude,
      longitude,
      accuracy
    });

    alert(`✅ Ponto registrado com sucesso: ${type}`);
    await loadTodayRecords(); // Recarrega a tabela

  } catch (error) {
    console.error("Erro ao registrar ponto: ", error);
    alert('Erro ao registrar ponto. Tente novamente.');
  } finally {
    // Reabilita os botões ao finalizar
    Object.values(buttons).forEach(btn => btn.disabled = false);
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
