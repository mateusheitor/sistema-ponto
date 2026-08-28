import {
  auth, onAuthStateChanged, signOut, updatePassword,
  db, collection, addDoc, query, where, getDocs, doc, getDoc, updateDoc, serverTimestamp
} from './firebase-config.js';
import { insertSVGs, showToast } from './svg.js';

const userNameSpan   = document.getElementById('user-name');
const btnLogout      = document.getElementById('btn-logout');
const clockDisplay   = document.getElementById('clock');
const dateDisplay    = document.getElementById('date');
const tableBody      = document.getElementById('records-table-body');
const editRequestsStatus = document.getElementById('edit-requests-status');

const modalEdit      = document.getElementById('modal-edit-record');
const btnCloseEdit   = document.getElementById('btn-close-edit-modal');
const editInfoType   = document.getElementById('edit-info-type');
const editInfoTime   = document.getElementById('edit-info-time');
const editNewTime    = document.getElementById('edit-new-time');
const editJustification = document.getElementById('edit-justification');
const btnSubmitEdit  = document.getElementById('btn-submit-edit');


const pendingAlert   = document.getElementById('pending-alert');
const pendingAlertText = document.getElementById('pending-alert-text');
const btnResolvePending = document.getElementById('btn-resolve-pending');

const modalInsert    = document.getElementById('modal-insert-request');
const btnCloseInsert = document.getElementById('btn-close-insert-modal');
const insertDate     = document.getElementById('insert-date');
const insertType     = document.getElementById('insert-type');
const insertTime     = document.getElementById('insert-time');
const insertJustification = document.getElementById('insert-justification');
const btnSubmitInsert = document.getElementById('btn-submit-insert');

const bhTableBody    = document.getElementById('bh-table-body');
const bhTotalWorked  = document.getElementById('bh-total-worked');
const bhTotalExpected = document.getElementById('bh-total-expected');
const bhBalance      = document.getElementById('bh-balance');
const bhBalanceCard  = document.getElementById('bh-balance-card');
const bhDaysWorked   = document.getElementById('bh-days-worked');

const employeeTabBtns = document.querySelectorAll('.employee-tab-btn');
const bhPanelBtns    = document.querySelectorAll('.bh-period-btn');

const PUNCH_CONFIG = {
  'Entrada':           { btn: document.getElementById('btn-entrada'), label: 'Entrada',        registeredLabel: '✓ Entrada (Feito)' },
  'Pausa para Almoço': { btn: document.getElementById('btn-pausa'),   label: 'Pausa Almoço',   registeredLabel: '✓ Pausa (Feita)'   },
  'Volta do Almoço':   { btn: document.getElementById('btn-volta'),   label: 'Volta Almoço',   registeredLabel: '✓ Volta (Feita)'   },
  'Saída':             { btn: document.getElementById('btn-saida'),   label: 'Saída',           registeredLabel: '✓ Saída (Feita)'   }
};

const META_DIARIA_HORAS = 8;

let currentUser     = null;
let todayRegisteredTypes = new Set();
let editingRecord   = null;

