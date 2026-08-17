import { firebaseConfig, auth, onAuthStateChanged, signOut, db, collection, query, where, getDocs, orderBy, getDoc, doc, setDoc, addDoc } from './firebase-config.js';

const userNameSpan = document.getElementById('user-name');
const btnLogout = document.getElementById('btn-logout');
const filterDate = document.getElementById('filter-date');
const filterEmployee = document.getElementById('filter-employee');
const btnFilter = document.getElementById('btn-filter');
const tableBody = document.getElementById('admin-records-table-body');

// Workspace elements
const workspaceAddress = document.getElementById('workspace-address');
const btnSearchAddress = document.getElementById('btn-search-address');
const workspaceRadius  = document.getElementById('workspace-radius');
const workspaceLat     = document.getElementById('workspace-lat');
const workspaceLng     = document.getElementById('workspace-lng');
const btnSaveWorkspace = document.getElementById('btn-save-workspace');
const msgWorkspace     = document.getElementById('msg-workspace');

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
      await loadWorkspaceSettings();
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

// ── Local de Trabalho & Geofencing com Google Maps ───────────────

let gMap = null;
let gMarker = null;
let gCircle = null;
let gGeocoder = null;
let gAutocomplete = null;
let isGoogleMapsLoaded = false;

// Carrega o script do Google Maps dinamicamente com a API Key do projeto
function loadGoogleMapsScript() {
  return new Promise((resolve) => {
    if (window.google && window.google.maps) {
      isGoogleMapsLoaded = true;
      resolve(true);
      return;
    }

    // Callback de erro de autenticação do Google Maps
    window.gm_authFailure = () => {
      console.warn("Google Maps: Chave não autenticada para Maps JavaScript API ou Places API.");
      msgWorkspace.style.color = 'var(--text-muted)';
      msgWorkspace.innerText = '💡 Dica: A busca e o mapa utilizam o Google Maps. Caso queira ativar todas as APIs do Google Maps, ative Maps JavaScript API e Places API no console Google Cloud.';
    };

    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?key=${firebaseConfig.apiKey}&libraries=places&language=pt-BR`;
    script.async = true;
    script.defer = true;
    script.onload = () => {
      isGoogleMapsLoaded = true;
      resolve(true);
    };
    script.onerror = () => {
      console.warn("Não foi possível carregar o script do Google Maps.");
      resolve(false);
    };
    document.head.appendChild(script);
  });
}

// Inicializa ou atualiza o Google Maps
function initOrUpdateMap(lat, lng, radius) {
  const mapElement = document.getElementById('workspace-map');
  if (!mapElement) return;

  if (!isGoogleMapsLoaded || !window.google || !window.google.maps) {
    mapElement.innerHTML = `
      <div style="text-align: center; padding: 1rem;">
        <p style="font-weight: 500; color: var(--text-main);">📍 Coordenadas Selecionadas</p>
        <p style="color: var(--text-muted); font-size: 0.875rem;">Lat: ${lat.toFixed(5)}, Lng: ${lng.toFixed(5)} (Raio: ${radius}m)</p>
        <a href="https://www.google.com/maps?q=${lat},${lng}" target="_blank" rel="noopener noreferrer" style="display: inline-block; margin-top: 0.5rem; color: var(--primary-color); font-weight: 500;">Abrir no Google Maps ↗</a>
      </div>
    `;
    return;
  }

  const position = { lat: parseFloat(lat), lng: parseFloat(lng) };

  if (!gMap) {
    gMap = new google.maps.Map(mapElement, {
      center: position,
      zoom: 16,
      mapTypeControl: true,
      streetViewControl: false,
      fullscreenControl: true
    });

    gGeocoder = new google.maps.Geocoder();

    // Marcador arrastável
    gMarker = new google.maps.Marker({
      position: position,
      map: gMap,
      draggable: true,
      animation: google.maps.Animation.DROP,
      title: 'Local da Empresa'
    });

    // Círculo representando o raio da cerca virtual
    gCircle = new google.maps.Circle({
      map: gMap,
      center: position,
      radius: parseFloat(radius) || 100,
      fillColor: '#4f46e5',
      fillOpacity: 0.18,
      strokeColor: '#4f46e5',
      strokeOpacity: 0.85,
      strokeWeight: 2
    });

    // Evento ao arrastar o pino
    gMarker.addListener('dragend', (e) => {
      const newLat = e.latLng.lat();
      const newLng = e.latLng.lng();
      applyNewCoordinates(newLat, newLng, true);
    });

    // Evento ao clicar em qualquer ponto do mapa
    gMap.addListener('click', (e) => {
      const newLat = e.latLng.lat();
      const newLng = e.latLng.lng();
      applyNewCoordinates(newLat, newLng, true);
    });

    // Inicializa o Autocomplete do Google Places no campo de endereço
    try {
      gAutocomplete = new google.maps.places.Autocomplete(workspaceAddress, {
        fields: ['geometry', 'name', 'formatted_address']
      });

      gAutocomplete.addListener('place_changed', () => {
        const place = gAutocomplete.getPlace();
        if (place && place.geometry && place.geometry.location) {
          const newLat = place.geometry.location.lat();
          const newLng = place.geometry.location.lng();
          const addr = place.formatted_address || place.name;
          workspaceAddress.value = addr;
          applyNewCoordinates(newLat, newLng, false);
          msgWorkspace.style.color = 'var(--success)';
          msgWorkspace.innerText = `✅ Local encontrado pelo Google Maps: ${addr}`;
        } else {
          // Se o usuário digitou e deu Enter sem selecionar da lista
          searchAddress(workspaceAddress.value.trim());
        }
      });
    } catch (autoErr) {
      console.warn("Autocomplete Google Places não inicializado:", autoErr);
    }

  } else {
    // Atualiza mapa existente
    gMap.setCenter(position);
    gMarker.setPosition(position);
    gCircle.setCenter(position);
    gCircle.setRadius(parseFloat(radius) || 100);
  }
}

// Atualiza os inputs e o círculo no mapa
function applyNewCoordinates(lat, lng, doReverseGeocode = false) {
  workspaceLat.value = parseFloat(lat).toFixed(6);
  workspaceLng.value = parseFloat(lng).toFixed(6);

  const position = { lat: parseFloat(lat), lng: parseFloat(lng) };
  if (gMarker) gMarker.setPosition(position);
  if (gCircle) gCircle.setCenter(position);
  if (gMap) gMap.panTo(position);

  if (doReverseGeocode) {
    reverseGeocode(lat, lng);
  }
}

// Atualiza o raio do círculo em tempo real ao digitar
workspaceRadius.addEventListener('input', () => {
  const r = parseFloat(workspaceRadius.value);
  if (gCircle && !isNaN(r) && r > 0) {
    gCircle.setRadius(r);
  }
});

// Geocodificação reversa (Coordenadas -> Endereço)
async function reverseGeocode(lat, lng) {
  if (gGeocoder) {
    try {
      const response = await gGeocoder.geocode({ location: { lat: parseFloat(lat), lng: parseFloat(lng) } });
      if (response.results && response.results.length > 0) {
        workspaceAddress.value = response.results[0].formatted_address;
        msgWorkspace.style.color = 'var(--text-muted)';
        msgWorkspace.innerText = `📍 Endereço atualizado: ${response.results[0].formatted_address}`;
        return;
      }
    } catch (e) {
      console.warn("Geocodificação reversa Google falhou, tentando fallback...", e);
    }
  }

  // Fallback para OpenStreetMap
  try {
    const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`, {
      headers: { 'Accept-Language': 'pt-BR,pt;q=0.9' }
    });
    const data = await res.json();
    if (data && data.display_name) {
      workspaceAddress.value = data.display_name;
      msgWorkspace.style.color = 'var(--text-muted)';
      msgWorkspace.innerText = `📍 Endereço atualizado: ${data.display_name}`;
    }
  } catch (err) {
    console.error("Erro na geocodificação reversa:", err);
  }
}

