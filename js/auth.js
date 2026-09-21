import {
  auth, db, doc, getDoc,
  signInWithEmailAndPassword, signOut, updatePassword,
  sendPasswordResetEmail, signInWithPhoneNumber, RecaptchaVerifier,
  verifyPasswordResetCode, confirmPasswordReset,
  collection, query, where, getDocs
} from './firebase-config.js';
import { insertSVGs } from './svg.js';

// ══════════════════════════════════════════════════════════════════
//  Estado global do fluxo de recuperação
// ══════════════════════════════════════════════════════════════════
let _recoveryUser       = null;  // dados do usuário encontrado no Firestore
let _recaptchaVerifier  = null;  // RecaptchaVerifier (para SMS)
let _confirmationResult = null;  // resultado de signInWithPhoneNumber
let _recoveryMethod     = null;  // 'email' | 'sms'
let _recoveryResetCode  = null;  // oobCode do link de redefinição via e-mail

// ══════════════════════════════════════════════════════════════════
//  Utilitários de mascaramento
// ══════════════════════════════════════════════════════════════════
function maskEmail(email) {
  const [local, domain] = email.split('@');
  const visible = local.slice(0, Math.min(2, local.length));
  return `${visible}${'*'.repeat(Math.max(3, local.length - 2))}@${domain}`;
}

function maskPhone(phone) {
  const digits = phone.replace(/\D/g, '');
  if (digits.length >= 4) {
    return `*****-${digits.slice(-4)}`;
  }
  return `****-${digits}`;
}

function normalizePhone(phone) {
  const digits = phone.replace(/\D/g, '');
  // Se já tem o DDI 55 e tem comprimento suficiente, apenas adiciona o +
  if (digits.length >= 12 && digits.startsWith('55')) return `+${digits}`;
  // Assume Brasil +55
  return `+55${digits}`;
}

// ══════════════════════════════════════════════════════════════════
//  Gerenciamento de erros e etapas
// ══════════════════════════════════════════════════════════════════
function showFpError(elId, msg) {
  const el = document.getElementById(elId);
  if (!el) return;
  el.textContent = msg;
  el.classList.add('visible');
}

function hideFpError(elId) {
  const el = document.getElementById(elId);
  if (!el) return;
  el.textContent = '';
  el.classList.remove('visible');
}

// Todos os ids de etapas
const STEPS = ['fp-step-identify', 'fp-step-method', 'fp-step-otp', 'fp-step-newpass', 'fp-step-success'];

// Índice de cada etapa (0-based). O indicador de progresso usa 4 dots para as etapas que têm progresso.
// Etapas para e-mail:  1 → 2 → 5   (3 passos)
// Etapas para SMS:     1 → 2 → 3 → 4 → 5  (5 passos)
const PROGRESS_STEPS = ['fp-step-identify', 'fp-step-method', 'fp-step-otp', 'fp-step-newpass'];

function showStep(id) {
  STEPS.forEach(s => {
    const el = document.getElementById(s);
    if (el) el.style.display = (s === id) ? 'block' : 'none';
  });
  updateProgress(id);
}

function updateProgress(activeStepId) {
  const progressEl = document.getElementById('fp-progress');
  if (!progressEl) return;

  // Oculta o indicador na tela de sucesso
  if (activeStepId === 'fp-step-success') {
    progressEl.style.display = 'none';
    return;
  }

  const idx = PROGRESS_STEPS.indexOf(activeStepId);
  if (idx === -1) {
    progressEl.style.display = 'none';
    return;
  }

  progressEl.style.display = 'flex';

  PROGRESS_STEPS.forEach((_, i) => {
    const dot = document.getElementById(`fp-dot-${i + 1}`);
    if (!dot) return;
    dot.classList.remove('active', 'done');
    if (i < idx) dot.classList.add('done');
    else if (i === idx) dot.classList.add('active');
  });
}

// ══════════════════════════════════════════════════════════════════
//  Abrir / fechar modal
// ══════════════════════════════════════════════════════════════════
const modalForgot = document.getElementById('modal-forgot-password');

function openForgotModal() {
  resetForgotFlow();
  modalForgot.classList.add('active');
  // Pré-preenche com o e-mail da tela de login, se houver
  const loginEmail = document.getElementById('email')?.value?.trim();
  const fpEmailInput = document.getElementById('fp-email');
  if (loginEmail && fpEmailInput) fpEmailInput.value = loginEmail;
  setTimeout(() => document.getElementById('fp-email')?.focus(), 280);
}

