import {
  firebaseConfig, auth, onAuthStateChanged, signOut,
  db, collection, query, where, getDocs, orderBy,
  getDoc, doc, setDoc, addDoc, updateDoc, deleteDoc, serverTimestamp
} from './firebase-config.js';
import { insertSVGs, showToast } from './svg.js';

const userNameSpan = document.getElementById('user-name');
const btnLogout = document.getElementById('btn-logout');
const filterDate = document.getElementById('filter-date');
const filterEmployee = document.getElementById('filter-employee');
const filterEmployeeSearch = document.getElementById('filter-employee-search');
const filterDropdown = document.getElementById('filter-dropdown');
const btnFilter = document.getElementById('btn-filter');
const tableBody = document.getElementById('admin-records-table-body');
const recordsPaginationControls = document.getElementById('admin-records-pagination');
const recordsLimitSelect = document.getElementById('admin-records-limit');
const recordsBtnPrev = document.getElementById('admin-records-prev');
const recordsBtnNext = document.getElementById('admin-records-next');
const recordsInfo = document.getElementById('admin-records-info');


const workspaceAddress = document.getElementById('workspace-address');
const btnSearchAddress = document.getElementById('btn-search-address');
const workspaceRadius = document.getElementById('workspace-radius');
const workspaceLat = document.getElementById('workspace-lat');
const workspaceLng = document.getElementById('workspace-lng');
const btnSaveWorkspace = document.getElementById('btn-save-workspace');

const adminBhPaginationControls = document.getElementById('admin-bh-pagination');
const adminBhLimitSelect = document.getElementById('admin-bh-limit');
const adminBhBtnPrev = document.getElementById('admin-bh-prev');
const adminBhBtnNext = document.getElementById('admin-bh-next');
const adminBhInfo = document.getElementById('admin-bh-info');

const editPaginationControls = document.getElementById('edit-requests-pagination');
const editLimitSelect = document.getElementById('edit-requests-limit');
const editBtnPrev = document.getElementById('edit-requests-prev');
const editBtnNext = document.getElementById('edit-requests-next');
const editInfo = document.getElementById('edit-requests-info');

const insertPaginationControls = document.getElementById('insert-requests-pagination');
const insertLimitSelect = document.getElementById('insert-requests-limit');
const insertBtnPrev = document.getElementById('insert-requests-prev');
const insertBtnNext = document.getElementById('insert-requests-next');
const insertInfo = document.getElementById('insert-requests-info');
const modalOverlay = document.getElementById('modal-novo-user');
const btnNovoUser = document.getElementById('btn-novo-user');
const btnCloseModal = document.getElementById('btn-close-modal');
const btnCriarUser = document.getElementById('btn-criar-user');


const modalReject = document.getElementById('modal-reject');
const btnCloseReject = document.getElementById('btn-close-reject-modal');
const btnCancelReject = document.getElementById('btn-cancel-reject');
const btnConfirmReject = document.getElementById('btn-confirm-reject');
const rejectReason = document.getElementById('reject-reason');

const rejectInfoUser = document.getElementById('reject-info-user');
const rejectInfoType = document.getElementById('reject-info-type');
const rejectInfoTime = document.getElementById('reject-info-time');
const rejectInfoJust = document.getElementById('reject-info-just');

const modalConfirmApprove = document.getElementById('modal-confirm-approve');
const btnCloseConfApprove = document.getElementById('btn-close-confirm-approve');
const btnCancelApprove = document.getElementById('btn-cancel-approve');
const btnConfirmApprove = document.getElementById('btn-confirm-approve');
const approveInfoUser = document.getElementById('approve-info-user');
const approveInfoType = document.getElementById('approve-info-type');
const approveInfoTime = document.getElementById('approve-info-time');
const approveInfoJust = document.getElementById('approve-info-just');

const modalConfirmApproveInsert = document.getElementById('modal-confirm-approve-insert');
const btnCloseConfApproveInsert = document.getElementById('btn-close-confirm-approve-insert');
const btnCancelApproveInsert = document.getElementById('btn-cancel-approve-insert');
const btnConfirmApproveInsert = document.getElementById('btn-confirm-approve-insert');
const approveInsertInfoUser = document.getElementById('approve-insert-info-user');
const approveInsertInfoDate = document.getElementById('approve-insert-info-date');
const approveInsertInfoType = document.getElementById('approve-insert-info-type');
const approveInsertInfoTime = document.getElementById('approve-insert-info-time');
const approveInsertInfoJust = document.getElementById('approve-insert-info-just');

let pendingApproval = null; // { reqId, req, btn }
let pendingApprovalInsert = null;

const editRequestsTableBody = document.getElementById('edit-requests-table-body');
const pendingDot = document.getElementById('pending-dot');

const insertRequestsTableBody = document.getElementById('insert-requests-table-body');
const pendingDotInsert = document.getElementById('pending-dot-insert');

const modalAction = document.getElementById('modal-action-request');
const btnCloseAction = document.getElementById('btn-close-action-modal');

const adminBhTableBody = document.getElementById('admin-bh-table-body');
const adminBhTotalWorked = document.getElementById('admin-bh-total-worked');
const adminBhTotalExpected = document.getElementById('admin-bh-total-expected');
const adminBhBalance = document.getElementById('admin-bh-balance');
const adminBhBalanceCard = document.getElementById('admin-bh-balance-card');
const adminBhDaysWorked = document.getElementById('admin-bh-days-worked');
const bhFilterEmployee = document.getElementById('bh-filter-employee');
const bhFilterEmployeeSearch = document.getElementById('bh-filter-employee-search');
const bhFilterDropdown = document.getElementById('bh-filter-dropdown');

// ── Gestão de Usuários ──
const usersTableBody = document.getElementById('users-table-body');
const modalConfirmDeleteUser = document.getElementById('modal-confirm-delete-user');
const btnCloseDeleteUser = document.getElementById('btn-close-delete-user');
const btnCancelDeleteUser = document.getElementById('btn-cancel-delete-user');
const btnConfirmDeleteUser = document.getElementById('btn-confirm-delete-user');
const deleteUserName = document.getElementById('delete-user-name');
const deleteUserEmail = document.getElementById('delete-user-email');
const deleteUserRole = document.getElementById('delete-user-role');

let currentUser = null;
let rejectingRequest = null;
const META_DIARIA_HORAS = 8;

