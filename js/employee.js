import {
  auth, onAuthStateChanged, signOut,
  db, collection, addDoc, query, where, getDocs, doc, getDoc, updateDoc, serverTimestamp
} from './firebase-config.js';

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
const msgEditModal   = document.getElementById('msg-edit-modal');

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
      const userDoc = await getDoc(doc(db, 'users', user.uid));
      userNameSpan.innerText = userDoc.exists() ? (userDoc.data().name || user.email) : user.email;
    } catch { userNameSpan.innerText = user.email; }

    await loadTodayRecords();
    await loadMyEditRequests();
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
    alert(`⚠️ Você já registrou o ponto de "${type}" hoje.`);
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
      alert(`⚠️ O ponto de "${type}" já foi registrado hoje.`);
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
      let msg = '⚠️ É necessário permitir o acesso à localização.';
      if (geoError.code === 1) msg = '⛔ Permissão de localização negada. Permita o acesso ao GPS e tente novamente.';
      else if (geoError.code === 2) msg = '📡 Não foi possível obter localização. Verifique sua conexão.';
      else if (geoError.code === 3) msg = '⏱️ Tempo esgotado ao obter localização. Tente novamente.';
      alert(msg);
      return;
    }

    try {
      const wsDoc = await getDoc(doc(db, 'settings', 'workspace'));
      if (wsDoc.exists()) {
        const ws = wsDoc.data();
        if (ws.latitude != null && ws.longitude != null && ws.radius) {
          const dist = calculateDistance(latitude, longitude, ws.latitude, ws.longitude);
          if (dist > ws.radius) {
            const addr = ws.address ? `\n\n📍 Local configurado: ${ws.address}` : '';
            alert(`⛔ Registro Bloqueado!\n\nVocê está fora da região do local de trabalho.\n\n• Sua distância: ${Math.round(dist)} metros\n• Raio permitido: ${ws.radius} metros${addr}\n\nAproxime-se do local de trabalho.`);
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

    alert(`<span data-icon="check" class="icon-sm"></span> Ponto registrado: ${type}`);
    await loadTodayRecords();

  } catch (error) {
    console.error('Erro ao registrar ponto:', error);
    alert('Erro ao registrar ponto. Tente novamente.');
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
        : `<button class="btn-edit-record" data-id="${data.id}" title="Solicitar edição deste registro">✏️ Editar</button>`;

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
    const snap = await getDocs(query(
      collection(db, 'edit_requests'),
      where('userId', '==', currentUser.uid),
      where('status', '==', 'pending')
    ));
    const count = snap.size;
    if (count > 0) {
      editRequestsStatus.innerHTML = `
        <div class="edit-info-box">
          <span data-icon="ampulheta" class="icon-sm"></span> Você tem <strong>${count}</strong> solicitação(ões) de edição aguardando aprovação do administrador.
        </div>`;
    } else {
      editRequestsStatus.innerHTML = '';
    }
  } catch (e) {
    console.warn('Não foi possível carregar status de edições:', e);
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
  msgEditModal.innerText  = '';
  msgEditModal.style.color = '';

  modalEdit.classList.add('active');
}

btnCloseEdit.addEventListener('click', () => modalEdit.classList.remove('active'));
modalEdit.addEventListener('click', e => { if (e.target === modalEdit) modalEdit.classList.remove('active'); });

btnSubmitEdit.addEventListener('click', async () => {
  if (!editingRecord) return;

  const newTime     = editNewTime.value.trim();
  const justification = editJustification.value.trim();

  if (!newTime) {
    msgEditModal.style.color = 'var(--danger)';
    msgEditModal.innerText   = 'Informe o horário desejado.';
    return;
  }
  if (!justification || justification.length < 5) {
    msgEditModal.style.color = 'var(--danger)';
    msgEditModal.innerText   = 'A justificativa deve ter ao menos 5 caracteres.';
    return;
  }

  btnSubmitEdit.disabled  = true;
  btnSubmitEdit.innerText = 'Enviando...';
  msgEditModal.innerText  = '';

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

    msgEditModal.style.color = 'var(--success)';
    msgEditModal.innerText   = '<span data-icon="check" class="icon-sm"></span> Solicitação enviada! Aguarde aprovação do administrador.';

    setTimeout(async () => {
      modalEdit.classList.remove('active');
      await loadTodayRecords();
      await loadMyEditRequests();
    }, 2000);

  } catch (err) {
    console.error('Erro ao enviar solicitação:', err);
    msgEditModal.style.color = 'var(--danger)';
    msgEditModal.innerText   = 'Erro ao enviar solicitação. Tente novamente.';
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
  const sign    = totalMinutes < 0 ? '-' : '';
  const abs     = Math.abs(Math.round(totalMinutes));
  const hours   = Math.floor(abs / 60);
  const minutes = abs % 60;
  return `${sign}${hours}h${minutes.toString().padStart(2, '0')}`;
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
    const startVal = document.getElementById('bh-date-start').value;
    const endVal   = document.getElementById('bh-date-end').value;
    if (!startVal || !endVal) return;
    const start = new Date(startVal + 'T00:00:00');
    const end   = new Date(endVal   + 'T23:59:59');
    if (start > end) {
      alert('A data de início deve ser anterior à data de fim.');
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

