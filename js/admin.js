import {
  firebaseConfig, auth, onAuthStateChanged, signOut,
  db, collection, query, where, getDocs, orderBy,
  getDoc, doc, setDoc, addDoc, updateDoc, serverTimestamp
} from './firebase-config.js';

const userNameSpan   = document.getElementById('user-name');
const btnLogout      = document.getElementById('btn-logout');
const filterDate     = document.getElementById('filter-date');
const filterEmployee = document.getElementById('filter-employee');
const btnFilter      = document.getElementById('btn-filter');
const tableBody      = document.getElementById('admin-records-table-body');

const workspaceAddress = document.getElementById('workspace-address');
const btnSearchAddress = document.getElementById('btn-search-address');
const workspaceRadius  = document.getElementById('workspace-radius');
const workspaceLat     = document.getElementById('workspace-lat');
const workspaceLng     = document.getElementById('workspace-lng');
const btnSaveWorkspace = document.getElementById('btn-save-workspace');
const msgWorkspace     = document.getElementById('msg-workspace');

const modalOverlay  = document.getElementById('modal-novo-user');
const btnNovoUser   = document.getElementById('btn-novo-user');
const btnCloseModal = document.getElementById('btn-close-modal');
const btnCriarUser  = document.getElementById('btn-criar-user');
const msgNovoUser   = document.getElementById('msg-novo-user');

const modalReject      = document.getElementById('modal-reject');
const btnCloseReject   = document.getElementById('btn-close-reject-modal');
const btnCancelReject  = document.getElementById('btn-cancel-reject');
const btnConfirmReject = document.getElementById('btn-confirm-reject');
const rejectReason     = document.getElementById('reject-reason');
const msgReject        = document.getElementById('msg-reject');
const rejectInfoUser   = document.getElementById('reject-info-user');
const rejectInfoType   = document.getElementById('reject-info-type');
const rejectInfoTime   = document.getElementById('reject-info-time');
const rejectInfoJust   = document.getElementById('reject-info-just');

const editRequestsTableBody = document.getElementById('edit-requests-table-body');
const pendingDot            = document.getElementById('pending-dot');

const adminBhTableBody    = document.getElementById('admin-bh-table-body');
const adminBhTotalWorked  = document.getElementById('admin-bh-total-worked');
const adminBhTotalExpected = document.getElementById('admin-bh-total-expected');
const adminBhBalance      = document.getElementById('admin-bh-balance');
const adminBhBalanceCard  = document.getElementById('admin-bh-balance-card');
const adminBhDaysWorked   = document.getElementById('admin-bh-days-worked');
const bhFilterEmployee    = document.getElementById('bh-filter-employee');

let currentUser      = null;
let rejectingRequest = null;
const META_DIARIA_HORAS = 8;

const today = new Date().toISOString().split('T')[0];
filterDate.value = today;

onAuthStateChanged(auth, async (user) => {
  if (user) {
    const userDocRef  = doc(db, 'users', user.uid);
    const userDocSnap = await getDoc(userDocRef);

    if (userDocSnap.exists() && userDocSnap.data().role === 'admin') {
      currentUser = user;
      userNameSpan.innerText = userDocSnap.data().name || user.email;
      await loadWorkspaceSettings();
      await loadEmployees();
      await loadRecords();
      await loadEditRequests();
      initAdminBancoDeHoras();
    } else {
      window.location.href = 'index.html';
    }
  } else {
    window.location.href = 'index.html';
  }
});

btnLogout.addEventListener('click', async () => {
  await signOut(auth);
  window.location.href = 'index.html';
});

document.querySelectorAll('.tab-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    const target = btn.dataset.tab;
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById(target).classList.add('active');

    if (target === 'tab-workspace' && leafletMap) {
      setTimeout(() => leafletMap.invalidateSize(), 200);
    }
  });
});

btnNovoUser.addEventListener('click', () => {
  modalOverlay.classList.add('active');
  msgNovoUser.innerText  = '';
  msgNovoUser.style.color = '';
  document.getElementById('new-name').value     = '';
  document.getElementById('new-email').value    = '';
  document.getElementById('new-password').value = '';
  document.getElementById('role-employee').checked = true;
});