const today = new Date().toISOString().split('T')[0];
filterDate.value = today;

onAuthStateChanged(auth, async (user) => {
  if (user) {
    const userDocRef = doc(db, 'users', user.uid);
    const userDocSnap = await getDoc(userDocRef);

    if (userDocSnap.exists() && userDocSnap.data().role === 'admin') {
      currentUser = user;
      userNameSpan.innerText = userDocSnap.data().name || user.email;
      await loadWorkspaceSettings();
      await loadEmployees();
      await loadRecords();
      await loadEditRequests();
      await loadInsertRequests();
      await loadUsers();
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

if (btnNovoUser) {
  btnNovoUser.addEventListener('click', () => {
    document.getElementById('new-name').value = '';
    document.getElementById('new-email').value = '';
    document.getElementById('new-password').value = '';
    document.getElementById('role-employee').checked = true;
    modalOverlay.classList.add('active');
  });
}

btnCloseModal.addEventListener('click', () => modalOverlay.classList.remove('active'));
modalOverlay.addEventListener('click', e => { if (e.target === modalOverlay) modalOverlay.classList.remove('active'); });

btnCriarUser.addEventListener('click', async () => {
  const name = document.getElementById('new-name').value.trim();
  const email = document.getElementById('new-email').value.trim();
  const password = document.getElementById('new-password').value;
  const role = document.querySelector('input[name="role"]:checked').value;

  if (!name || !email || !password) {
    showToast('Preencha todos os campos obrigatórios.', 'warning');
    return;
  }
  if (password.length < 6) {
    showToast('A senha deve ter no mínimo 6 caracteres.', 'warning');
    return;
  }

  btnCriarUser.disabled = true;
  btnCriarUser.innerText = 'Criando...';

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
      let errMsg = authData.error?.message || 'Erro desconhecido';
      
      if (errMsg === 'EMAIL_EXISTS') {
        errMsg = 'Este e-mail já está cadastrado.';
      } else if (errMsg.startsWith('PASSWORD_DOES_NOT_MEET_REQUIREMENTS')) {
        errMsg = 'A senha não atende aos requisitos. Deve conter pelo menos uma letra minúscula, uma letra maiúscula e um caractere especial.';
      } else {
        errMsg = `Erro: ${errMsg}`;
      }
      
      throw new Error(errMsg);
    }

    const newUid = authData.localId;
    await setDoc(doc(db, 'users', newUid), { name, email, role, firstLogin: true });

    showToast(`Usuário "${name}" criado com sucesso!`, 'success');

    if (role === 'employee') {
      _employeeList.push({ id: newUid, name: name || email });
      if (filterEmployeeSearch) buildDropdown(filterEmployeeSearch.value);
      if (bhFilterEmployeeSearch) buildBhDropdown(bhFilterEmployeeSearch.value);
    }

    await loadUsers();
    setTimeout(() => modalOverlay.classList.remove('active'), 1500);

  } catch (error) {
    showToast(error.message, 'error');
  } finally {
    btnCriarUser.disabled = false;
    btnCriarUser.innerText = 'Criar Usuário';
  }
});

// ── Employee combobox data ──
let _employeeList = [{ id: 'all', name: 'Todos os Funcionários' }];

function buildDropdown(filter = '') {
  const q = filter.toLowerCase();
  const items = _employeeList.filter(e => e.name.toLowerCase().includes(q));
  filterDropdown.innerHTML = '';
  items.forEach(emp => {
    const item = document.createElement('div');
    item.className = 'filter-dropdown-item' + (emp.id === filterEmployee.value ? ' selected' : '');
    item.textContent = emp.name;
    item.addEventListener('mousedown', e => {
      e.preventDefault();
      filterEmployee.value = emp.id;
      filterEmployeeSearch.value = emp.id === 'all' ? '' : emp.name;
      filterEmployeeSearch.placeholder = emp.id === 'all' ? 'Todos os Funcionários' : '';
      filterDropdown.classList.remove('open');
    });
    filterDropdown.appendChild(item);
  });
}

function buildBhDropdown(filter = '') {
  if (!bhFilterDropdown) return;
  const q = filter.toLowerCase();
  const items = _employeeList.filter(e => e.name.toLowerCase().includes(q));
  
  bhFilterDropdown.innerHTML = '';
  items.forEach(emp => {
    const item = document.createElement('div');
    item.className = 'filter-dropdown-item' + (emp.id === bhFilterEmployee.value ? ' selected' : '');
    item.textContent = emp.name;
    item.addEventListener('mousedown', e => {
      e.preventDefault();
      bhFilterEmployee.value = emp.id;
      bhFilterEmployeeSearch.value = emp.id === 'all' ? '' : emp.name;
      bhFilterEmployeeSearch.placeholder = emp.id === 'all' ? 'Selecione um funcionário...' : '';
      bhFilterDropdown.classList.remove('open');
      bhFilterEmployee.dispatchEvent(new Event('change'));
    });
    bhFilterDropdown.appendChild(item);
  });
}

if (filterEmployeeSearch) {
  filterEmployeeSearch.addEventListener('focus', () => { buildDropdown(filterEmployeeSearch.value); filterDropdown.classList.add('open'); });
  filterEmployeeSearch.addEventListener('input', () => { filterEmployee.value = 'all'; buildDropdown(filterEmployeeSearch.value); filterDropdown.classList.add('open'); });
  filterEmployeeSearch.addEventListener('blur', () => setTimeout(() => filterDropdown.classList.remove('open'), 150));
}

if (bhFilterEmployeeSearch) {
  bhFilterEmployeeSearch.addEventListener('focus', () => { buildBhDropdown(bhFilterEmployeeSearch.value); bhFilterDropdown.classList.add('open'); });
  bhFilterEmployeeSearch.addEventListener('input', () => { bhFilterEmployee.value = ''; buildBhDropdown(bhFilterEmployeeSearch.value); bhFilterDropdown.classList.add('open'); });
  bhFilterEmployeeSearch.addEventListener('blur', () => setTimeout(() => bhFilterDropdown.classList.remove('open'), 150));
}


async function loadEmployees() {
  try {
    const snap = await getDocs(query(collection(db, 'users'), where('role', '==', 'employee')));
    snap.forEach(d => {
      const data = d.data();
      const name = data.name || data.email;
      _employeeList.push({ id: d.id, name });
    });
    buildDropdown();
    buildBhDropdown();
  } catch (err) {
    console.error('Erro ao carregar funcionários', err);
  }
}

let _adminRecordsData = [];
let _adminRecordsCurrentPage = 1;
let _adminRecordsPerPage = 5;

function renderAdminRecordsTable() {
  tableBody.innerHTML = '';
  if (_adminRecordsData.length === 0) {
    tableBody.innerHTML = '<tr><td colspan="5" class="text-center text-muted">Nenhum registro encontrado para estes filtros.</td></tr>';
    recordsPaginationControls.style.display = 'none';
    return;
  }

  const totalPages = Math.ceil(_adminRecordsData.length / _adminRecordsPerPage);
  if (_adminRecordsCurrentPage > totalPages) _adminRecordsCurrentPage = totalPages;
  if (_adminRecordsCurrentPage < 1) _adminRecordsCurrentPage = 1;

  const startIndex = (_adminRecordsCurrentPage - 1) * _adminRecordsPerPage;
  const endIndex = Math.min(startIndex + _adminRecordsPerPage, _adminRecordsData.length);
  const pageData = _adminRecordsData.slice(startIndex, endIndex);

  pageData.forEach(data => {
    const dateStr = data.timestamp.toDate().toLocaleDateString('pt-BR');
    const timeStr = data.timestamp.toDate().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

    let badgeClass = '';
    if (data.type === 'Entrada') badgeClass = 'badge-entrada';
    else if (data.type.includes('Pausa')) badgeClass = 'badge-pausa';
    else if (data.type.includes('Volta')) badgeClass = 'badge-volta';
    else if (data.type === 'Saída') badgeClass = 'badge-saida';

    const locationCell = (data.latitude != null && data.longitude != null)
      ? `<a href="https://www.google.com/maps?q=${data.latitude},${data.longitude}" target="_blank" rel="noopener noreferrer" class="map-link" title="Precisão: ±${Math.round(data.accuracy ?? 0)}m"><span data-icon="map-pinned" class="icon-sm"></span> Ver no Mapa</a>`
      : '<span class="map-empty">—</span>';

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
  
  insertSVGs();

  // Update pagination UI
  recordsPaginationControls.style.display = 'flex';
  recordsInfo.innerText = `Página ${_adminRecordsCurrentPage} de ${totalPages} (${_adminRecordsData.length} registros)`;
  recordsBtnPrev.disabled = _adminRecordsCurrentPage === 1;
  recordsBtnNext.disabled = _adminRecordsCurrentPage === totalPages;
}

if (recordsLimitSelect) {
  recordsLimitSelect.addEventListener('change', e => {
    _adminRecordsPerPage = parseInt(e.target.value, 10);
    _adminRecordsCurrentPage = 1;
    renderAdminRecordsTable();
  });
  recordsBtnPrev.addEventListener('click', () => {
    if (_adminRecordsCurrentPage > 1) { _adminRecordsCurrentPage--; renderAdminRecordsTable(); }
  });
  recordsBtnNext.addEventListener('click', () => {
    const totalPages = Math.ceil(_adminRecordsData.length / _adminRecordsPerPage);
    if (_adminRecordsCurrentPage < totalPages) { _adminRecordsCurrentPage++; renderAdminRecordsTable(); }
  });
}

async function loadRecords() {
  const dateValue = filterDate.value;
  const employeeId = filterEmployee.value;

  tableBody.innerHTML = '<tr><td colspan="5" class="text-center"><span class="loader"></span></td></tr>';
  recordsPaginationControls.style.display = 'none';

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

    _adminRecordsData = [];
    snapshot.forEach(d => _adminRecordsData.push({ id: d.id, ...d.data() }));
    _adminRecordsData.sort((a, b) => b.timestamp.toDate() - a.timestamp.toDate()); // Ordem descendente faz mais sentido

    _adminRecordsCurrentPage = 1;
    renderAdminRecordsTable();

  } catch (error) {
    console.error('Erro ao buscar registros:', error);
    tableBody.innerHTML = '<tr><td colspan="5" class="text-center" style="color: var(--danger);">Erro ao carregar dados.</td></tr>';
  }
}

btnFilter.addEventListener('click', loadRecords);

let _editRequestsData = [];
let _editRequestsCurrentPage = 1;
let _editRequestsPerPage = 10;

function renderEditRequestsTable() {
  editRequestsTableBody.innerHTML = '';
  if (_editRequestsData.length === 0) {
    editRequestsTableBody.innerHTML = '<tr><td colspan="7" class="text-center text-muted">Nenhuma solicitação encontrada.</td></tr>';
    editPaginationControls.style.display = 'none';
    return;
  }

  const totalPages = Math.ceil(_editRequestsData.length / _editRequestsPerPage);
  if (_editRequestsCurrentPage > totalPages) _editRequestsCurrentPage = totalPages;
  if (_editRequestsCurrentPage < 1) _editRequestsCurrentPage = 1;

  const startIndex = (_editRequestsCurrentPage - 1) * _editRequestsPerPage;
  const endIndex = Math.min(startIndex + _editRequestsPerPage, _editRequestsData.length);
  const pageData = _editRequestsData.slice(startIndex, endIndex);

  pageData.forEach(req => {
    const origTime = req.originalTimestamp?.toDate
      ? req.originalTimestamp.toDate().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
      : '—';

    const statusMap = {
      pending: '<span class="badge badge-pending"><span data-icon="ampulheta" class="icon-sm"></span> Pendente</span>',
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
  
  insertSVGs();

  editRequestsTableBody.querySelectorAll('.btn-approve').forEach(btn => {
    btn.addEventListener('click', () => {
      const reqId = btn.dataset.id;
      const req = _editRequestsData.find(r => r.id === reqId);
      if (req) approveEditRequest(reqId, req, btn);
    });
  });

  editRequestsTableBody.querySelectorAll('.btn-reject').forEach(btn => {
    btn.addEventListener('click', () => {
      const reqId = btn.dataset.id;
      const req = _editRequestsData.find(r => r.id === reqId);
      if (req) openRejectModal(reqId, req);
    });
  });

  editPaginationControls.style.display = 'flex';
  editInfo.innerText = `Página ${_editRequestsCurrentPage} de ${totalPages} (${_editRequestsData.length} registros)`;
  editBtnPrev.disabled = _editRequestsCurrentPage === 1;
  editBtnNext.disabled = _editRequestsCurrentPage === totalPages;
}

if (editLimitSelect) {
  editLimitSelect.addEventListener('change', e => {
    _editRequestsPerPage = parseInt(e.target.value, 10);
    _editRequestsCurrentPage = 1;
    renderEditRequestsTable();
  });
  editBtnPrev.addEventListener('click', () => {
    if (_editRequestsCurrentPage > 1) { _editRequestsCurrentPage--; renderEditRequestsTable(); }
  });
  editBtnNext.addEventListener('click', () => {
    const totalPages = Math.ceil(_editRequestsData.length / _editRequestsPerPage);
    if (_editRequestsCurrentPage < totalPages) { _editRequestsCurrentPage++; renderEditRequestsTable(); }
  });
}

async function loadEditRequests() {
  editRequestsTableBody.innerHTML = '<tr><td colspan="7" class="text-center"><span class="loader"></span></td></tr>';
  editPaginationControls.style.display = 'none';

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

    _editRequestsData = requests;
    _editRequestsCurrentPage = 1;
    renderEditRequestsTable();
  } catch (err) {
    console.error('Erro ao carregar solicitações:', err);
    editRequestsTableBody.innerHTML = '<tr><td colspan="7" class="text-center" style="color:var(--danger);">Erro ao carregar solicitações.</td></tr>';
  }
}

let _insertRequestsData = [];
let _insertRequestsCurrentPage = 1;
let _insertRequestsPerPage = 10;

function renderInsertRequestsTable() {
  insertRequestsTableBody.innerHTML = '';
  if (_insertRequestsData.length === 0) {
    insertRequestsTableBody.innerHTML = '<tr><td colspan="7" class="text-center text-muted">Nenhuma solicitação encontrada.</td></tr>';
    insertPaginationControls.style.display = 'none';
    return;
  }

  const totalPages = Math.ceil(_insertRequestsData.length / _insertRequestsPerPage);
  if (_insertRequestsCurrentPage > totalPages) _insertRequestsCurrentPage = totalPages;
  if (_insertRequestsCurrentPage < 1) _insertRequestsCurrentPage = 1;

  const startIndex = (_insertRequestsCurrentPage - 1) * _insertRequestsPerPage;
  const endIndex = Math.min(startIndex + _insertRequestsPerPage, _insertRequestsData.length);
  const pageData = _insertRequestsData.slice(startIndex, endIndex);

  pageData.forEach(req => {
    const requestedDateParts = req.requestedDateString.split('-');
    const formattedDate = `${requestedDateParts[2]}/${requestedDateParts[1]}/${requestedDateParts[0]}`;

    const statusMap = {
      pending: '<span class="badge badge-pending"><span data-icon="ampulheta" class="icon-sm"></span> Pendente</span>',
      approved: '<span class="badge badge-approved"><span data-icon="check" class="icon-sm"></span> Aprovado</span>',
      rejected: '<span class="badge badge-rejected"><span data-icon="deni" class="icon-sm"></span> Rejeitado</span>'
    };
    const statusBadge = statusMap[req.status] || req.status;

    const actions = req.status === 'pending'
      ? `<div class="edit-action-btns">
           <button class="btn btn-approve btn-approve-insert btn-sm" data-id="${req.id}"><span data-icon="check" class="icon-sm"></span> Aprovar</button>
           <button class="btn btn-reject btn-reject-insert btn-sm" data-id="${req.id}"><span data-icon="deni" class="icon-sm"></span> Rejeitar</button>
         </div>`
      : `<span style="font-size:0.8rem; color:var(--text-muted);">${req.resolvedAt?.toDate ? req.resolvedAt.toDate().toLocaleDateString('pt-BR') : '—'}</span>`;

    const tr = document.createElement('tr');
    tr.dataset.reqId = req.id;
    tr.innerHTML = `
      <td style="font-size:0.875rem;">${req.userEmail || req.userId}</td>
      <td><strong>${formattedDate}</strong></td>
      <td><span class="badge ${req.type === 'Entrada' ? 'badge-entrada' : req.type.includes('Pausa') ? 'badge-pausa' : req.type.includes('Volta') ? 'badge-volta' : 'badge-saida'}">${req.type}</span></td>
      <td><strong>${req.requestedTime}</strong></td>
      <td style="font-size:0.8125rem; max-width:200px;">${req.justification}</td>
      <td>${statusBadge}</td>
      <td>${actions}</td>
    `;
    insertRequestsTableBody.appendChild(tr);
  });
  
  insertSVGs();

  insertRequestsTableBody.querySelectorAll('.btn-approve-insert').forEach(btn => {
    btn.addEventListener('click', () => {
      const reqId = btn.dataset.id;
      const req = _insertRequestsData.find(r => r.id === reqId);
      if (req) approveInsertRequest(reqId, req, btn);
    });
  });

  insertRequestsTableBody.querySelectorAll('.btn-reject-insert').forEach(btn => {
    btn.addEventListener('click', () => {
      const reqId = btn.dataset.id;
      const req = _insertRequestsData.find(r => r.id === reqId);
      if (req) openRejectModal(reqId, req, 'insert_requests');
    });
  });

  insertPaginationControls.style.display = 'flex';
  insertInfo.innerText = `Página ${_insertRequestsCurrentPage} de ${totalPages} (${_insertRequestsData.length} registros)`;
  insertBtnPrev.disabled = _insertRequestsCurrentPage === 1;
  insertBtnNext.disabled = _insertRequestsCurrentPage === totalPages;
}

if (insertLimitSelect) {
  insertLimitSelect.addEventListener('change', e => {
    _insertRequestsPerPage = parseInt(e.target.value, 10);
    _insertRequestsCurrentPage = 1;
    renderInsertRequestsTable();
  });
  insertBtnPrev.addEventListener('click', () => {
    if (_insertRequestsCurrentPage > 1) { _insertRequestsCurrentPage--; renderInsertRequestsTable(); }
  });
  insertBtnNext.addEventListener('click', () => {
    const totalPages = Math.ceil(_insertRequestsData.length / _insertRequestsPerPage);
    if (_insertRequestsCurrentPage < totalPages) { _insertRequestsCurrentPage++; renderInsertRequestsTable(); }
  });
}

async function loadInsertRequests() {
  insertRequestsTableBody.innerHTML = '<tr><td colspan="7" class="text-center"><span class="loader"></span></td></tr>';
  insertPaginationControls.style.display = 'none';

  try {
    const snap = await getDocs(query(collection(db, 'insert_requests')));
    const requests = [];
    snap.forEach(d => requests.push({ id: d.id, ...d.data() }));
    requests.sort((a, b) => {
      const aTime = a.createdAt?.toDate?.() ?? new Date(0);
      const bTime = b.createdAt?.toDate?.() ?? new Date(0);
      return bTime - aTime;
    });

    const pendingCount = requests.filter(r => r.status === 'pending').length;
    if (pendingDotInsert) pendingDotInsert.style.display = pendingCount > 0 ? 'inline-block' : 'none';

    _insertRequestsData = requests;
    _insertRequestsCurrentPage = 1;
    renderInsertRequestsTable();

  } catch (err) {
    console.error('Erro ao carregar solicitações de inserção:', err);
    insertRequestsTableBody.innerHTML = '<tr><td colspan="7" class="text-center" style="color:var(--danger);">Erro ao carregar solicitações.</td></tr>';
  }
}

async function approveInsertRequest(reqId, req, btn) {
  pendingApprovalInsert = { reqId, req, btn };
  const requestedDateParts = req.requestedDateString.split('-');
  const formattedDate = `${requestedDateParts[2]}/${requestedDateParts[1]}/${requestedDateParts[0]}`;

  approveInsertInfoUser.innerText = req.userEmail || req.userId;
  approveInsertInfoDate.innerText = formattedDate;
  approveInsertInfoType.innerText = req.type;
  approveInsertInfoTime.innerText = req.requestedTime;
  approveInsertInfoJust.innerText = req.justification;
  modalConfirmApproveInsert.classList.add('active');
}

btnCloseConfApproveInsert.addEventListener('click', () => modalConfirmApproveInsert.classList.remove('active'));
btnCancelApproveInsert.addEventListener('click', () => modalConfirmApproveInsert.classList.remove('active'));
modalConfirmApproveInsert.addEventListener('click', e => { if (e.target === modalConfirmApproveInsert) modalConfirmApproveInsert.classList.remove('active'); });

btnConfirmApproveInsert.addEventListener('click', async () => {
  if (!pendingApprovalInsert) return;
  const { reqId, req, btn } = pendingApprovalInsert;
  pendingApprovalInsert = null;
  modalConfirmApproveInsert.classList.remove('active');

  btn.disabled = true;
  btn.innerText = '...';

  try {
    const [h, m] = req.requestedTime.split(':').map(Number);
    const dateParts = req.requestedDateString.split('-');
    const timestamp = new Date(dateParts[0], dateParts[1] - 1, dateParts[2], h, m, 0, 0);

    await addDoc(collection(db, 'time_records'), {
      userId: req.userId,
      userEmail: req.userEmail,
      timestamp: timestamp,
      type: req.type,
      dateString: req.requestedDateString,
      latitude: null,
      longitude: null,
      accuracy: null,
      insertedByAdmin: true,
      insertedAt: new Date(),
      insertNote: req.justification
    });

    await updateDoc(doc(db, 'insert_requests', reqId), {
      status: 'approved',
      resolvedAt: new Date(),
      resolvedBy: currentUser.email
    });

    showToast(`Inserção aprovada! Ponto de "${req.type}" criado com sucesso.`, 'success');
    await loadInsertRequests();
    await loadRecords();
  } catch (err) {
    console.error('Erro ao aprovar inserção:', err);
    showToast('Erro ao aprovar inserção. Verifique permissões.', 'error');
    btn.disabled = false;
    btn.innerHTML = '<span data-icon="check" class="icon-sm"></span> Aprovar';
  }
});

async function approveEditRequest(reqId, req, btn) {
  // Open custom confirm modal instead of native confirm()
  pendingApproval = { reqId, req, btn };
  approveInfoUser.innerText = req.userEmail || req.userId;
  approveInfoType.innerText = req.type;
  approveInfoTime.innerText = req.requestedTime;
  approveInfoJust.innerText = req.justification;
  modalConfirmApprove.classList.add('active');
}

btnCloseConfApprove.addEventListener('click', () => modalConfirmApprove.classList.remove('active'));
btnCancelApprove.addEventListener('click', () => modalConfirmApprove.classList.remove('active'));
modalConfirmApprove.addEventListener('click', e => { if (e.target === modalConfirmApprove) modalConfirmApprove.classList.remove('active'); });

btnConfirmApprove.addEventListener('click', async () => {
  if (!pendingApproval) return;
  const { reqId, req, btn } = pendingApproval;
  pendingApproval = null;
  modalConfirmApprove.classList.remove('active');

  btn.disabled = true;
  btn.innerText = '...';

  try {

    const [h, m] = req.requestedTime.split(':').map(Number);
    const originalDate = req.originalTimestamp.toDate();
    const newTimestamp = new Date(originalDate);
    newTimestamp.setHours(h, m, 0, 0);

    await updateDoc(doc(db, 'time_records', req.recordId), {
      timestamp: newTimestamp,
      edited: true,
      editedAt: new Date(),
      editNote: req.justification
    });

    await updateDoc(doc(db, 'edit_requests', reqId), {
      status: 'approved',
      resolvedAt: new Date(),
      resolvedBy: currentUser.email
    });

    showToast(`Edição aprovada! Registro de "${req.type}" alterado para ${req.requestedTime}.`, 'success');
    await loadEditRequests();
    await loadRecords();

  } catch (err) {
    console.error('Erro ao aprovar edição:', err);
    showToast('Erro ao aprovar. Verifique as permissões do Firestore.', 'error');
    btn.disabled = false;
    btn.innerHTML = '<span data-icon="check" class="icon-sm"></span> Aprovar';
  }

});

function openRejectModal(reqId, req, collectionName = 'edit_requests') {
  rejectingRequest = { id: reqId, data: req, collection: collectionName };
  rejectInfoUser.innerText = req.userEmail || req.userId;
  rejectInfoType.innerText = req.type;
  rejectInfoTime.innerText = req.requestedTime;
  rejectInfoJust.innerText = req.justification;
  rejectReason.value = '';
  modalReject.classList.add('active');
}

btnCloseReject.addEventListener('click', () => modalReject.classList.remove('active'));
btnCancelReject.addEventListener('click', () => modalReject.classList.remove('active'));
modalReject.addEventListener('click', e => { if (e.target === modalReject) modalReject.classList.remove('active'); });

btnConfirmReject.addEventListener('click', async () => {
  if (!rejectingRequest) return;
  const { id: reqId, data: req, collection: collName } = rejectingRequest;
  const reason = rejectReason.value.trim();

  btnConfirmReject.disabled = true;
  btnConfirmReject.innerText = 'Rejeitando...';

  try {
    await updateDoc(doc(db, collName, reqId), {
      status: 'rejected',
      resolvedAt: new Date(),
      resolvedBy: currentUser.email,
      rejectReason: reason
    });

    showToast('Solicitação rejeitada com sucesso.', 'success');
    setTimeout(async () => {
      modalReject.classList.remove('active');
      if (collName === 'edit_requests') await loadEditRequests();
      else if (collName === 'insert_requests') await loadInsertRequests();
    }, 1000);

  } catch (err) {
    console.error('Erro ao rejeitar:', err);
    showToast('Erro ao rejeitar. Tente novamente.', 'error');
  } finally {
    btnConfirmReject.disabled = false;
    btnConfirmReject.innerText = 'Confirmar Rejeição';
  }
});

let leafletMap = null;
let leafletMarker = null;
let leafletCircle = null;

function initOrUpdateMap(lat, lng, radius) {
  const mapElement = document.getElementById('workspace-map');
  if (!mapElement || typeof L === 'undefined') return;

  const latNum = parseFloat(lat);
  const lngNum = parseFloat(lng);
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
  if (leafletMap) leafletMap.panTo([lat, lng]);
  if (doReverseGeocode) reverseGeocode(lat, lng);
}

workspaceRadius.addEventListener('input', () => {
  const r = parseFloat(workspaceRadius.value);
  if (leafletCircle && !isNaN(r) && r > 0) leafletCircle.setRadius(r);
});

async function reverseGeocode(lat, lng) {
  try {
    const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`, {
      headers: { 'Accept-Language': 'pt-BR,pt;q=0.9,en;q=0.8' }
    });
    const data = await res.json();
    if (data?.display_name) {
      workspaceAddress.value = data.display_name;
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
      if (data.address) workspaceAddress.value = data.address;
      if (data.radius) { workspaceRadius.value = data.radius; radius = data.radius; }
      if (data.latitude != null && data.longitude != null) {
        workspaceLat.value = data.latitude;
        workspaceLng.value = data.longitude;
        lat = data.latitude;
        lng = data.longitude;
      }
    }
  } catch (err) {
    console.error('Erro ao carregar workspace:', err);
  }
  initOrUpdateMap(lat, lng, radius);
}

async function searchAddress(address) {
  if (!address) {
    showToast('Digite um endereço para buscar.', 'warning');
    return;
  }

  const coordsRegex = /(-?\d+\.?\d*)[,\s]+(-?\d+\.?\d*)/;
  const match = address.match(coordsRegex);
  if (match) {
    const lat = parseFloat(match[1]), lng = parseFloat(match[2]);
    applyNewCoordinates(lat, lng, true);
    initOrUpdateMap(lat, lng, workspaceRadius.value);
    showToast(`Coordenadas aplicadas: ${lat}, ${lng}`, 'success');
    return;
  }

  btnSearchAddress.disabled = true;
  btnSearchAddress.innerText = 'Buscando...';

  try {
    const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(address)}`, {
      headers: { 'Accept-Language': 'pt-BR,pt;q=0.9,en;q=0.8' }
    });
    const results = await res.json();

    if (results?.length > 0) {
      const lat = parseFloat(results[0].lat), lon = parseFloat(results[0].lon);
      workspaceAddress.value = results[0].display_name;
      applyNewCoordinates(lat, lon, false);
      initOrUpdateMap(lat, lon, workspaceRadius.value);
      showToast(`Endereço encontrado: ${results[0].display_name}`, 'success');
    } else {
      showToast('Endereço não encontrado. Tente incluir número, cidade ou CEP.', 'warning');
    }
  } catch (err) {
    console.error('Erro de geocodificação:', err);
    showToast('Erro ao consultar localização. Tente novamente.', 'error');
  } finally {
    btnSearchAddress.disabled = false;
    btnSearchAddress.innerHTML = '<span data-icon="search" class="icon-sm"></span> Buscar Coordenadas';
  }
}

btnSearchAddress.addEventListener('click', () => searchAddress(workspaceAddress.value.trim()));
workspaceAddress.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); searchAddress(workspaceAddress.value.trim()); } });