function updateClock() {
  const now = new Date();
  clockDisplay.innerText = now.toLocaleTimeString('pt-BR');
  dateDisplay.innerText  = now.toLocaleDateString('pt-BR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
}
setInterval(updateClock, 1000);
updateClock();

onAuthStateChanged(auth, async (user) => {
  if (user) {
    currentUser = user;

    try {
      const userDocRef = doc(db, 'users', user.uid);
      const userDoc = await getDoc(userDocRef);
      
      if (userDoc.exists()) {
        const userData = userDoc.data();
        userNameSpan.innerText = userData.name || user.email;
        
        if (userData.firstLogin === true) {
          const modalForcePassword = document.getElementById('modal-force-password');
          const formForcePassword = document.getElementById('form-force-password');
          const fpNewPassword = document.getElementById('fp-new-password');
          const fpConfirmPassword = document.getElementById('fp-confirm-password');
          const btnSubmitFp = document.getElementById('btn-submit-force-password');

          if (modalForcePassword) {
            modalForcePassword.classList.add('active');
            
            formForcePassword.addEventListener('submit', async (e) => {
              e.preventDefault();
              const p1 = fpNewPassword.value;
              const p2 = fpConfirmPassword.value;

              if (p1.length < 6) {
                showToast('A senha deve ter no mínimo 6 caracteres.', 'warning');
                return;
              }
              if (p1 !== p2) {
                showToast('As senhas não conferem.', 'warning');
                return;
              }

              btnSubmitFp.disabled = true;
              btnSubmitFp.innerHTML = '<span data-icon="save" class="icon-sm"></span> Atualizando...';

              try {
                await updatePassword(auth.currentUser, p1);
                await updateDoc(userDocRef, { firstLogin: false });
                
                showToast('Senha atualizada com sucesso! Bem-vindo ao sistema.', 'success');
                modalForcePassword.classList.remove('active');
              } catch (error) {
                console.error('Erro ao atualizar senha:', error);
                if (error.code === 'auth/requires-recent-login') {
                  showToast('Por segurança, faça login novamente para alterar a senha.', 'error');
                  setTimeout(() => { signOut(auth); window.location.href = 'index.html'; }, 3000);
                } else {
                  showToast(`Erro ao atualizar senha: ${error.message}`, 'error');
                }
                btnSubmitFp.disabled = false;
                btnSubmitFp.innerHTML = '<span data-icon="save" class="icon-sm"></span> Atualizar Senha';
              }
            });
          }
        }
      } else {
        userNameSpan.innerText = user.email;
      }
    } catch (err) {
      console.error('Erro ao carregar dados do usuário:', err);
      userNameSpan.innerText = user.email;
    }

    await loadTodayRecords();
    await loadMyEditRequests();
    await checkPendingRecords();
    initBancoDeHoras();
  } else {
    window.location.href = 'index.html';
  }
});

btnLogout.addEventListener('click', async () => {
  await signOut(auth);
  window.location.href = 'index.html';
});

function updateButtonStates() {
  for (const [type, config] of Object.entries(PUNCH_CONFIG)) {
    if (!config.btn) continue;
    if (todayRegisteredTypes.has(type)) {
      config.btn.disabled = true;
      config.btn.classList.add('btn-registered');
      config.btn.innerText = config.registeredLabel;
    } else {
      config.btn.disabled = false;
      config.btn.classList.remove('btn-registered');
      config.btn.innerText = config.label;
    }
  }
}

function getCurrentPosition() {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('Geolocalização não é suportada por este navegador.'));
      return;
    }
    navigator.geolocation.getCurrentPosition(resolve, reject, {
      enableHighAccuracy: true, timeout: 10000, maximumAge: 0
    });
  });
}

function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371e3;
  const phi1 = lat1 * Math.PI / 180, phi2 = lat2 * Math.PI / 180;
  const dPhi = (lat2 - lat1) * Math.PI / 180;
  const dLam = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dPhi/2)**2 + Math.cos(phi1)*Math.cos(phi2)*Math.sin(dLam/2)**2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}

async function registerPunch(type) {
  if (!currentUser) return;
  const todayStr = new Date().toISOString().split('T')[0];

  if (todayRegisteredTypes.has(type)) {
    showToast(`Você já registrou o ponto de "${type}" hoje.`, 'warning');
    return;
  }

  Object.values(PUNCH_CONFIG).forEach(c => { if (c.btn) c.btn.disabled = true; });

  try {

    const checkSnap = await getDocs(query(
      collection(db, 'time_records'),
      where('userId', '==', currentUser.uid),
      where('dateString', '==', todayStr),
      where('type', '==', type)
    ));
    if (!checkSnap.empty) {
      showToast(`O ponto de "${type}" já foi registrado hoje.`, 'warning');
      await loadTodayRecords();
      return;
    }

    let latitude, longitude, accuracy;
    try {
      const pos = await getCurrentPosition();
      latitude  = pos.coords.latitude;
      longitude = pos.coords.longitude;
      accuracy  = pos.coords.accuracy;
    } catch (geoError) {
      let msg = 'É necessário permitir o acesso à localização para registrar o ponto.';
      if (geoError.code === 1) msg = 'Permissão de localização negada. Permita o acesso ao GPS nas configurações do navegador e tente novamente.';
      else if (geoError.code === 2) msg = 'Não foi possível obter sua localização. Verifique sua conexão e tente novamente.';
      else if (geoError.code === 3) msg = 'Tempo esgotado ao obter localização. Tente novamente.';
      showToast(msg, 'error');
      return;
    }

    try {
      const wsDoc = await getDoc(doc(db, 'settings', 'workspace'));
      if (wsDoc.exists()) {
        const ws = wsDoc.data();
        if (ws.latitude != null && ws.longitude != null && ws.radius) {
          const dist = calculateDistance(latitude, longitude, ws.latitude, ws.longitude);
          if (dist > ws.radius) {
            const addr = ws.address ? ` Local configurado: ${ws.address}.` : '';
            showToast(`Registro bloqueado! Você está a ${Math.round(dist)}m do local de trabalho. Raio permitido: ${ws.radius}m.${addr}`, 'error', 7000);
            return;
          }
        }
      }
    } catch (fenceErr) {
      console.warn('Cerca virtual indisponível:', fenceErr);
    }

    const now = new Date();
    await addDoc(collection(db, 'time_records'), {
      userId:     currentUser.uid,
      userEmail:  currentUser.email,
      timestamp:  now,
      type,
      dateString: todayStr,
      latitude, longitude, accuracy
    });

    showToast(`Ponto registrado: ${type}`, 'success');
    await loadTodayRecords();

  } catch (error) {
    console.error('Erro ao registrar ponto:', error);
    showToast('Erro ao registrar ponto. Tente novamente.', 'error');
  } finally {
    updateButtonStates();
  }
}