btnCloseModal.addEventListener('click', () => modalOverlay.classList.remove('active'));
modalOverlay.addEventListener('click', e => { if (e.target === modalOverlay) modalOverlay.classList.remove('active'); });

btnCriarUser.addEventListener('click', async () => {
  const name     = document.getElementById('new-name').value.trim();
  const email    = document.getElementById('new-email').value.trim();
  const password = document.getElementById('new-password').value;
  const role     = document.querySelector('input[name="role"]:checked').value;

  if (!name || !email || !password) {
    msgNovoUser.style.color = 'var(--danger)';
    msgNovoUser.innerText   = 'Preencha todos os campos.';
    return;
  }
  if (password.length < 6) {
    msgNovoUser.style.color = 'var(--danger)';
    msgNovoUser.innerText   = 'A senha deve ter no mínimo 6 caracteres.';
    return;
  }

  btnCriarUser.disabled  = true;
  btnCriarUser.innerText = 'Criando...';
  msgNovoUser.innerText  = '';

  try {
    const authRes = await fetch(
      `https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${firebaseConfig.apiKey}`,
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
    await setDoc(doc(db, 'users', newUid), { name, email, role });

    msgNovoUser.style.color = 'var(--success)';
    msgNovoUser.innerText   = `<span data-icon="check" class="icon-sm"></span> Usuário "${name}" criado com sucesso!`;

    if (role === 'employee') {
      [filterEmployee, bhFilterEmployee].forEach(sel => {
        const opt = document.createElement('option');
        opt.value       = newUid;
        opt.textContent = name || email;
        sel.appendChild(opt);
      });
    }

    setTimeout(() => modalOverlay.classList.remove('active'), 2000);

  } catch (error) {
    msgNovoUser.style.color = 'var(--danger)';
    msgNovoUser.innerText   = error.message;
  } finally {
    btnCriarUser.disabled  = false;
    btnCriarUser.innerText = 'Criar Usuário';
  }
});

async function loadEmployees() {
  try {
    const snap = await getDocs(query(collection(db, 'users'), where('role', '==', 'employee')));
    snap.forEach(d => {
      const data = d.data();
      [filterEmployee, bhFilterEmployee].forEach(sel => {
        const opt = document.createElement('option');
        opt.value       = d.id;
        opt.textContent = data.name || data.email;
        sel.appendChild(opt);
      });
    });
  } catch (err) {
    console.error('Erro ao carregar funcionários', err);
  }
}

async function loadRecords() {
  const dateValue  = filterDate.value;
  const employeeId = filterEmployee.value;

  tableBody.innerHTML = '<tr><td colspan="5" class="text-center"><span class="loader"></span></td></tr>';

  try {
    let q;
    if (employeeId === 'all') {
      q = dateValue
        ? query(collection(db, 'time_records'), where('dateString', '==', dateValue))
        : query(collection(db, 'time_records'));
    } else {
      q = dateValue
        ? query(collection(db, 'time_records'), where('userId', '==', employeeId), where('dateString', '==', dateValue))
        : query(collection(db, 'time_records'), where('userId', '==', employeeId));
    }

    const snapshot = await getDocs(q);
    tableBody.innerHTML = '';

    if (snapshot.empty) {
      tableBody.innerHTML = '<tr><td colspan="5" class="text-center text-muted">Nenhum registro encontrado para estes filtros.</td></tr>';
      return;
    }

    const records = [];
    snapshot.forEach(d => records.push({ id: d.id, ...d.data() }));
    records.sort((a, b) => a.timestamp.toDate() - b.timestamp.toDate());

    records.forEach(data => {
      const dateStr = data.timestamp.toDate().toLocaleDateString('pt-BR');
      const timeStr = data.timestamp.toDate().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

      let badgeClass = '';
      if (data.type === 'Entrada') badgeClass = 'badge-entrada';
      else if (data.type.includes('Pausa')) badgeClass = 'badge-pausa';
      else if (data.type.includes('Volta')) badgeClass = 'badge-volta';
      else if (data.type === 'Saída') badgeClass = 'badge-saida';

      const locationCell = (data.latitude != null && data.longitude != null)
        ? `<a href="https://www.google.com/maps?q=${data.latitude},${data.longitude}" target="_blank" rel="noopener noreferrer" title="Precisão: ±${Math.round(data.accuracy ?? 0)}m">📍 Ver no Mapa</a>`
        : '<span style="color: var(--text-muted);">—</span>';

      const editedBadge = data.edited
        ? ` <span class="badge badge-edited" style="font-size:0.7rem; margin-left:4px;">Editado</span>` : '';

      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${dateStr}</td>
        <td><strong>${data.userEmail || data.userId}</strong></td>
        <td><span class="badge ${badgeClass}">${data.type}</span>${editedBadge}</td>
        <td>${timeStr}</td>
        <td>${locationCell}</td>
      `;
      tableBody.appendChild(tr);
    });

  } catch (error) {
    console.error('Erro ao buscar registros:', error);
    tableBody.innerHTML = '<tr><td colspan="5" class="text-center" style="color: var(--danger);">Erro ao carregar dados.</td></tr>';
  }
}

btnFilter.addEventListener('click', loadRecords);

async function loadEditRequests() {
  editRequestsTableBody.innerHTML = '<tr><td colspan="7" class="text-center"><span class="loader"></span></td></tr>';

  try {
    const snap = await getDocs(query(collection(db, 'edit_requests')));
    const requests = [];
    snap.forEach(d => requests.push({ id: d.id, ...d.data() }));
    requests.sort((a, b) => {
      const aTime = a.createdAt?.toDate?.() ?? new Date(0);
      const bTime = b.createdAt?.toDate?.() ?? new Date(0);
      return bTime - aTime;
    });

    const pendingCount = requests.filter(r => r.status === 'pending').length;
    if (pendingDot) pendingDot.style.display = pendingCount > 0 ? 'inline-block' : 'none';

    editRequestsTableBody.innerHTML = '';

    if (requests.length === 0) {
      editRequestsTableBody.innerHTML = '<tr><td colspan="7" class="text-center text-muted">Nenhuma solicitação encontrada.</td></tr>';
      return;
    }

    requests.forEach(req => {
      const origTime = req.originalTimestamp?.toDate
        ? req.originalTimestamp.toDate().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
        : '—';
      const createdAt = req.createdAt?.toDate
        ? req.createdAt.toDate().toLocaleString('pt-BR')
        : '—';

      const statusMap = {
        pending:  '<span class="badge badge-pending"><span data-icon="ampulheta" class="icon-sm"></span> Pendente</span>',
        approved: '<span class="badge badge-approved"><span data-icon="check" class="icon-sm"></span> Aprovado</span>',
        rejected: '<span class="badge badge-rejected"><span data-icon="deni" class="icon-sm"></span> Rejeitado</span>'
      };
      const statusBadge = statusMap[req.status] || req.status;

      const actions = req.status === 'pending'
        ? `<div class="edit-action-btns">
             <button class="btn btn-approve btn-sm" data-id="${req.id}"><span data-icon="check" class="icon-sm"></span> Aprovar</button>
             <button class="btn btn-reject  btn-sm" data-id="${req.id}"><span data-icon="deni" class="icon-sm"></span> Rejeitar</button>
           </div>`
        : `<span style="font-size:0.8rem; color:var(--text-muted);">${req.resolvedAt?.toDate ? req.resolvedAt.toDate().toLocaleDateString('pt-BR') : '—'}</span>`;

      const tr = document.createElement('tr');
      tr.dataset.reqId = req.id;
      tr.innerHTML = `
        <td style="font-size:0.875rem;">${req.userEmail || req.userId}</td>
        <td><span class="badge ${req.type === 'Entrada' ? 'badge-entrada' : req.type.includes('Pausa') ? 'badge-pausa' : req.type.includes('Volta') ? 'badge-volta' : 'badge-saida'}">${req.type}</span></td>
        <td>${origTime}<br><small style="color:var(--text-muted);">${req.originalDateString || ''}</small></td>
        <td><strong>${req.requestedTime}</strong></td>
        <td style="font-size:0.8125rem; max-width:200px;">${req.justification}</td>
        <td>${statusBadge}</td>
        <td>${actions}</td>
      `;
      editRequestsTableBody.appendChild(tr);
    });

    editRequestsTableBody.querySelectorAll('.btn-approve').forEach(btn => {
      btn.addEventListener('click', () => {
        const reqId = btn.dataset.id;
        const req   = requests.find(r => r.id === reqId);
        if (req) approveEditRequest(reqId, req, btn);
      });
    });

    editRequestsTableBody.querySelectorAll('.btn-reject').forEach(btn => {
      btn.addEventListener('click', () => {
        const reqId = btn.dataset.id;
        const req   = requests.find(r => r.id === reqId);
        if (req) openRejectModal(reqId, req);
      });
    });

  } catch (err) {
    console.error('Erro ao carregar solicitações:', err);
    editRequestsTableBody.innerHTML = '<tr><td colspan="7" class="text-center" style="color:var(--danger);">Erro ao carregar solicitações.</td></tr>';
  }
}

async function approveEditRequest(reqId, req, btn) {
  if (!confirm(`Aprovar a alteração de "${req.type}" para ${req.requestedTime}?\n\nFuncionário: ${req.userEmail}\nJustificativa: ${req.justification}`)) return;

  btn.disabled  = true;
  btn.innerText = '...';

  try {

    const [h, m]        = req.requestedTime.split(':').map(Number);
    const originalDate  = req.originalTimestamp.toDate();
    const newTimestamp  = new Date(originalDate);
    newTimestamp.setHours(h, m, 0, 0);

    await updateDoc(doc(db, 'time_records', req.recordId), {
      timestamp: newTimestamp,
      edited:    true,
      editedAt:  new Date(),
      editNote:  req.justification
    });

    await updateDoc(doc(db, 'edit_requests', reqId), {
      status:     'approved',
      resolvedAt: new Date(),
      resolvedBy: currentUser.email
    });

    alert(`<span data-icon="check" class="icon-sm"></span> Edição aprovada! Registro de "${req.type}" alterado para ${req.requestedTime}.`);
    await loadEditRequests();
    await loadRecords();

  } catch (err) {
    console.error('Erro ao aprovar edição:', err);
    alert('Erro ao aprovar. Verifique as permissões do Firestore.');
    btn.disabled  = false;
    btn.innerText = '<span data-icon="check" class="icon-sm"></span> Aprovar';
  }
}

function openRejectModal(reqId, req) {
  rejectingRequest = { id: reqId, data: req };
  rejectInfoUser.innerText = req.userEmail || req.userId;
  rejectInfoType.innerText = req.type;
  rejectInfoTime.innerText = req.requestedTime;
  rejectInfoJust.innerText = req.justification;
  rejectReason.value       = '';
  msgReject.innerText      = '';
  modalReject.classList.add('active');
}

btnCloseReject.addEventListener('click',  () => modalReject.classList.remove('active'));
btnCancelReject.addEventListener('click', () => modalReject.classList.remove('active'));
modalReject.addEventListener('click', e => { if (e.target === modalReject) modalReject.classList.remove('active'); });

btnConfirmReject.addEventListener('click', async () => {
  if (!rejectingRequest) return;
  const { id: reqId, data: req } = rejectingRequest;
  const reason = rejectReason.value.trim();

  btnConfirmReject.disabled  = true;
  btnConfirmReject.innerText = 'Rejeitando...';
  msgReject.innerText        = '';

  try {
    await updateDoc(doc(db, 'edit_requests', reqId), {
      status:       'rejected',
      resolvedAt:   new Date(),
      resolvedBy:   currentUser.email,
      rejectReason: reason
    });

    msgReject.style.color = 'var(--success)';
    msgReject.innerText   = '<span data-icon="check" class="icon-sm"></span> Solicitação rejeitada com sucesso.';
    setTimeout(async () => {
      modalReject.classList.remove('active');
      await loadEditRequests();
    }, 1500);

  } catch (err) {
    console.error('Erro ao rejeitar:', err);
    msgReject.style.color = 'var(--danger)';
    msgReject.innerText   = 'Erro ao rejeitar. Tente novamente.';
  } finally {
    btnConfirmReject.disabled  = false;
    btnConfirmReject.innerText = 'Confirmar Rejeição';
  }
});

let leafletMap    = null;
let leafletMarker = null;
let leafletCircle = null;

function initOrUpdateMap(lat, lng, radius) {
  const mapElement = document.getElementById('workspace-map');
  if (!mapElement || typeof L === 'undefined') return;

  const latNum    = parseFloat(lat);
  const lngNum    = parseFloat(lng);
  const radiusNum = parseFloat(radius) || 100;

  if (!leafletMap) {
    leafletMap = L.map('workspace-map', { center: [latNum, lngNum], zoom: 16 });
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '&copy; OpenStreetMap' }).addTo(leafletMap);
    leafletMarker = L.marker([latNum, lngNum], { draggable: true }).addTo(leafletMap);
    leafletCircle = L.circle([latNum, lngNum], { radius: radiusNum, color: '#4f46e5', fillColor: '#4f46e5', fillOpacity: 0.18, weight: 2 }).addTo(leafletMap);

    leafletMarker.on('dragend', () => {
      const pos = leafletMarker.getLatLng();
      applyNewCoordinates(pos.lat, pos.lng, true);
    });

    leafletMap.on('click', e => applyNewCoordinates(e.latlng.lat, e.latlng.lng, true));
    setTimeout(() => { if (leafletMap) leafletMap.invalidateSize(); }, 200);

  } else {
    leafletMap.setView([latNum, lngNum], 16);
    leafletMarker.setLatLng([latNum, lngNum]);
    leafletCircle.setLatLng([latNum, lngNum]);
    leafletCircle.setRadius(radiusNum);
    leafletMap.invalidateSize();
  }
}

function applyNewCoordinates(lat, lng, doReverseGeocode = false) {
  const latFixed = parseFloat(lat).toFixed(6);
  const lngFixed = parseFloat(lng).toFixed(6);
  workspaceLat.value = latFixed;
  workspaceLng.value = lngFixed;
  if (leafletMarker) leafletMarker.setLatLng([lat, lng]);
  if (leafletCircle) leafletCircle.setLatLng([lat, lng]);
  if (leafletMap)    leafletMap.panTo([lat, lng]);
  if (doReverseGeocode) reverseGeocode(lat, lng);
}

workspaceRadius.addEventListener('input', () => {
  const r = parseFloat(workspaceRadius.value);
  if (leafletCircle && !isNaN(r) && r > 0) leafletCircle.setRadius(r);
});

async function reverseGeocode(lat, lng) {
  try {
    const res  = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`, {
      headers: { 'Accept-Language': 'pt-BR,pt;q=0.9,en;q=0.8' }
    });
    const data = await res.json();
    if (data?.display_name) {
      workspaceAddress.value     = data.display_name;
      msgWorkspace.style.color   = 'var(--text-muted)';
      msgWorkspace.innerText     = `📍 Posição definida: ${data.display_name}`;
    }
  } catch (err) {
    console.warn('Geocodificação reversa falhou:', err);
  }
}

async function loadWorkspaceSettings() {
  let lat = -23.55052, lng = -46.633308, radius = 100;
  try {
    const snap = await getDoc(doc(db, 'settings', 'workspace'));
    if (snap.exists()) {
      const data = snap.data();
      if (data.address)  workspaceAddress.value = data.address;
      if (data.radius)  { workspaceRadius.value = data.radius; radius = data.radius; }
      if (data.latitude != null && data.longitude != null) {
        workspaceLat.value = data.latitude;
        workspaceLng.value = data.longitude;
        lat = data.latitude;
        lng = data.longitude;
      }
      msgWorkspace.style.color = 'var(--text-muted)';
      msgWorkspace.innerText   = `Localização configurada: ${data.address || 'Coordenadas salvas'} (Raio: ${data.radius}m)`;
    }
  } catch (err) {
    console.error('Erro ao carregar workspace:', err);
  }
  initOrUpdateMap(lat, lng, radius);
}

async function searchAddress(address) {
  if (!address) {
    msgWorkspace.style.color = 'var(--danger)';
    msgWorkspace.innerText   = 'Digite um endereço para buscar.';
    return;
  }

  const coordsRegex = /(-?\d+\.?\d*)[,\s]+(-?\d+\.?\d*)/;
  const match = address.match(coordsRegex);
  if (match) {
    const lat = parseFloat(match[1]), lng = parseFloat(match[2]);
    applyNewCoordinates(lat, lng, true);
    initOrUpdateMap(lat, lng, workspaceRadius.value);
    msgWorkspace.style.color = 'var(--success)';
    msgWorkspace.innerText   = `<span data-icon="check" class="icon-sm"></span> Coordenadas: ${lat}, ${lng}`;
    return;
  }

  btnSearchAddress.disabled  = true;
  btnSearchAddress.innerText = 'Buscando...';
  msgWorkspace.style.color   = 'var(--text-muted)';
  msgWorkspace.innerText     = 'Consultando serviço de localização...';

  try {
    const res     = await fetch(`https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(address)}`, {
      headers: { 'Accept-Language': 'pt-BR,pt;q=0.9,en;q=0.8' }
    });
    const results = await res.json();

    if (results?.length > 0) {
      const lat = parseFloat(results[0].lat), lon = parseFloat(results[0].lon);
      workspaceAddress.value   = results[0].display_name;
      applyNewCoordinates(lat, lon, false);
      initOrUpdateMap(lat, lon, workspaceRadius.value);
      msgWorkspace.style.color = 'var(--success)';
      msgWorkspace.innerText   = `<span data-icon="check" class="icon-sm"></span> Encontrado: ${results[0].display_name}`;
    } else {
      msgWorkspace.style.color = 'var(--danger)';
      msgWorkspace.innerText   = 'Endereço não encontrado. Tente incluir número, cidade ou CEP.';
    }
  } catch (err) {
    console.error('Erro de geocodificação:', err);
    msgWorkspace.style.color = 'var(--danger)';
    msgWorkspace.innerText   = 'Erro ao consultar localização.';
  } finally {
    btnSearchAddress.disabled  = false;
    btnSearchAddress.innerText = '🔍 Buscar Coordenadas';
  }
}

btnSearchAddress.addEventListener('click', () => searchAddress(workspaceAddress.value.trim()));
workspaceAddress.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); searchAddress(workspaceAddress.value.trim()); } });

