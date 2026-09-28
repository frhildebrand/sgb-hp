// Globaler Status & Variablen
let currentUserRole = localStorage.getItem('userRole') || 'betrachter';
let currentTab = 'aushang';

// --- SMART DARKMODE LOGIK ---
function initTheme() {
  const savedTheme = localStorage.getItem('theme');
  const systemPrefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;

  if (savedTheme === 'dark' || (!savedTheme && systemPrefersDark)) {
    document.documentElement.classList.add('dark');
    updateThemeIcon(true);
  } else {
    document.documentElement.classList.remove('dark');
    updateThemeIcon(false);
  }
}

function toggleTheme() {
  const isDark = document.documentElement.classList.toggle('dark');
  localStorage.setItem('theme', isDark ? 'dark' : 'light');
  updateThemeIcon(isDark);
}

function updateThemeIcon(isDark) {
  const icon = document.getElementById('themeToggleIcon');
  if (icon) {
    icon.innerText = isDark ? '☀️' : '🌙';
  }
}

// System-Theme-Änderungen live mitverfolgen (falls kein manuelles Override gewählt wurde)
window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
  if (!localStorage.getItem('theme')) {
    if (e.matches) {
      document.documentElement.classList.add('dark');
      updateThemeIcon(true);
    } else {
      document.documentElement.classList.remove('dark');
      updateThemeIcon(false);
    }
  }
});

// --- MODAL & LOGIN LOGIK ---
function openLoginModal() {
  const modal = document.getElementById('loginModal');
  if (modal) modal.classList.remove('hidden');
}

function closeLoginModal() {
  const modal = document.getElementById('loginModal');
  if (modal) modal.classList.add('hidden');
  const pwdInput = document.getElementById('loginPasswordInput');
  if (pwdInput) pwdInput.value = '';
}

function submitLogin() {
  const pwdInput = document.getElementById('loginPasswordInput');
  const pwd = pwdInput ? pwdInput.value.trim() : '';

  if (pwd === 'admin123') {
    setRole('admin');
    closeLoginModal();
  } else if (pwd === 'helfer123') {
    setRole('helfer');
    closeLoginModal();
  } else {
    alert('Falsches Passwort!');
  }
}

function setRole(role) {
  currentUserRole = role;
  localStorage.setItem('userRole', role);
  applyRolePermissions(role);
}

// --- GAST-SPERRE & ROLLEN-PERMISSIONS ---
function applyRolePermissions(role) {
  currentUserRole = role;
  const burgerBtn = document.getElementById('burgerMenuBtn');
  const guestNotice = document.getElementById('guestLockNotice');
  const roleLabel = document.getElementById('roleLabel');
  const roleIcon = document.getElementById('roleIcon');

  if (roleLabel) roleLabel.innerText = role.toUpperCase();

  if (role === 'guest' || role === 'betrachter') {
    if (burgerBtn) burgerBtn.classList.add('hidden');
    if (guestNotice) guestNotice.classList.remove('hidden');
    if (roleIcon) roleIcon.innerText = '👁️';
    switchView('aushang');
  } else {
    if (burgerBtn) burgerBtn.classList.remove('hidden');
    if (guestNotice) guestNotice.classList.add('hidden');
    if (roleIcon) roleIcon.innerText = '🔓';
  }
}

// --- NAVIGATION & VIEWS WECHSELN ---
function switchView(viewName) {
  // Zugriffssperre für Gäste
  if ((currentUserRole === 'betrachter' || currentUserRole === 'guest') && viewName !== 'aushang') {
    return;
  }

  currentTab = viewName;

  // Alle Ansichten ausblenden
  const views = document.querySelectorAll('main > div[id^="view"]');
  views.forEach(v => v.classList.add('hidden'));

  // Target-View einblenden
  const targetId = 'view' + viewName.charAt(0).toUpperCase() + viewName.slice(1);
  const targetView = document.getElementById(targetId);
  if (targetView) {
    targetView.classList.remove('hidden');
  }

  // Burger Modal schließen
  const navModal = document.getElementById('navigationModal');
  if (navModal) navModal.classList.add('hidden');

  // Dynamisches Nachladen der View-Daten
  renderActiveViewData(viewName);
}

function toggleBurgerMenu() {
  const navModal = document.getElementById('navigationModal');
  if (navModal) navModal.classList.toggle('hidden');
}

// --- DYNAMISCHES RENDERN DER ANSICHTEN ---
function renderActiveViewData(viewName) {
  switch (viewName) {
    case 'inventar':
      renderInventar();
      break;
    case 'verkauf':
      renderVerkauf();
      break;
    case 'statistik':
      renderStatistik();
      break;
    case 'einkaufsliste':
      renderEinkaufsliste();
      break;
    case 'lagerbestand':
      renderLagerbestand();
      break;
    case 'boxen':
      renderBoxen();
      break;
    case 'rezepte':
      renderRezepte();
      break;
    default:
      break;
  }
}

// --- DUMMY RENDER FUNKTIONEN FÜR VERSPRECHENE ANSICHTEN ---
function renderInventar() {
  const container = document.getElementById('inventarList');
  if (!container) return;
  // Falls Daten aus weihnachtsmarkt-data.js vorhanden sind
  if (window.inventarData) {
    container.innerHTML = window.inventarData.map(item => `
      <div class="flex justify-between items-center p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl">
        <span class="font-medium text-slate-800 dark:text-slate-200">${item.name}</span>
        <span class="text-xs px-2 py-1 bg-slate-200 dark:bg-slate-700 rounded-lg">${item.anzahl}x</span>
      </div>
    `).join('');
  }
}

function renderVerkauf() {
  // Logik für Kassen-Erfassung & Verkaufs-Grid
}

function renderStatistik() {
  // Logik für Tages-Auswertungen & Reingewinn-Rechner
}

function renderEinkaufsliste() {
  // Logik für Einkaufsliste & Abhaken
}

function renderLagerbestand() {
  // Logik für Live-Bestand
}

function renderBoxen() {
  // Logik für Kisten- & Transportboxenübersicht
}

function renderRezepte() {
  // Logik für Teig- & Rezeptrechner
}

// --- INITIALISIERUNG BEIM SEITENAUFRUF ---
document.addEventListener('DOMContentLoaded', () => {
  initTheme();
  applyRolePermissions(currentUserRole);
});