// Carrega as configurações salvas do Firestore
async function loadWorkspaceSettings() {
  await loadGoogleMapsScript();

  let initialLat = -23.55052;
  let initialLng = -46.633308;
  let initialRadius = 100;

  try {
    const docRef = doc(db, 'settings', 'workspace');
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      const data = docSnap.data();
      if (data.address) workspaceAddress.value = data.address;
      if (data.radius) {
        workspaceRadius.value = data.radius;
        initialRadius = data.radius;
      }
      if (data.latitude != null && data.longitude != null) {
        workspaceLat.value = data.latitude;
        workspaceLng.value = data.longitude;
        initialLat = data.latitude;
        initialLng = data.longitude;
      }
      msgWorkspace.style.color = 'var(--text-muted)';
      msgWorkspace.innerText = `Localização configurada: ${data.address || 'Coordenadas salvas'} (Raio: ${data.radius}m)`;
    }
  } catch (error) {
    console.error('Erro ao carregar configurações de local de trabalho:', error);
  }

  // Inicializa o Google Maps com as coordenadas atuais ou padrão
  initOrUpdateMap(initialLat, initialLng, initialRadius);
}

// Busca endereço no Google Maps (com suporte a links do Maps e fallback)
async function searchAddress(address) {
  if (!address) {
    msgWorkspace.style.color = 'var(--danger)';
    msgWorkspace.innerText = 'Digite um endereço ou cole um link do Google Maps.';
    return;
  }

  // Suporte a coordenadas digitadas diretamente (ex: -23.55, -46.63)
  const coordsRegex = /(-?\d+\.\d+)[,\s]+(-?\d+\.\d+)/;
  const matchCoords = address.match(coordsRegex);
  if (matchCoords) {
    const lat = parseFloat(matchCoords[1]);
    const lng = parseFloat(matchCoords[2]);
    applyNewCoordinates(lat, lng, true);
    initOrUpdateMap(lat, lng, workspaceRadius.value);
    msgWorkspace.style.color = 'var(--success)';
    msgWorkspace.innerText = `✅ Coordenadas identificadas: ${lat}, ${lng}`;
    return;
  }

  btnSearchAddress.disabled = true;
  btnSearchAddress.innerText = 'Buscando...';
  msgWorkspace.style.color = 'var(--text-muted)';
  msgWorkspace.innerText = 'Buscando localização no Google Maps...';

  // 1. Tenta buscar usando o Geocoder do Google Maps
  if (gGeocoder) {
    try {
      const res = await gGeocoder.geocode({ address: address, componentRestrictions: { country: 'BR' } });
      if (res.results && res.results.length > 0) {
        const place = res.results[0];
        const lat = place.geometry.location.lat();
        const lng = place.geometry.location.lng();
        workspaceAddress.value = place.formatted_address;
        applyNewCoordinates(lat, lng, false);
        initOrUpdateMap(lat, lng, workspaceRadius.value);
        msgWorkspace.style.color = 'var(--success)';
        msgWorkspace.innerText = `✅ Encontrado pelo Google Maps: ${place.formatted_address}`;
        btnSearchAddress.disabled = false;
        btnSearchAddress.innerText = '🔍 Buscar no Maps';
        return;
      }
    } catch (gErr) {
      console.warn("Geocoder do Google falhou, tentando serviço auxiliar...", gErr);
    }
  }

  // 2. Fallback para Nominatim (OpenStreetMap) caso Geocoder do Google não responda
  try {
    const response = await fetch(
      `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(address)}`,
      { headers: { 'Accept-Language': 'pt-BR,pt;q=0.9' } }
    );
    const results = await response.json();

    if (results && results.length > 0) {
      const lat = parseFloat(results[0].lat);
      const lon = parseFloat(results[0].lon);
      applyNewCoordinates(lat, lon, false);
      initOrUpdateMap(lat, lon, workspaceRadius.value);
      msgWorkspace.style.color = 'var(--success)';
      msgWorkspace.innerText = `✅ Encontrado: ${results[0].display_name}`;
    } else {
      msgWorkspace.style.color = 'var(--danger)';
      msgWorkspace.innerText = 'Endereço não encontrado. Tente incluir número, cidade ou CEP para maior precisão.';
    }
  } catch (error) {
    console.error('Erro ao buscar localização:', error);
    msgWorkspace.style.color = 'var(--danger)';
    msgWorkspace.innerText = 'Erro ao consultar serviço de localização. Tente novamente.';
  } finally {
    btnSearchAddress.disabled = false;
    btnSearchAddress.innerText = '🔍 Buscar no Maps';
  }
}