PUNCH_CONFIG['Entrada'].btn?.addEventListener('click',           () => registerPunch('Entrada'));
PUNCH_CONFIG['Pausa para Almoço'].btn?.addEventListener('click', () => registerPunch('Pausa para Almoço'));
PUNCH_CONFIG['Volta do Almoço'].btn?.addEventListener('click',   () => registerPunch('Volta do Almoço'));
PUNCH_CONFIG['Saída'].btn?.addEventListener('click',             () => registerPunch('Saída'));

async function loadTodayRecords() {
  if (!currentUser) return;
  tableBody.innerHTML = '<tr><td colspan="3" class="text-center"><span class="loader"></span></td></tr>';

  const todayStr = new Date().toISOString().split('T')[0];

  try {
    const snap = await getDocs(query(
      collection(db, 'time_records'),
      where('userId', '==', currentUser.uid),
      where('dateString', '==', todayStr)
    ));

    tableBody.innerHTML = '';
    todayRegisteredTypes.clear();

    if (snap.empty) {
      tableBody.innerHTML = '<tr><td colspan="3" class="text-center text-muted">Nenhum registro encontrado hoje.</td></tr>';
      updateButtonStates();
      return;
    }

    const records = [];
    snap.forEach(d => {
      const data = d.data();
      records.push({ id: d.id, ...data });
      if (data.type) todayRegisteredTypes.add(data.type);
    });
    records.sort((a, b) => a.timestamp.toDate() - b.timestamp.toDate());
    updateButtonStates();

    const pendingSnap = await getDocs(query(
      collection(db, 'edit_requests'),
      where('userId', '==', currentUser.uid),
      where('originalDateString', '==', todayStr),
      where('status', '==', 'pending')
    ));
    const pendingRecordIds = new Set();
    pendingSnap.forEach(d => pendingRecordIds.add(d.data().recordId));

    records.forEach(data => {
      const timeStr = data.timestamp.toDate().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

      let badgeClass = '';
      if (data.type === 'Entrada') badgeClass = 'badge-entrada';
      else if (data.type.includes('Pausa')) badgeClass = 'badge-pausa';
      else if (data.type.includes('Volta')) badgeClass = 'badge-volta';
      else if (data.type === 'Saída') badgeClass = 'badge-saida';

      const isPending = pendingRecordIds.has(data.id);
      const editBtnOrBadge = isPending
        ? `<span class="badge badge-pending" style="font-size:0.7rem;"><span data-icon="ampulheta" class="icon-sm"></span> Aguardando</span>`
        : `<button class="btn-edit-record" data-id="${data.id}" title="Solicitar edição deste registro"><span data-icon="edit" class="icon-sm"></span> Editar</button>`;

      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td><span class="badge ${badgeClass}">${data.type}</span></td>
        <td><strong>${timeStr}</strong>${data.edited ? ' <span class="badge badge-edited" style="font-size:0.7rem; margin-left:4px;">Editado</span>' : ''}</td>
        <td>${editBtnOrBadge}</td>
      `;
      tableBody.appendChild(tr);
    });

    tableBody.querySelectorAll('.btn-edit-record').forEach(btn => {
      btn.addEventListener('click', () => {
        const recId  = btn.dataset.id;
        const record = records.find(r => r.id === recId);
        if (record) openEditModal(record);
      });
    });

  } catch (error) {
    console.error('Erro ao buscar registros:', error);
    tableBody.innerHTML = '<tr><td colspan="3" class="text-center" style="color:var(--danger);">Erro ao carregar dados.</td></tr>';
    updateButtonStates();
  }
}

async function loadMyEditRequests() {
  if (!currentUser || !editRequestsStatus) return;
  try {
    const snapEdit = await getDocs(query(
      collection(db, 'edit_requests'),
      where('userId', '==', currentUser.uid),
      where('status', '==', 'pending')
    ));
    const snapInsert = await getDocs(query(
      collection(db, 'insert_requests'),
      where('userId', '==', currentUser.uid),
      where('status', '==', 'pending')
    ));
    const count = snapEdit.size + snapInsert.size;
    if (count > 0) {
      editRequestsStatus.innerHTML = `
        <div class="edit-info-box">
          <span data-icon="ampulheta" class="icon-sm"></span> Você tem <strong>${count}</strong> solicitação(ões) (edição/inserção) aguardando aprovação do administrador.
        </div>`;
    } else {
      editRequestsStatus.innerHTML = '';
    }
  } catch (e) {
    console.warn('Não foi possível carregar status de solicitações:', e);
  }
}

function openEditModal(record) {
  editingRecord = record;
  const timeStr = record.timestamp.toDate().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  editInfoType.innerText = record.type;
  editInfoTime.innerText = timeStr;

  const h = record.timestamp.toDate().getHours().toString().padStart(2, '0');
  const m = record.timestamp.toDate().getMinutes().toString().padStart(2, '0');
  editNewTime.value = `${h}:${m}`;
  editJustification.value = '';

  modalEdit.classList.add('active');
}

btnCloseEdit.addEventListener('click', () => modalEdit.classList.remove('active'));
modalEdit.addEventListener('click', e => { if (e.target === modalEdit) modalEdit.classList.remove('active'); });

btnSubmitEdit.addEventListener('click', async () => {
  if (!editingRecord) return;

  const newTime     = editNewTime.value.trim();
  const justification = editJustification.value.trim();

  if (!newTime) {
    showToast('Informe o horário desejado.', 'warning');
    return;
  }
  if (!justification || justification.length < 5) {
    showToast('A justificativa deve ter ao menos 5 caracteres.', 'warning');
    return;
  }

  btnSubmitEdit.disabled  = true;
  btnSubmitEdit.innerText = 'Enviando...';

  try {
    await addDoc(collection(db, 'edit_requests'), {
      recordId:           editingRecord.id,
      userId:             currentUser.uid,
      userEmail:          currentUser.email,
      type:               editingRecord.type,
      originalTimestamp:  editingRecord.timestamp,
      originalDateString: editingRecord.dateString,
      requestedTime:      newTime,
      justification,
      status:             'pending',
      createdAt:          new Date()
    });

    showToast('Solicitação enviada! Aguarde a aprovação do administrador.', 'success');


    setTimeout(async () => {
      modalEdit.classList.remove('active');
      await loadTodayRecords();
      await loadMyEditRequests();
    }, 2000);

  } catch (err) {
    console.error('Erro ao enviar solicitação:', err);
    showToast('Erro ao enviar solicitação. Tente novamente.', 'error');
  } finally {
    btnSubmitEdit.disabled  = false;
    btnSubmitEdit.innerText = 'Enviar Solicitação';
  }
});

employeeTabBtns.forEach(btn => {
  btn.addEventListener('click', () => {
    const targetPanel = btn.dataset.etab;
    employeeTabBtns.forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    document.querySelectorAll('.employee-tab-panel').forEach(p => {
      p.style.display = p.id === targetPanel ? 'block' : 'none';
    });
  });
});

function formatMinutes(totalMinutes) {
  const sign = totalMinutes < 0 ? '-' : '';
  const abs = Math.abs(Math.round(totalMinutes));
  const hours = Math.floor(abs / 60);
  const minutes = abs % 60;
  return `${sign}${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}

function toDateStr(date) {
  return date.toISOString().split('T')[0];
}

function currentWeekRange() {
  const now   = new Date();
  const day   = now.getDay();
  const diffStart = (day === 0) ? -6 : 1 - day;
  const start = new Date(now);
  start.setDate(now.getDate() + diffStart);
  start.setHours(0, 0, 0, 0);
  const end   = new Date(start);
  end.setDate(start.getDate() + 6);
  end.setHours(23, 59, 59, 999);
  return { start, end };
}

function currentMonthRange() {
  const now   = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  const end   = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
  return { start, end };
}

function monthRange(yearMonthStr) {
  const [y, m] = yearMonthStr.split('-').map(Number);
  const start  = new Date(y, m - 1, 1);
  const end    = new Date(y, m, 0, 23, 59, 59, 999);
  return { start, end };
}

function calcBancoDeHoras(records) {

  const byDay = {};
  records.forEach(r => {
    const ds = r.dateString;
    if (!byDay[ds]) byDay[ds] = {};
    byDay[ds][r.type] = r.timestamp.toDate();
  });

  const days = Object.keys(byDay).sort();

  return days.map(ds => {
    const d      = byDay[ds];
    const entrada = d['Entrada'];
    const pausa   = d['Pausa para Almoço'];
    const volta   = d['Volta do Almoço'];
    const saida   = d['Saída'];

    let workedMin = 0;

    if (entrada && saida) {
      const totalMin = (saida - entrada) / 60000;
      const pauseMin = (pausa && volta) ? (volta - pausa) / 60000 : 0;
      workedMin = totalMin - pauseMin;
    } else if (entrada && pausa) {

      workedMin = (pausa - entrada) / 60000;
    } else if (volta && saida) {

      workedMin = (saida - volta) / 60000;
    }

    const metaMin    = META_DIARIA_HORAS * 60;
    const balanceMin = workedMin - metaMin;

    const fmt = t => t ? t.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : '—';

    return {
      dateString: ds,
      dateLabel:  new Date(ds + 'T12:00:00').toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: '2-digit' }),
      entrada:    fmt(entrada),
      pausa:      fmt(pausa),
      volta:      fmt(volta),
      saida:      fmt(saida),
      workedMin,
      balanceMin,
      hasData:    workedMin > 0
    };
  });
}

async function loadBancoDeHoras(start, end) {
  if (!currentUser) return;

  bhTableBody.innerHTML = '<tr><td colspan="7" class="text-center"><span class="loader"></span></td></tr>';
  bhTotalWorked.innerText   = '--';
  bhTotalExpected.innerText = '--';
  bhBalance.innerText       = '--';
  bhDaysWorked.innerText    = '--';

  const startStr = toDateStr(start);
  const endStr   = toDateStr(end);

  try {

    const snap = await getDocs(query(
      collection(db, 'time_records'),
      where('userId', '==', currentUser.uid)
    ));

    const records = [];
    snap.forEach(d => {
      const data = d.data();
      if (data.dateString >= startStr && data.dateString <= endStr) {
        records.push({ id: d.id, ...data });
      }
    });

    if (records.length === 0) {
      bhTableBody.innerHTML = `<tr><td colspan="7" class="text-center text-muted">Nenhum registro neste período (${startStr} a ${endStr}).</td></tr>`;
      bhTotalWorked.innerText   = '0h00';
      bhTotalExpected.innerText = '0h00';
      bhBalance.innerText       = '0h00';
      bhDaysWorked.innerText    = '0';
      return;
    }

    const days = calcBancoDeHoras(records);

    let totalWorkedMin   = 0;
    let daysWithData     = 0;

    bhTableBody.innerHTML = '';

    days.forEach(day => {
      totalWorkedMin += day.workedMin;
      if (day.hasData) daysWithData++;

      const balClass = day.balanceMin >= 0 ? '#065f46' : '#991b1b';
      const balSign  = day.balanceMin >= 0 ? '+' : '';

      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td style="font-weight:500; white-space:nowrap;">${day.dateLabel}</td>
        <td>${day.entrada}</td>
        <td>${day.pausa}</td>
        <td>${day.volta}</td>
        <td>${day.saida}</td>
        <td><strong>${day.hasData ? formatMinutes(day.workedMin) : '—'}</strong></td>
        <td style="color:${day.hasData ? balClass : 'var(--text-muted)'}; font-weight:600;">
          ${day.hasData ? balSign + formatMinutes(day.balanceMin) : '—'}
        </td>
      `;
      bhTableBody.appendChild(tr);
    });

    const totalExpectedMin  = daysWithData * META_DIARIA_HORAS * 60;
    const totalBalanceMin   = totalWorkedMin - totalExpectedMin;

    bhTotalWorked.innerText   = formatMinutes(totalWorkedMin);
    bhTotalExpected.innerText = formatMinutes(totalExpectedMin);
    bhBalance.innerText       = (totalBalanceMin >= 0 ? '+' : '') + formatMinutes(totalBalanceMin);
    bhDaysWorked.innerText    = daysWithData;

    bhBalanceCard.classList.remove('positive', 'negative', 'neutral');
    if (totalBalanceMin > 0)       bhBalanceCard.classList.add('positive');
    else if (totalBalanceMin < 0)  bhBalanceCard.classList.add('negative');
    else                           bhBalanceCard.classList.add('neutral');

  } catch (err) {
    console.error('Erro ao carregar banco de horas:', err);
    bhTableBody.innerHTML = '<tr><td colspan="7" class="text-center" style="color:var(--danger);">Erro ao carregar dados. Verifique as permissões no Firebase.</td></tr>';
  }
}

function initBancoDeHoras() {

  const now = new Date();
  const ymStr = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`;
  document.getElementById('bh-month-input').value = ymStr;

  const { start: ws, end: we } = currentWeekRange();
  document.getElementById('bh-date-start').value = toDateStr(ws);
  document.getElementById('bh-date-end').value   = toDateStr(now);

  bhPanelBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      bhPanelBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');

      const period = btn.dataset.period;

      document.getElementById('bh-range-month').classList.remove('visible');
      document.getElementById('bh-range-custom').classList.remove('visible');

      if (period === 'week') {
        const { start, end } = currentWeekRange();
        loadBancoDeHoras(start, end);

      } else if (period === 'month') {
        const { start, end } = currentMonthRange();
        loadBancoDeHoras(start, end);

      } else if (period === 'custom-month') {
        document.getElementById('bh-range-month').classList.add('visible');

      } else if (period === 'custom-range') {
        document.getElementById('bh-range-custom').classList.add('visible');
      }
    });
  });

  document.getElementById('bh-apply-month').addEventListener('click', () => {
    const val = document.getElementById('bh-month-input').value;
    if (!val) return;
    const { start, end } = monthRange(val);
    loadBancoDeHoras(start, end);
  });

  document.getElementById('bh-apply-range').addEventListener('click', () => {
    const sv = document.getElementById('bh-date-start').value;
    const ev = document.getElementById('bh-date-end').value;
    if (!sv || !ev) return;
    const start = new Date(sv + 'T00:00:00'), end = new Date(ev + 'T23:59:59');
    if (start > end) {
      showToast('A data de início deve ser anterior à data de fim.', 'warning');
      return;
    }
    loadBancoDeHoras(start, end);
  });

  const bhTabBtn = document.getElementById('etab-btn-bh');
  bhTabBtn.addEventListener('click', () => {

    if (bhTotalWorked.innerText === '--') {
      const { start, end } = currentWeekRange();
      loadBancoDeHoras(start, end);
    }
  });
}

let pendingDaysData = {}; 

async function checkPendingRecords() {
  if (!currentUser) return;
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  const end = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
  
  if (end < start) {
    pendingAlert.style.display = 'none';
    return; 
  }

  const startStr = toDateStr(start);
  const endStr = toDateStr(end);

  try {
    const recordsSnap = await getDocs(query(
      collection(db, 'time_records'),
      where('userId', '==', currentUser.uid)
    ));
    const requestsSnap = await getDocs(query(
      collection(db, 'insert_requests'),
      where('userId', '==', currentUser.uid),
      where('status', '==', 'pending')
    ));

    const recordsByDay = {};
    recordsSnap.forEach(d => {
      const data = d.data();
      if (data.dateString >= startStr && data.dateString <= endStr) {
        if (!recordsByDay[data.dateString]) recordsByDay[data.dateString] = new Set();
        recordsByDay[data.dateString].add(data.type);
      }
    });

    const pendingRequestsByDay = {};
    requestsSnap.forEach(d => {
      const data = d.data();
      if (data.requestedDateString >= startStr && data.requestedDateString <= endStr) {
        if (!pendingRequestsByDay[data.requestedDateString]) pendingRequestsByDay[data.requestedDateString] = new Set();
        pendingRequestsByDay[data.requestedDateString].add(data.type);
      }
    });

    pendingDaysData = {};
    const ALL_TYPES = ['Entrada', 'Pausa para Almoço', 'Volta do Almoço', 'Saída'];

    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      if (d.getDay() === 0 || d.getDay() === 6) continue;

      const ds = toDateStr(d);
      const existing = recordsByDay[ds] || new Set();
      const requested = pendingRequestsByDay[ds] || new Set();

      const missing = ALL_TYPES.filter(t => !existing.has(t) && !requested.has(t));
      
      if (missing.length > 0) {
        pendingDaysData[ds] = missing;
      }
    }

    const pendingDates = Object.keys(pendingDaysData).sort();
    if (pendingDates.length > 0) {
      const fmtDates = pendingDates.map(ds => {
        const parts = ds.split('-');
        return `${parts[2]}/${parts[1]}`;
      }).join(', ');
      
      pendingAlertText.innerText = `Você possui marcações pendentes nos dias: ${fmtDates}.`;
      pendingAlert.style.display = 'block';

      insertDate.innerHTML = '<option value="">Selecione uma data</option>';
      pendingDates.forEach(ds => {
        const parts = ds.split('-');
        const opt = document.createElement('option');
        opt.value = ds;
        opt.textContent = `${parts[2]}/${parts[1]}/${parts[0]}`;
        insertDate.appendChild(opt);
      });
    } else {
      pendingAlert.style.display = 'none';
    }

  } catch (error) {
    console.error('Error checking pending records:', error);
  }
}