btnSaveWorkspace.addEventListener('click', async () => {
  const address = workspaceAddress.value.trim();
  const radius  = parseFloat(workspaceRadius.value);
  const lat     = parseFloat(workspaceLat.value);
  const lng     = parseFloat(workspaceLng.value);

  if (isNaN(lat) || isNaN(lng)) {
    msgWorkspace.style.color = 'var(--danger)';
    msgWorkspace.innerText   = 'Busque ou clique no mapa para posicionar as coordenadas.';
    return;
  }
  if (isNaN(radius) || radius <= 0) {
    msgWorkspace.style.color = 'var(--danger)';
    msgWorkspace.innerText   = 'Informe um raio válido em metros.';
    return;
  }

  btnSaveWorkspace.disabled  = true;
  btnSaveWorkspace.innerText = 'Salvando...';
  msgWorkspace.innerText     = '';

  try {
    await setDoc(doc(db, 'settings', 'workspace'), { address: address || '', latitude: lat, longitude: lng, radius, updatedAt: new Date() });
    msgWorkspace.style.color = 'var(--success)';
    msgWorkspace.innerText   = `<span data-icon="check" class="icon-sm"></span> Localização salva! (Raio: ${radius}m)`;
  } catch (err) {
    console.error('Erro ao salvar workspace:', err);
    msgWorkspace.style.color = 'var(--danger)';
    msgWorkspace.innerText   = 'Erro ao salvar. Verifique as permissões no Firebase.';
  } finally {
    btnSaveWorkspace.disabled  = false;
    btnSaveWorkspace.innerText = '💾 Salvar Localização';
  }
});