function closeForgotModal() {
  modalForgot.classList.remove('active');
}

function resetForgotFlow() {
  _recoveryUser       = null;
  _confirmationResult = null;
  _recoveryMethod     = null;
  _recoveryResetCode  = null;
  showStep('fp-step-identify');
  clearOtpInputs();
  hideFpError('fp-identify-error');
  hideFpError('fp-method-error');
  hideFpError('fp-otp-error');
  hideFpError('fp-newpass-error');

  // Reseta botão de identificação
  const btnId = document.getElementById('btn-fp-identify');
  if (btnId) { btnId.disabled = false; btnId.innerHTML = 'Continuar &rarr;'; }
}

// ══════════════════════════════════════════════════════════════════
//  ETAPA 1 — Identificar usuário pelo e-mail
// ══════════════════════════════════════════════════════════════════
async function handleIdentify() {
  const email = document.getElementById('fp-email')?.value?.trim();
  hideFpError('fp-identify-error');

  if (!email) {
    showFpError('fp-identify-error', 'Informe seu e-mail.');
    document.getElementById('fp-email')?.focus();
    return;
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    showFpError('fp-identify-error', 'Informe um endereço de e-mail válido.');
    document.getElementById('fp-email')?.focus();
    return;
  }

  const btn = document.getElementById('btn-fp-identify');
  if (btn) { btn.disabled = true; btn.innerHTML = '<span class="loader" style="width:15px;height:15px;border-width:2px;display:inline-block;vertical-align:middle;margin-right:6px;border-top-color:transparent;"></span>Verificando...'; }

  try {
    // Busca o usuário no Firestore pelo e-mail
    const snap = await getDocs(query(collection(db, 'users'), where('email', '==', email)));

    if (snap.empty) {
      showFpError('fp-identify-error', 'Nenhuma conta encontrada com este e-mail.');
      return;
    }

    const userDoc = snap.docs[0];
    _recoveryUser = { uid: userDoc.id, ...userDoc.data(), lookupEmail: email };

    buildMethodStep();
    showStep('fp-step-method');

  } catch (err) {
    console.error('Erro ao identificar usuário:', err);
    showFpError('fp-identify-error', 'Erro ao verificar conta. Tente novamente.');
  } finally {
    if (btn) { btn.disabled = false; btn.innerHTML = 'Continuar &rarr;'; }
  }
}

// ══════════════════════════════════════════════════════════════════
//  ETAPA 2 — Montar e mostrar os cartões de método
// ══════════════════════════════════════════════════════════════════
function buildMethodStep() {
  const email = _recoveryUser.lookupEmail;
  const phone = _recoveryUser.phone || null;

  // E-mail — sempre disponível
  const emailDest = document.getElementById('fp-dest-email');
  if (emailDest) emailDest.textContent = maskEmail(email);

  // SMS — apenas se houver telefone cadastrado no perfil
  const smsCard  = document.getElementById('fp-sms-card');
  const smsDest  = document.getElementById('fp-dest-sms');
  if (phone && smsCard) {
    smsCard.style.display = 'flex';
    if (smsDest) smsDest.textContent = maskPhone(phone);
  } else if (smsCard) {
    smsCard.style.display = 'none';
  }

  hideFpError('fp-method-error');
}