btnSaveWorkspace.addEventListener('click', async () => {
  const address = workspaceAddress.value.trim();
  const radius = parseFloat(workspaceRadius.value);
  const lat = parseFloat(workspaceLat.value);
  const lng = parseFloat(workspaceLng.value);

  if (isNaN(lat) || isNaN(lng)) {
    showToast('Busque ou clique no mapa para posicionar as coordenadas.', 'warning');
    return;
  }
  if (isNaN(radius) || radius <= 0) {
    showToast('Informe um raio válido em metros.', 'warning');
    return;
  }

  btnSaveWorkspace.disabled = true;
  btnSaveWorkspace.innerText = 'Salvando...';

  try {
    await setDoc(doc(db, 'settings', 'workspace'), { address: address || '', latitude: lat, longitude: lng, radius, updatedAt: new Date() });
    showToast(`Localização salva com sucesso! Raio: ${radius}m`, 'success');
  } catch (err) {
    console.error('Erro ao salvar workspace:', err);
    showToast('Erro ao salvar. Verifique as permissões no Firebase.', 'error');
  } finally {
    btnSaveWorkspace.disabled = false;
    btnSaveWorkspace.innerText = 'Salvar Localização';
  }
});

function formatMinutes(totalMinutes) {
  const sign = totalMinutes < 0 ? '-' : '';
  const abs = Math.abs(Math.round(totalMinutes));
  return `${sign}${String(Math.floor(abs / 60)).padStart(2, '0')}:${String(abs % 60).padStart(2, '0')}`;
}