function formatMinutes(totalMinutes) {
  const sign  = totalMinutes < 0 ? '-' : '';
  const abs   = Math.abs(Math.round(totalMinutes));
  return `${sign}${Math.floor(abs/60)}h${String(abs%60).padStart(2,'0')}`;
}

function toDateStr(d) { return d.toISOString().split('T')[0]; }

function currentWeekRange() {
  const now  = new Date();
  const diff = now.getDay() === 0 ? -6 : 1 - now.getDay();
  const start = new Date(now); start.setDate(now.getDate()+diff); start.setHours(0,0,0,0);
  const end   = new Date(start); end.setDate(start.getDate()+6); end.setHours(23,59,59,999);
  return { start, end };
}
function currentMonthRange() {
  const now   = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  const end   = new Date(now.getFullYear(), now.getMonth()+1, 0, 23, 59, 59, 999);
  return { start, end };
}
function monthRange(ym) {
  const [y,m] = ym.split('-').map(Number);
  return { start: new Date(y,m-1,1), end: new Date(y,m,0,23,59,59,999) };
}

function calcBancoDeHoras(records) {
  const byDay = {};
  records.forEach(r => {
    const ds = r.dateString;
    if (!byDay[ds]) byDay[ds] = {};
    byDay[ds][r.type] = r.timestamp.toDate();
  });

  return Object.keys(byDay).sort().map(ds => {
    const d = byDay[ds];
    const entrada = d['Entrada'], pausa = d['Pausa para Almoço'], volta = d['Volta do Almoço'], saida = d['Saída'];
    let workedMin = 0;
    if (entrada && saida) {
      const total = (saida - entrada)/60000;
      const pause = (pausa && volta) ? (volta - pausa)/60000 : 0;
      workedMin   = total - pause;
    } else if (entrada && pausa) {
      workedMin = (pausa - entrada)/60000;
    } else if (volta && saida) {
      workedMin = (saida - volta)/60000;
    }

    const metaMin    = META_DIARIA_HORAS * 60;
    const balanceMin = workedMin - metaMin;
    const fmt = t => t ? t.toLocaleTimeString('pt-BR', { hour:'2-digit', minute:'2-digit' }) : '—';
    return {
      dateLabel: new Date(ds+'T12:00:00').toLocaleDateString('pt-BR', { weekday:'short', day:'2-digit', month:'2-digit' }),
      entrada: fmt(entrada), pausa: fmt(pausa), volta: fmt(volta), saida: fmt(saida),
      workedMin, balanceMin, hasData: workedMin > 0
    };
  });
}