// ══════════════════════════════════════════════════════════════════
//  ETAPA 2 → E-mail: envia link de redefinição
// ══════════════════════════════════════════════════════════════════
async function handleEmailRecovery() {
  _recoveryMethod = 'email';
  hideFpError('fp-method-error');

  const emailCard = document.getElementById('fp-email-card');
  if (emailCard) { emailCard.disabled = true; emailCard.style.opacity = '0.65'; }

  try {
    const actionCodeSettings = {
      url: window.location.href,
      handleCodeInApp: true,
    };
    await sendPasswordResetEmail(auth, _recoveryUser.lookupEmail, actionCodeSettings);

    // Popula tela de sucesso
    document.getElementById('fp-success-title').textContent = 'E-mail enviado!';
    document.getElementById('fp-success-msg').textContent   = 'Enviamos um link de redefinição de senha para:';
    const destBadge = document.getElementById('fp-success-dest');
    destBadge.textContent = maskEmail(_recoveryUser.lookupEmail);
    destBadge.style.display = 'inline-block';
    document.getElementById('fp-success-note').innerHTML =
      'Clique no link do e-mail para criar uma nova senha.<br>Verifique também a <strong>pasta de spam</strong>.';

    showStep('fp-step-success');

  } catch (err) {
    console.error('Erro ao enviar e-mail:', err);
    let msg = 'Não foi possível enviar o e-mail. Tente novamente.';
    if (err.code === 'auth/too-many-requests') msg = 'Muitas tentativas. Aguarde alguns minutos.';
    showFpError('fp-method-error', msg);
  } finally {
    if (emailCard) { emailCard.disabled = false; emailCard.style.opacity = '1'; }
  }
}

// ══════════════════════════════════════════════════════════════════
//  ETAPA 2 → SMS: envia OTP via Firebase Phone Auth
// ══════════════════════════════════════════════════════════════════
async function handleSmsRecovery() {
  _recoveryMethod = 'sms';
  hideFpError('fp-method-error');

  const phone = _recoveryUser.phone;
  if (!phone) {
    showFpError('fp-method-error', 'Número de telefone não cadastrado nesta conta. Use o e-mail.');
    return;
  }

  const smsCard = document.getElementById('fp-sms-card');
  if (smsCard) { smsCard.disabled = true; smsCard.style.opacity = '0.65'; }

  try {
    await sendSmsOtp(phone);

    // Atualiza destino na etapa 3
    const otpDest = document.getElementById('fp-otp-phone-dest');
    if (otpDest) otpDest.textContent = maskPhone(phone);

    showStep('fp-step-otp');
    clearOtpInputs();
    setTimeout(() => document.getElementById('otp-0')?.focus(), 280);

  } catch (err) {
    console.error('Erro ao enviar SMS:', err);
    let msg = 'Não foi possível enviar o SMS. Tente novamente.';
    if (err.code === 'auth/invalid-phone-number')
      msg = 'Número de telefone inválido. Contate o administrador.';
    if (err.code === 'auth/too-many-requests')
      msg = 'Muitas tentativas. Aguarde antes de tentar novamente.';
    showFpError('fp-method-error', msg);
  } finally {
    if (smsCard) { smsCard.disabled = false; smsCard.style.opacity = '1'; }
  }
}

// Função auxiliar: inicializa reCAPTCHA e envia OTP
async function sendSmsOtp(phone) {
  if (_recaptchaVerifier) {
    try { _recaptchaVerifier.clear(); } catch (_) {}
    _recaptchaVerifier = null;
  }
  _recaptchaVerifier = new RecaptchaVerifier(auth, 'recaptcha-container', {
    size: 'invisible',
    callback: () => {}
  });
  _confirmationResult = await signInWithPhoneNumber(auth, normalizePhone(phone), _recaptchaVerifier);
}

// ══════════════════════════════════════════════════════════════════
//  ETAPA 3 — Verificar OTP
// ══════════════════════════════════════════════════════════════════
async function handleVerifyOtp() {
  const code = getOtpCode();
  hideFpError('fp-otp-error');

  if (code.length < 6) {
    showFpError('fp-otp-error', 'Digite o código completo de 6 dígitos.');
    return;
  }

  const btn = document.getElementById('btn-fp-verify-otp');
  if (btn) { btn.disabled = true; btn.innerHTML = '<span class="loader" style="width:15px;height:15px;border-width:2px;display:inline-block;vertical-align:middle;margin-right:6px;border-top-color:transparent;"></span>Verificando...'; }

  try {
    await _confirmationResult.confirm(code);
    // Usuário autenticado via SMS — vai para definir nova senha
    showStep('fp-step-newpass');
    setTimeout(() => document.getElementById('fp-new-password')?.focus(), 280);
  } catch (err) {
    console.error('Erro ao verificar OTP:', err);
    let msg = 'Código inválido ou expirado.';
    if (err.code === 'auth/code-expired')
      msg = 'Código expirado. Clique em "Reenviar" para receber um novo.';
    if (err.code === 'auth/invalid-verification-code')
      msg = 'Código incorreto. Verifique e tente novamente.';
    showFpError('fp-otp-error', msg);
    clearOtpInputs();
    document.getElementById('otp-0')?.focus();
  } finally {
    if (btn) { btn.disabled = false; btn.innerHTML = 'Verificar código'; }
  }
}