function toDateStr(d) { return d.toISOString().split('T')[0]; }

function currentWeekRange() {
  const now = new Date();
  const diff = now.getDay() === 0 ? -6 : 1 - now.getDay();
  const start = new Date(now); start.setDate(now.getDate() + diff); start.setHours(0, 0, 0, 0);
  const end = new Date(start); end.setDate(start.getDate() + 6); end.setHours(23, 59, 59, 999);
  return { start, end };
}
function currentMonthRange() {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
  return { start, end };
}
function monthRange(ym) {
  const [y, m] = ym.split('-').map(Number);
  return { start: new Date(y, m - 1, 1), end: new Date(y, m, 0, 23, 59, 59, 999) };
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
      const total = (saida - entrada) / 60000;
      const pause = (pausa && volta) ? (volta - pausa) / 60000 : 0;
      workedMin = total - pause;
    } else if (entrada && pausa) {
      workedMin = (pausa - entrada) / 60000;
    } else if (volta && saida) {
      workedMin = (saida - volta) / 60000;
    }

    const metaMin = META_DIARIA_HORAS * 60;
    const balanceMin = workedMin - metaMin;
    const fmt = t => t ? t.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : '—';
    return {
      dateLabel: new Date(ds + 'T12:00:00').toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: '2-digit' }),
      entrada: fmt(entrada), pausa: fmt(pausa), volta: fmt(volta), saida: fmt(saida),
      workedMin, balanceMin, hasData: workedMin > 0
    };
  });
}