// Botão de busca
btnSearchAddress.addEventListener('click', () => {
  searchAddress(workspaceAddress.value.trim());
});

// Tecla Enter no campo de endereço dispara busca
workspaceAddress.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    e.preventDefault();
    searchAddress(workspaceAddress.value.trim());
  }
});

// Salva as configurações de localização no Firestore
btnSaveWorkspace.addEventListener('click', async () => {
  const address = workspaceAddress.value.trim();
  const radius  = parseFloat(workspaceRadius.value);
  const lat     = parseFloat(workspaceLat.value);
  const lng     = parseFloat(workspaceLng.value);

  if (isNaN(lat) || isNaN(lng)) {
    msgWorkspace.style.color = 'var(--danger)';
    msgWorkspace.innerText = 'Busque ou selecione as coordenadas no mapa antes de salvar.';
    return;
  }

  if (isNaN(radius) || radius <= 0) {
    msgWorkspace.style.color = 'var(--danger)';
    msgWorkspace.innerText = 'Informe um raio válido em metros (ex: 100).';
    return;
  }

  btnSaveWorkspace.disabled = true;
  btnSaveWorkspace.innerText = 'Salvando...';
  msgWorkspace.innerText = '';

  try {
    await setDoc(doc(db, 'settings', 'workspace'), {
      address: address || '',
      latitude: lat,
      longitude: lng,
      radius: radius,
      updatedAt: new Date()
    });

    msgWorkspace.style.color = 'var(--success)';
    msgWorkspace.innerText = `✅ Localização salva com sucesso! (Raio: ${radius}m)`;
  } catch (error) {
    console.error('Erro ao salvar local de trabalho:', error);
    msgWorkspace.style.color = 'var(--danger)';
    msgWorkspace.innerText = 'Erro ao salvar no banco de dados. Verifique as permissões no Firebase.';
  } finally {
    btnSaveWorkspace.disabled = false;
    btnSaveWorkspace.innerText = '💾 Salvar Localização';
  }
});