// ── Reenviar OTP ─────────────────────────────────────────────────
async function handleResendOtp() {
  const btn = document.getElementById('btn-fp-resend');
  if (btn) { btn.disabled = true; btn.textContent = 'Enviando...'; }
  hideFpError('fp-otp-error');
  clearOtpInputs();

  try {
    await sendSmsOtp(_recoveryUser.phone);
    if (btn) {
      btn.textContent = '✓ Código reenviado';
      setTimeout(() => { btn.textContent = 'Reenviar'; btn.disabled = false; }, 5000);
    }
    document.getElementById('otp-0')?.focus();
  } catch (err) {
    console.error('Erro ao reenviar SMS:', err);
    showFpError('fp-otp-error', 'Não foi possível reenviar o código. Tente novamente.');
    if (btn) { btn.disabled = false; btn.textContent = 'Reenviar'; }
  }
}

// ══════════════════════════════════════════════════════════════════
//  ETAPA 4 — Definir nova senha (após autenticação por SMS)
// ══════════════════════════════════════════════════════════════════
async function handleSetNewPassword() {
  const p1 = document.getElementById('fp-new-password')?.value  || '';
  const p2 = document.getElementById('fp-confirm-password')?.value || '';
  hideFpError('fp-newpass-error');

  if (p1.length < 6) {
    showFpError('fp-newpass-error', 'A senha deve ter ao menos 6 caracteres.');
    document.getElementById('fp-new-password')?.focus();
    return;
  }
  if (p1 !== p2) {
    showFpError('fp-newpass-error', 'As senhas não conferem.');
    document.getElementById('fp-confirm-password')?.focus();
    return;
  }

  const btn = document.getElementById('btn-fp-save-password');
  if (btn) { btn.disabled = true; btn.innerHTML = '<span class="loader" style="width:15px;height:15px;border-width:2px;display:inline-block;vertical-align:middle;margin-right:6px;border-top-color:transparent;"></span>Salvando...'; }

  try {
    if (_recoveryResetCode) {
      await confirmPasswordReset(auth, _recoveryResetCode, p1);
      _recoveryResetCode = null;
    } else if (auth.currentUser) {
      await updatePassword(auth.currentUser, p1);
      await signOut(auth);
    } else {
      throw new Error('Sessão de redefinição não encontrada.');
    }

    // Tela de sucesso
    document.getElementById('fp-success-title').textContent = 'Senha alterada!';
    document.getElementById('fp-success-msg').textContent   = 'Sua nova senha foi salva com sucesso.';
    const destBadge = document.getElementById('fp-success-dest');
    if (destBadge) destBadge.style.display = 'none';
    document.getElementById('fp-success-note').textContent =
      'Agora você pode entrar no sistema com sua nova senha.';

    showStep('fp-step-success');
  } catch (err) {
    console.error('Erro ao salvar senha:', err);
    let msg = 'Não foi possível salvar a senha. Tente novamente.';
    if (err.code === 'auth/requires-recent-login' || err.code === 'auth/invalid-action-code' || err.code === 'auth/expired-action-code')
      msg = 'O link de redefinição é inválido ou já expirou. Feche e solicite um novo link.';
    showFpError('fp-newpass-error', msg);
  } finally {
    if (btn) { btn.disabled = false; btn.innerHTML = 'Salvar nova senha'; }
  }
}

// ══════════════════════════════════════════════════════════════════
//  Inputs OTP — helpers e navegação por teclado
// ══════════════════════════════════════════════════════════════════
function getOtpCode() {
  return Array.from(document.querySelectorAll('.otp-input')).map(i => i.value).join('');
}

function clearOtpInputs() {
  document.querySelectorAll('.otp-input').forEach(i => {
    i.value = '';
    i.classList.remove('filled');
  });
}

