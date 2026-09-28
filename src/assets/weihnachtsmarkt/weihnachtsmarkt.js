// Globaler Status für die Rolle (Standard: 'betrachter')
let currentUserRole = localStorage.getItem('userRole') || 'betrachter';

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

// System-Theme-Änderungen live mitverfolgen (falls Nutzer kein manuelles Override gewählt hat)
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

// --- ANSICHTEN WECHSELN (VIEWS) ---
function switchView(viewName) {
  // Wenn Rolle Betrachter/Gast ist, darf nur 'aushang' aufgerufen werden
  if ((currentUserRole === 'betrachter' || currentUserRole === 'guest') && viewName !== 'aushang') {
    console.warn('Zugriff verweigert: Nur Aushang erlaubt.');
    return;
  }

  // Alle Views ausblenden
  const views = document.querySelectorAll('main > div[id^="view"]');
  views.forEach(v => v.classList.add('hidden'));

  // Gewünschte View einblenden
  const targetView = document.getElementById('view' + viewName.charAt(0).toUpperCase() + viewName.slice(1));
  if (targetView) {
    targetView.classList.remove('hidden');
  }

  // Burger-Menü schließen nach Auswahl
  const navModal = document.getElementById('navigationModal');
  if (navModal) {
    navModal.classList.add('hidden');
  }
}

// --- BURGER MENÜ TOGGLE ---
function toggleBurgerMenu() {
  const navModal = document.getElementById('navigationModal');
  if (navModal) {
    navModal.classList.toggle('hidden');
  }
}

// --- GAST-SPERRE & ROLLEN-LOGIK ---
function applyRolePermissions(role) {
  currentUserRole = role;
  localStorage.setItem('userRole', role);

  const burgerBtn = document.getElementById('burgerMenuBtn');
  const guestNotice = document.getElementById('guestLockNotice');
  const roleLabel = document.getElementById('roleLabel');
  const roleIcon = document.getElementById('roleIcon');

  if (roleLabel) roleLabel.innerText = role.toUpperCase();

  if (role === 'guest' || role === 'betrachter') {
    // Gast-Modus: Menü-Button ausblenden, Hinweis anzeigen, auf Aushang zwingen
    if (burgerBtn) burgerBtn.classList.add('hidden');
    if (guestNotice) guestNotice.classList.remove('hidden');
    if (roleIcon) roleIcon.innerText = '👁️';
    
    switchView('aushang');
  } else {
    // Eingeloggt: Menü-Button anzeigen, Hinweis ausblenden
    if (burgerBtn) burgerBtn.classList.remove('hidden');
    if (guestNotice) guestNotice.classList.add('hidden');
    if (roleIcon) roleIcon.innerText = '🔓';
  }
}

// Beim Laden der Seite initialisieren
document.addEventListener('DOMContentLoaded', () => {
  initTheme();
  applyRolePermissions(currentUserRole);
});