async function loadAdminBancoDeHoras(userId, start, end) {
  if (!userId) {
    adminBhTableBody.innerHTML = '<tr><td colspan="7" class="text-center text-muted">Selecione um funcionário.</td></tr>';
    adminBhPaginationControls.style.display = 'none';
    return;
  }

  adminBhTableBody.innerHTML = '<tr><td colspan="7" class="text-center"><span class="loader"></span></td></tr>';
  adminBhTotalWorked.innerText = '--';
  adminBhTotalExpected.innerText = '--';
  adminBhBalance.innerText = '--';
  adminBhDaysWorked.innerText = '--';

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
      ['--', '--', '0h00', '0'].forEach((v, i) => [adminBhTotalWorked, adminBhTotalExpected, adminBhBalance, adminBhDaysWorked][i].innerText = v);
      adminBhTotalWorked.innerText = '0h00'; adminBhTotalExpected.innerText = '0h00'; adminBhDaysWorked.innerText = '0';
      adminBhPaginationControls.style.display = 'none';
      return;
    }

    _adminBhData = calcBancoDeHoras(records);
    
    let totalWorked = 0, daysWithData = 0;
    _adminBhData.forEach(day => {
      totalWorked += day.workedMin;
      if (day.hasData) daysWithData++;
    });

    const totalExpected = daysWithData * META_DIARIA_HORAS * 60;
    const totalBalance = totalWorked - totalExpected;

    adminBhTotalWorked.innerText = formatMinutes(totalWorked);
    adminBhTotalExpected.innerText = formatMinutes(totalExpected);
    adminBhBalance.innerText = (totalBalance >= 0 ? '+' : '') + formatMinutes(totalBalance);
    adminBhDaysWorked.innerText = daysWithData;

    adminBhBalanceCard.classList.remove('positive', 'negative', 'neutral');
    if (totalBalance > 0) adminBhBalanceCard.classList.add('positive');
    else if (totalBalance < 0) adminBhBalanceCard.classList.add('negative');
    else adminBhBalanceCard.classList.add('neutral');
    
    _adminBhCurrentPage = 1;
    renderAdminBhTable();

  } catch (err) {
    console.error('Erro no banco de horas admin:', err);
    adminBhTableBody.innerHTML = '<tr><td colspan="7" class="text-center" style="color:var(--danger);">Erro ao carregar dados.</td></tr>';
    adminBhPaginationControls.style.display = 'none';
  }
}