function initOtpInputs() {
  const inputs = Array.from(document.querySelectorAll('.otp-input'));
  inputs.forEach((input, idx) => {
    // Avança automaticamente ao digitar
    input.addEventListener('input', e => {
      const val = e.target.value.replace(/\D/g, '');
      e.target.value = val;
      e.target.classList.toggle('filled', val.length > 0);
      if (val && idx < inputs.length - 1) inputs[idx + 1].focus();
    });

    // Volta com Backspace
    input.addEventListener('keydown', e => {
      if (e.key === 'Backspace' && !e.target.value && idx > 0) {
        inputs[idx - 1].focus();
        inputs[idx - 1].value = '';
        inputs[idx - 1].classList.remove('filled');
      }
      // Confirma com Enter se todos preenchidos
      if (e.key === 'Enter') {
        e.preventDefault();
        if (getOtpCode().length === 6) handleVerifyOtp();
      }
    });

    // Colar código completo
    input.addEventListener('paste', e => {
      e.preventDefault();
      const pasted = (e.clipboardData || window.clipboardData)
        .getData('text')
        .replace(/\D/g, '')
        .slice(0, 6);
      inputs.forEach((inp, i) => {
        inp.value = pasted[i] || '';
        inp.classList.toggle('filled', !!pasted[i]);
      });
      const nextEmpty = inputs.findIndex(i => !i.value);
      (nextEmpty === -1 ? inputs[inputs.length - 1] : inputs[nextEmpty]).focus();
    });

    // Seleciona o conteúdo ao focar
    input.addEventListener('focus', () => input.select());
  });
}

// ══════════════════════════════════════════════════════════════════
//  Indicador de força de senha
// ══════════════════════════════════════════════════════════════════
function calcPasswordStrength(password) {
  let score = 0;
  if (password.length >= 6)  score++;
  if (password.length >= 10) score++;
  if (/[A-Z]/.test(password)) score++;
  if (/[0-9]/.test(password)) score++;
  if (/[^A-Za-z0-9]/.test(password)) score++;

  if (score <= 1) return { label: 'Fraca',   color: '#ef4444', width: '20%' };
  if (score <= 2) return { label: 'Regular',  color: '#f59e0b', width: '50%' };
  if (score <= 3) return { label: 'Boa',      color: '#10b981', width: '75%' };
  return               { label: 'Forte',     color: '#059669', width: '100%' };
}

function initStrengthMeter() {
  const passInput = document.getElementById('fp-new-password');
  const fill  = document.getElementById('fp-strength-fill');
  const label = document.getElementById('fp-strength-label');
  if (!passInput || !fill || !label) return;

  passInput.addEventListener('input', () => {
    const val = passInput.value;
    if (!val) {
      fill.style.width = '0';
      fill.style.background = '';
      label.textContent = '';
      label.style.color = '';
      return;
    }
    const s = calcPasswordStrength(val);
    fill.style.width      = s.width;
    fill.style.background = s.color;
    label.textContent     = s.label;
    label.style.color     = s.color;
  });
}

// ══════════════════════════════════════════════════════════════════
//  Inicialização de todos os event listeners do modal
// ══════════════════════════════════════════════════════════════════
function initForgotPasswordEvents() {
  // Abre o modal
  document.getElementById('btn-forgot-password')?.addEventListener('click', openForgotModal);

  // Fecha ao clicar no overlay
  modalForgot?.addEventListener('click', e => {
    if (e.target === modalForgot) closeForgotModal();
  });

  // Fecha com Escape
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && modalForgot?.classList.contains('active')) closeForgotModal();
  });

  // ── Etapa 1 ─────────────────────────────────────────────────────
  document.getElementById('btn-fp-close-1')?.addEventListener('click', closeForgotModal);
  document.getElementById('btn-fp-cancel-1')?.addEventListener('click', closeForgotModal);
  document.getElementById('btn-fp-identify')?.addEventListener('click', handleIdentify);
  document.getElementById('fp-email')?.addEventListener('keydown', e => {
    if (e.key === 'Enter') { e.preventDefault(); handleIdentify(); }
  });
  document.getElementById('fp-email')?.addEventListener('input', () => hideFpError('fp-identify-error'));

  // ── Etapa 2 ─────────────────────────────────────────────────────
  document.getElementById('btn-fp-close-2')?.addEventListener('click', closeForgotModal);
  document.getElementById('btn-fp-back-2')?.addEventListener('click', () => showStep('fp-step-identify'));
  document.getElementById('fp-email-card')?.addEventListener('click', handleEmailRecovery);
  document.getElementById('fp-sms-card')?.addEventListener('click', handleSmsRecovery);

  // ── Etapa 3 ─────────────────────────────────────────────────────
  document.getElementById('btn-fp-close-3')?.addEventListener('click', closeForgotModal);
  document.getElementById('btn-fp-back-3')?.addEventListener('click', () => showStep('fp-step-method'));
  document.getElementById('btn-fp-verify-otp')?.addEventListener('click', handleVerifyOtp);
  document.getElementById('btn-fp-resend')?.addEventListener('click', handleResendOtp);

  // ── Etapa 4 ─────────────────────────────────────────────────────
  document.getElementById('btn-fp-close-4')?.addEventListener('click', closeForgotModal);
  document.getElementById('btn-fp-save-password')?.addEventListener('click', handleSetNewPassword);
  document.getElementById('fp-confirm-password')?.addEventListener('keydown', e => {
    if (e.key === 'Enter') { e.preventDefault(); handleSetNewPassword(); }
  });

  // ── Etapa 5 (Sucesso) ────────────────────────────────────────────
  document.getElementById('btn-fp-done')?.addEventListener('click', closeForgotModal);

  // ── Inicializações de sub-componentes ───────────────────────────
  initOtpInputs();
  initStrengthMeter();
  checkUrlResetCode();
}