async function loadAdminBancoDeHoras(userId, start, end) {
  if (!userId) {
    adminBhTableBody.innerHTML = '<tr><td colspan="7" class="text-center text-muted">Selecione um funcionário.</td></tr>';
    return;
  }

  adminBhTableBody.innerHTML = '<tr><td colspan="7" class="text-center"><span class="loader"></span></td></tr>';
  adminBhTotalWorked.innerText   = '--';
  adminBhTotalExpected.innerText = '--';
  adminBhBalance.innerText       = '--';
  adminBhDaysWorked.innerText    = '--';

  const startStr = toDateStr(start), endStr = toDateStr(end);

  try {
    const snap = await getDocs(query(
      collection(db, 'time_records'),
      where('userId', '==', userId)
    ));

    const records = [];
    snap.forEach(d => {
      const data = d.data();
      if (data.dateString >= startStr && data.dateString <= endStr) {
        records.push({ id: d.id, ...data });
      }
    });

    if (records.length === 0) {
      adminBhTableBody.innerHTML = `<tr><td colspan="7" class="text-center text-muted">Nenhum registro neste período.</td></tr>`;
      ['--','--','0h00','0'].forEach((v,i) => [adminBhTotalWorked,adminBhTotalExpected,adminBhBalance,adminBhDaysWorked][i].innerText = v);
      adminBhTotalWorked.innerText = '0h00'; adminBhTotalExpected.innerText = '0h00'; adminBhDaysWorked.innerText = '0';
      return;
    }

    const days = calcBancoDeHoras(records);
    let totalWorked = 0, daysWithData = 0;
    adminBhTableBody.innerHTML = '';

    days.forEach(day => {
      totalWorked += day.workedMin;
      if (day.hasData) daysWithData++;
      const balClass = day.balanceMin >= 0 ? '#065f46' : '#991b1b';
      const balSign  = day.balanceMin >= 0 ? '+' : '';
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td style="font-weight:500; white-space:nowrap;">${day.dateLabel}</td>
        <td>${day.entrada}</td><td>${day.pausa}</td><td>${day.volta}</td><td>${day.saida}</td>
        <td><strong>${day.hasData ? formatMinutes(day.workedMin) : '—'}</strong></td>
        <td style="color:${day.hasData ? balClass : 'var(--text-muted)'}; font-weight:600;">${day.hasData ? balSign+formatMinutes(day.balanceMin) : '—'}</td>
      `;
      adminBhTableBody.appendChild(tr);
    });

    const totalExpected = daysWithData * META_DIARIA_HORAS * 60;
    const totalBalance  = totalWorked - totalExpected;

    adminBhTotalWorked.innerText   = formatMinutes(totalWorked);
    adminBhTotalExpected.innerText = formatMinutes(totalExpected);
    adminBhBalance.innerText       = (totalBalance >= 0 ? '+' : '') + formatMinutes(totalBalance);
    adminBhDaysWorked.innerText    = daysWithData;

    adminBhBalanceCard.classList.remove('positive','negative','neutral');
    if (totalBalance > 0)      adminBhBalanceCard.classList.add('positive');
    else if (totalBalance < 0) adminBhBalanceCard.classList.add('negative');
    else                       adminBhBalanceCard.classList.add('neutral');

  } catch (err) {
    console.error('Erro no banco de horas admin:', err);
    adminBhTableBody.innerHTML = '<tr><td colspan="7" class="text-center" style="color:var(--danger);">Erro ao carregar dados.</td></tr>';
  }
}

function initAdminBancoDeHoras() {
  const now = new Date();
  const ymStr = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`;
  document.getElementById('admin-bh-month-input').value  = ymStr;
  document.getElementById('admin-bh-date-end').value    = toDateStr(now);
  const { start: ws } = currentWeekRange();
  document.getElementById('admin-bh-date-start').value  = toDateStr(ws);

  let currentPeriod = { start: ws, end: new Date() };

  const getSelectedEmployee = () => bhFilterEmployee.value;

  document.querySelectorAll('#tab-banco-horas .bh-period-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('#tab-banco-horas .bh-period-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      document.getElementById('admin-bh-range-month').classList.remove('visible');
      document.getElementById('admin-bh-range-custom').classList.remove('visible');

      const period = btn.dataset.period;
      if (period === 'week') {
        const r = currentWeekRange(); currentPeriod = r;
        loadAdminBancoDeHoras(getSelectedEmployee(), r.start, r.end);
      } else if (period === 'month') {
        const r = currentMonthRange(); currentPeriod = r;
        loadAdminBancoDeHoras(getSelectedEmployee(), r.start, r.end);
      } else if (period === 'custom-month') {
        document.getElementById('admin-bh-range-month').classList.add('visible');
      } else if (period === 'custom-range') {
        document.getElementById('admin-bh-range-custom').classList.add('visible');
      }
    });
  });

  document.getElementById('admin-bh-apply-month').addEventListener('click', () => {
    const val = document.getElementById('admin-bh-month-input').value;
    if (!val) return;
    const r = monthRange(val); currentPeriod = r;
    loadAdminBancoDeHoras(getSelectedEmployee(), r.start, r.end);
  });

  document.getElementById('admin-bh-apply-range').addEventListener('click', () => {
    const sv = document.getElementById('admin-bh-date-start').value;
    const ev = document.getElementById('admin-bh-date-end').value;
    if (!sv || !ev) return;
    const start = new Date(sv+'T00:00:00'), end = new Date(ev+'T23:59:59');
    if (start > end) { alert('A data de início deve ser anterior à data de fim.'); return; }
    currentPeriod = { start, end };
    loadAdminBancoDeHoras(getSelectedEmployee(), start, end);
  });

  bhFilterEmployee.addEventListener('change', () => {
    if (currentPeriod) loadAdminBancoDeHoras(getSelectedEmployee(), currentPeriod.start, currentPeriod.end);
  });

  document.getElementById('tab-btn-bh').addEventListener('click', () => {
    if (adminBhTotalWorked.innerText === '--' && getSelectedEmployee()) {
      const { start, end } = currentWeekRange();
      loadAdminBancoDeHoras(getSelectedEmployee(), start, end);
    }
  });
}