let _adminBhData = [];
let _adminBhCurrentPage = 1;
let _adminBhPerPage = 5;

function renderAdminBhTable() {
  adminBhTableBody.innerHTML = '';
  if (_adminBhData.length === 0) {
    adminBhPaginationControls.style.display = 'none';
    return;
  }

  const totalPages = Math.ceil(_adminBhData.length / _adminBhPerPage);
  if (_adminBhCurrentPage > totalPages) _adminBhCurrentPage = totalPages;
  if (_adminBhCurrentPage < 1) _adminBhCurrentPage = 1;

  const startIndex = (_adminBhCurrentPage - 1) * _adminBhPerPage;
  const endIndex = Math.min(startIndex + _adminBhPerPage, _adminBhData.length);
  const pageData = _adminBhData.slice(startIndex, endIndex);

  pageData.forEach(day => {
    const balClass = day.balanceMin >= 0 ? '#065f46' : '#991b1b';
    const balSign = day.balanceMin >= 0 ? '+' : '';
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td style="font-weight:500; white-space:nowrap;">${day.dateLabel}</td>
      <td>${day.entrada}</td><td>${day.pausa}</td><td>${day.volta}</td><td>${day.saida}</td>
      <td><strong>${day.hasData ? formatMinutes(day.workedMin) : '—'}</strong></td>
      <td style="color:${day.hasData ? balClass : 'var(--text-muted)'}; font-weight:600;">${day.hasData ? balSign + formatMinutes(day.balanceMin) : '—'}</td>
    `;
    adminBhTableBody.appendChild(tr);
  });

  adminBhPaginationControls.style.display = 'flex';
  adminBhInfo.innerText = `Página ${_adminBhCurrentPage} de ${totalPages} (${_adminBhData.length} dias)`;
  adminBhBtnPrev.disabled = _adminBhCurrentPage === 1;
  adminBhBtnNext.disabled = _adminBhCurrentPage === totalPages;
}

if (adminBhLimitSelect) {
  adminBhLimitSelect.addEventListener('change', e => {
    _adminBhPerPage = parseInt(e.target.value, 10);
    _adminBhCurrentPage = 1;
    renderAdminBhTable();
  });
  adminBhBtnPrev.addEventListener('click', () => {
    if (_adminBhCurrentPage > 1) { _adminBhCurrentPage--; renderAdminBhTable(); }
  });
  adminBhBtnNext.addEventListener('click', () => {
    const totalPages = Math.ceil(_adminBhData.length / _adminBhPerPage);
    if (_adminBhCurrentPage < totalPages) { _adminBhCurrentPage++; renderAdminBhTable(); }
  });
}

function initAdminBancoDeHoras() {
  const now = new Date();
  const ymStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  document.getElementById('admin-bh-month-input').value = ymStr;
  document.getElementById('admin-bh-date-end').value = toDateStr(now);
  const { start: ws } = currentWeekRange();
  document.getElementById('admin-bh-date-start').value = toDateStr(ws);

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
    const start = new Date(sv + 'T00:00:00'), end = new Date(ev + 'T23:59:59');
    if (start > end) { showToast('A data de início deve ser anterior à data de fim.', 'warning'); return; }
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

// ═══════════════════════════════════════════════════════════
//  GESTÃO DE USUÁRIOS
// ═══════════════════════════════════════════════════════════

let _usersData = [];
let _pendingDeleteUser = null;

async function loadUsers() {
  usersTableBody.innerHTML = '<tr><td colspan="4" class="text-center"><span class="loader"></span></td></tr>';

  try {
    const snap = await getDocs(collection(db, 'users'));
    _usersData = [];
    snap.forEach(d => _usersData.push({ id: d.id, ...d.data() }));

    // Ordena: admins primeiro, depois por nome
    _usersData.sort((a, b) => {
      if (a.role === b.role) return (a.name || '').localeCompare(b.name || '');
      return a.role === 'admin' ? -1 : 1;
    });

    renderUsersTable();
  } catch (err) {
    console.error('Erro ao carregar usuários:', err);
    usersTableBody.innerHTML = '<tr><td colspan="4" class="text-center" style="color:var(--danger);">Erro ao carregar usuários.</td></tr>';
  }
}

function renderUsersTable() {
  usersTableBody.innerHTML = '';
  const emptyState = document.getElementById('users-empty-state');

  if (_usersData.length === 0) {
    usersTableBody.innerHTML = '<tr><td colspan="4" class="text-center text-muted">Nenhum usuário encontrado.</td></tr>';
    if (emptyState) emptyState.style.display = 'block';
    return;
  }

  if (emptyState) emptyState.style.display = 'none';

  _usersData.forEach(user => {
    const isCurrentUser = user.id === currentUser?.uid;
    const roleBadge = user.role === 'admin'
      ? '<span class="badge badge-approved"><span data-icon="user-shield" class="icon-sm"></span> Administrador</span>'
      : '<span class="badge badge-pausa"><span data-icon="employee-user" class="icon-sm"></span> Funcionário</span>';

    const deleteBtn = isCurrentUser
      ? `<button class="btn btn-sm" disabled title="Você não pode excluir sua própria conta" style="opacity:0.4; cursor:not-allowed;"><span data-icon="deni" class="icon-sm"></span> Excluir</button>`
      : `<button class="btn btn-danger btn-sm btn-delete-user" data-uid="${user.id}" data-name="${user.name || ''}" data-email="${user.email || ''}" data-role="${user.role || ''}"><span data-icon="deni" class="icon-sm"></span> Excluir</button>`;

    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>
        <strong>${user.name || '—'}</strong>
        ${isCurrentUser ? '<span style="font-size:0.7rem; color:var(--primary-color); margin-left:4px;">(você)</span>' : ''}
      </td>
      <td style="font-size:0.875rem;">${user.email || '—'}</td>
      <td>${roleBadge}</td>
      <td style="text-align: center;">${deleteBtn}</td>
    `;
    usersTableBody.appendChild(tr);
  });

  insertSVGs();

  // Listeners nos botões de excluir
  usersTableBody.querySelectorAll('.btn-delete-user').forEach(btn => {
    btn.addEventListener('click', () => {
      _pendingDeleteUser = {
        uid: btn.dataset.uid,
        name: btn.dataset.name,
        email: btn.dataset.email,
        role: btn.dataset.role,
      };
      deleteUserName.innerText = btn.dataset.name || '—';
      deleteUserEmail.innerText = btn.dataset.email || '—';
      deleteUserRole.innerText = btn.dataset.role === 'admin' ? 'Administrador' : 'Funcionário';
      modalConfirmDeleteUser.classList.add('active');
    });
  });
}

