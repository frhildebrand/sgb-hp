// Status direkt beim Start auf Gast setzen, falls nichts gespeichert ist
let currentUserRole = localStorage.getItem('userRole') || 'gast';

const ROLE_PASSWORDS = {
  helfer: '1',
  orga: '2',
  admin: '3'
};

// --- DARKMODE ENGINE ---
function initTheme() {
  const savedTheme = localStorage.getItem('theme');
  const systemPrefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;

  if (savedTheme === 'dark' || (!savedTheme && systemPrefersDark)) {
    applyDarkMode(true);
  } else {
    applyDarkMode(false);
  }
}

function applyDarkMode(isDark) {
  if (isDark) {
    document.documentElement.classList.add('dark');
    document.body.classList.add('dark');
  } else {
    document.documentElement.classList.remove('dark');
    document.body.classList.remove('dark');
  }
  updateThemeIcon(isDark);
}

function toggleTheme() {
  const isDarkCurrently = document.documentElement.classList.contains('dark');
  const newDarkState = !isDarkCurrently;
  
  localStorage.setItem('theme', newDarkState ? 'dark' : 'light');
  applyDarkMode(newDarkState);
}

function updateThemeIcon(isDark) {
  const icon = document.getElementById('themeToggleIcon');
  if (icon) {
    icon.innerText = isDark ? '☀️' : '🌙';
  }
}

// --- LOGIN LOGIK ---
function tryLogin(role, inputId) {
  const input = document.getElementById(inputId);
  const password = input ? input.value.trim() : '';
  const errorBox = document.getElementById('loginErrorMessage');

  if (password === ROLE_PASSWORDS[role]) {
    if (errorBox) errorBox.classList.add('hidden');
    if (input) input.value = '';
    setRole(role);
  } else {
    if (errorBox) {
      errorBox.classList.remove('hidden');
      const errText = document.getElementById('loginErrorText');
      if (errText) errText.innerText = 'Falsches Passwort für die Rolle ' + role.toUpperCase() + '.';
    }
  }
}

function setRole(role) {
  currentUserRole = role;
  localStorage.setItem('userRole', role);
  applyRolePermissions(role);
}

// --- PERMISSIONS & GAST-MODUS ---
function applyRolePermissions(role) {
  currentUserRole = role;
  const burgerBtn = document.getElementById('burgerMenuBtn');
  const guestNotice = document.getElementById('guestLockNotice');
  const roleLabel = document.getElementById('roleLabel');
  const roleIcon = document.getElementById('roleIcon');

  if (roleLabel) {
    roleLabel.innerText = role === 'admin' ? '🟢 ADMIN' : (role === 'orga' ? '🔵 ORGA' : (role === 'helfer' ? '🟡 HELFER' : 'GAST'));
  }

  if (role === 'gast') {
    if (burgerBtn) burgerBtn.classList.add('hidden');
    if (guestNotice) guestNotice.classList.remove('hidden');
    if (roleIcon) roleIcon.innerText = '👁️';
    switchView('aushang');
  } else {
    if (burgerBtn) burgerBtn.classList.remove('hidden');
    if (guestNotice) guestNotice.classList.add('hidden');
    if (roleIcon) roleIcon.innerText = '🔓';
    switchView('aushang');
  }
}

// --- VIEWS & BURGER MENU ---
function switchView(viewName) {
  if (currentUserRole === 'gast' && viewName !== 'aushang' && viewName !== 'login') {
    return;
  }

  const views = document.querySelectorAll('main > div[id^="view"]');
  views.forEach(v => v.classList.add('hidden'));

  const targetId = 'view' + viewName.charAt(0).toUpperCase() + viewName.slice(1);
  const targetView = document.getElementById(targetId);
  if (targetView) {
    targetView.classList.remove('hidden');
  }

  const navModal = document.getElementById('navigationModal');
  if (navModal) navModal.classList.add('hidden');
}

function toggleBurgerMenu() {
  const navModal = document.getElementById('navigationModal');
  if (navModal) {
    navModal.classList.toggle('hidden');
  }
}

function openLightbox(imgSrc, title) {
  window.open(imgSrc, '_blank');
}

// Initialisierung sofort beim Aufruf
document.addEventListener('DOMContentLoaded', () => {
  initTheme();
  applyRolePermissions(currentUserRole);
});