if (btnResolvePending) {
  btnResolvePending.addEventListener('click', () => {
    modalInsert.classList.add('active');
  });
}

if (btnCloseInsert) {
  btnCloseInsert.addEventListener('click', () => {
    modalInsert.classList.remove('active');
  });
}

if (insertDate) {
  insertDate.addEventListener('change', () => {
    const ds = insertDate.value;
    insertType.innerHTML = '<option value="">Selecione o tipo</option>';
    if (ds && pendingDaysData[ds]) {
      insertType.disabled = false;
      pendingDaysData[ds].forEach(type => {
        const opt = document.createElement('option');
        opt.value = type;
        opt.textContent = type;
        insertType.appendChild(opt);
      });
    } else {
      insertType.disabled = true;
    }
  });
}

if (document.getElementById('form-insert-request')) {
  document.getElementById('form-insert-request').addEventListener('submit', async (e) => {
    e.preventDefault();
    const ds = insertDate.value;
    const type = insertType.value;
    const time = insertTime.value;
    const just = insertJustification.value.trim();

    if (!ds || !type || !time || !just) {
      showToast('Preencha todos os campos obrigatórios.', 'warning');
      return;
    }

    btnSubmitInsert.disabled = true;
    btnSubmitInsert.innerHTML = '<span class="loader" style="width:16px;height:16px;border-width:2px;border-top-color:transparent;display:inline-block;vertical-align:middle;margin-right:8px;"></span> Enviando...';

    try {
      await addDoc(collection(db, 'insert_requests'), {
        userId: currentUser.uid,
        userEmail: currentUser.email,
        type: type,
        requestedDateString: ds,
        requestedTime: time,
        justification: just,
        status: 'pending',
        createdAt: serverTimestamp()
      });
      showToast('Solicitação de inserção enviada com sucesso.', 'success');
      modalInsert.classList.remove('active');
      document.getElementById('form-insert-request').reset();
      insertType.disabled = true;
      await checkPendingRecords();
      await loadMyEditRequests();
    } catch (error) {
      console.error('Error submitting insert request:', error);
      showToast('Erro ao enviar solicitação.', 'error');
    } finally {
      btnSubmitInsert.disabled = false;
      btnSubmitInsert.innerText = 'Enviar Solicitação';
    }
  });
}