// Fechar modal de exclusão
btnCloseDeleteUser.addEventListener('click', () => { modalConfirmDeleteUser.classList.remove('active'); _pendingDeleteUser = null; });
btnCancelDeleteUser.addEventListener('click', () => { modalConfirmDeleteUser.classList.remove('active'); _pendingDeleteUser = null; });
modalConfirmDeleteUser.addEventListener('click', e => { if (e.target === modalConfirmDeleteUser) { modalConfirmDeleteUser.classList.remove('active'); _pendingDeleteUser = null; } });

// Confirmar exclusão
btnConfirmDeleteUser.addEventListener('click', async () => {
  if (!_pendingDeleteUser) return;
  const { uid, name } = _pendingDeleteUser;
  _pendingDeleteUser = null;
  modalConfirmDeleteUser.classList.remove('active');

  btnConfirmDeleteUser.disabled = true;
  btnConfirmDeleteUser.innerText = 'Excluindo...';

  try {
    await deleteDoc(doc(db, 'users', uid));
    showToast(`Usuário "${name}" removido com sucesso.`, 'success');
    await loadUsers();

    // Atualiza a lista de funcionários dos filtros também
    _employeeList = [{ id: 'all', name: 'Todos os Funcionários' }];
    await loadEmployees();
  } catch (err) {
    console.error('Erro ao excluir usuário:', err);
    showToast('Erro ao excluir usuário. Verifique as permissões.', 'error');
  } finally {
    btnConfirmDeleteUser.disabled = false;
    btnConfirmDeleteUser.innerHTML = '<span data-icon="deni" class="icon-sm"></span> Excluir Usuário';
    insertSVGs();
  }
});

// Botão "Novo Usuário" dentro da aba de gestão
const btnNovoUserTab = document.getElementById('btn-novo-user-tab');
if (btnNovoUserTab) {
  btnNovoUserTab.addEventListener('click', () => {
    document.getElementById('new-name').value = '';
    document.getElementById('new-email').value = '';
    document.getElementById('new-password').value = '';
    document.getElementById('role-employee').checked = true;
    modalOverlay.classList.add('active');
  });
}