async function checkUrlResetCode() {
  const urlParams = new URLSearchParams(window.location.search);
  const mode = urlParams.get('mode');
  const oobCode = urlParams.get('oobCode');

  if (mode === 'resetPassword' && oobCode) {
    try {
      const email = await verifyPasswordResetCode(auth, oobCode);
      _recoveryResetCode = oobCode;
      if (modalForgot) modalForgot.classList.add('active');
      showStep('fp-step-newpass');
      const noteEl = document.getElementById('fp-newpass-error');
      if (noteEl) {
        hideFpError('fp-newpass-error');
      }
    } catch (err) {
      console.error('Link de redefinição inválido ou expirado:', err);
      if (modalForgot) modalForgot.classList.add('active');
      showStep('fp-step-identify');
      showFpError('fp-identify-error', 'O link de redefinição de senha é inválido ou já expirou. Por favor, solicite um novo.');
    }
  }
}

// ══════════════════════════════════════════════════════════════════
//  Login
// ══════════════════════════════════════════════════════════════════
function initLoginForm() {
  const loginForm         = document.getElementById('login-form');
  const emailInput        = document.getElementById('email');
  const passwordInput     = document.getElementById('password');
  const errorMessage      = document.getElementById('error-message');
  const btnLogin          = document.getElementById('btn-login');
  const btnTogglePassword = document.getElementById('btn-toggle-password');

  if (btnTogglePassword) {
    btnTogglePassword.addEventListener('click', () => {
      const isPassword = passwordInput.type === 'password';
      passwordInput.type = isPassword ? 'text' : 'password';
      btnTogglePassword.innerHTML = `<span data-icon="${isPassword ? 'eye-off' : 'eye'}" class="icon-sm"></span>`;
      insertSVGs();
    });
  }

  if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const email    = emailInput.value;
      const password = passwordInput.value;

      errorMessage.classList.add('hidden');
      btnLogin.disabled  = true;
      btnLogin.innerText = 'Entrando...';

      try {
        const userCredential = await signInWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;

        const userDocSnap = await getDoc(doc(db, 'users', user.uid));

        if (userDocSnap.exists()) {
          const userData = userDocSnap.data();
          window.location.href = userData.role === 'admin' ? 'admin.html' : 'dashboard.html';
        } else {
          throw new Error('Usuário não encontrado no banco de dados.');
        }
      } catch (error) {
        console.error('Erro no login:', error);
        errorMessage.classList.remove('hidden');
        errorMessage.innerText = error.code === 'auth/invalid-credential'
          ? 'Email ou senha incorretos.'
          : 'Erro ao fazer login. Tente novamente.';
      } finally {
        btnLogin.disabled  = false;
        btnLogin.innerText = 'Entrar no Sistema';
      }
    });
  }
}

// ══════════════════════════════════════════════════════════════════
//  Bootstrap
// ══════════════════════════════════════════════════════════════════
initForgotPasswordEvents();
initLoginForm();
