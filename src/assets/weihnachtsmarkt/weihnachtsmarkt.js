// Google Apps Script Web-App URL
const GOOGLE_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbyQg2LmxT_UbLXjFVKrNf9gXnqgk_ku4V_P1SZeSGqphn-WRTYI3a9l5szzkDfqEE881Q/exec';

// Globale Variablen
window.currentUserRole = localStorage.getItem('userRole') || 'gast';
window.inventarData = [];
window.isEditMode = false;
window.currentFilterStatus = 'alle';

// 1. THEME ENGINE
window.initTheme = function() {
  const savedTheme = localStorage.getItem('theme');
  const systemPrefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  window.applyDarkMode(savedTheme === 'dark' || (!savedTheme && systemPrefersDark));
};

window.applyDarkMode = function(isDark) {
  if (isDark) {
    document.documentElement.classList.add('dark');
    if (document.body) document.body.classList.add('dark');
  } else {
    document.documentElement.classList.remove('dark');
    if (document.body) document.body.classList.remove('dark');
  }
  const icon = document.getElementById('themeToggleIcon');
  if (icon) icon.innerText = isDark ? '☀️' : '🌙';
};

window.toggleTheme = function() {
  const isDarkCurrently = document.documentElement.classList.contains('dark');
  const newDarkState = !isDarkCurrently;
  localStorage.setItem('theme', newDarkState ? 'dark' : 'light');
  window.applyDarkMode(newDarkState);
};

// 2. NAVIGATION & ROLLEN
window.switchView = function(viewName) {
  if (window.currentUserRole === 'gast' && viewName !== 'aushang' && viewName !== 'login') {
    return;
  }

  const views = document.querySelectorAll('main > div[id^="view"]');
  views.forEach(v => v.classList.add('hidden'));

  const targetId = 'view' + viewName.charAt(0).toUpperCase() + viewName.slice(1);
  const targetView = document.getElementById(targetId);
  if (targetView) {
    targetView.classList.remove('hidden');
    if (viewName === 'inventar') {
      window.loadInventarFromGoogleSheets();
    }
  }

  const navModal = document.getElementById('navigationModal');
  if (navModal) navModal.classList.add('hidden');
};

window.toggleBurgerMenu = function() {
  const navModal = document.getElementById('navigationModal');
  if (navModal) navModal.classList.toggle('hidden');
};

window.tryLogin = function(role, inputId) {
  const passwords = { helfer: '1', orga: '2', admin: '3' };
  const input = document.getElementById(inputId);
  const password = input ? input.value.trim() : '';
  const errorBox = document.getElementById('loginErrorMessage');

  if (password === passwords[role]) {
    if (errorBox) errorBox.classList.add('hidden');
    if (input) input.value = '';
    window.setRole(role);
  } else if (errorBox) {
    errorBox.classList.remove('hidden');
    const errText = document.getElementById('loginErrorText');
    if (errText) errText.innerText = 'Falsches Passwort.';
  }
};

window.setRole = function(role) {
  window.currentUserRole = role;
  localStorage.setItem('userRole', role);
  window.applyRolePermissions(role);
};

window.applyRolePermissions = function(role) {
  window.currentUserRole = role;
  const burgerBtn = document.getElementById('burgerMenuBtn');
  const guestNotice = document.getElementById('guestLockNotice');
  const roleLabel = document.getElementById('roleLabel');
  const roleIcon = document.getElementById('roleIcon');
  const adminEditBtn = document.getElementById('adminInventarEditBtn');

  if (roleLabel) {
    roleLabel.innerText = role === 'admin' ? '🟢 ADMIN' : (role === 'orga' ? '🔵 ORGA' : (role === 'helfer' ? '🟡 HELFER' : 'GAST'));
  }

  if (adminEditBtn) {
    if (role === 'admin' || role === 'orga') adminEditBtn.classList.remove('hidden');
    else {
      adminEditBtn.classList.add('hidden');
      window.isEditMode = false;
    }
  }

  if (role === 'gast') {
    if (burgerBtn) burgerBtn.classList.add('hidden');
    if (guestNotice) guestNotice.classList.remove('hidden');
    if (roleIcon) roleIcon.innerText = '👁️';
    window.switchView('aushang');
  } else {
    if (burgerBtn) burgerBtn.classList.remove('hidden');
    if (guestNotice) guestNotice.classList.add('hidden');
    if (roleIcon) roleIcon.innerText = '🔓';
    window.switchView('aushang');
  }
};

// 3. INVENTAR & GOOGLE SHEETS
window.loadInventarFromGoogleSheets = async function() {
  const progressText = document.getElementById('inventarProgressText');
  if (progressText) progressText.innerText = 'Lade Daten...';

  try {
    const res = await fetch(GOOGLE_SCRIPT_URL);
    const data = await res.json();
    if (Array.isArray(data) && data.length > 0) {
      window.inventarData = data;
    }
  } catch (e) {
    console.error('Fehler beim Laden aus Google Sheets', e);
  }
  
  window.renderInventar();
};

window.renderInventar = function() {
  const container = document.getElementById('inventarTablesContainer');
  if (!container) return;

  if (!window.inventarData || window.inventarData.length === 0) {
    container.innerHTML = '<p class="text-xs text-slate-400 p-4">Keine Daten geladen.</p>';
    return;
  }

  container.innerHTML = '<p class="text-xs text-emerald-500 font-bold p-4">✅ Daten erfolgreich geladen! Anforderung der Tabellenansicht...</p>';
};

window.openLightbox = function(imgSrc, title) {
  window.open(imgSrc, '_blank');
};

// Autostart
document.addEventListener('DOMContentLoaded', () => {
  window.initTheme();
  window.applyRolePermissions(window.currentUserRole);
});
 
Das ist eder letzte code, bei dem alle menüs funktionierten also zumindest burgermenü un dso
