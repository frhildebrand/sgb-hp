// Google Apps Script Web-App URL
const GOOGLE_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbyQg2LmxT_UbLXjFVKrNf9gXnqgk_ku4V_P1SZeSGqphn-WRTYI3a9l5szzkDfqEE881Q/exec';

// Globale Variablen
window.currentUserRole = localStorage.getItem('userRole') || 'gast';
window.inventarData = [];
window.isEditMode = false;
window.currentFilterStatus = 'alle';

// ---------------------------------------------------------------------
// 1. THEME ENGINE
// ---------------------------------------------------------------------
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

// ---------------------------------------------------------------------
// 2. NAVIGATION & ROLLEN (SCHRITT 1: OHNE HARTE LOCK-BLOCKADE)
// ---------------------------------------------------------------------
window.switchView = function(viewName) {
  // 1. Alle Ansichten ausblenden
  const views = document.querySelectorAll('main > div[id^="view"]');
  views.forEach(v => v.classList.add('hidden'));

  // 2. Gewünschte Ansicht einblenden
  const targetId = 'view' + viewName.charAt(0).toUpperCase() + viewName.slice(1);
  const targetView = document.getElementById(targetId);
  if (targetView) {
    targetView.classList.remove('hidden');
  }

  // 3. Bei Inventar-Aufruf Daten holen
  if (viewName === 'inventar') {
    window.loadInventarFromGoogleSheets();
  }

  // 4. Burgermenü-Modal schließen, falls offen
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

// ---------------------------------------------------------------------
// 3. INVENTAR (SCHRITT 2: ISOLIERTES DATEN-HANDLING)
// ---------------------------------------------------------------------
window.loadInventarFromGoogleSheets = async function() {
  const container = document.getElementById('inventarTablesContainer');
  if (container) {
    container.innerHTML = '<p class="text-xs text-amber-500 font-bold p-4">⏳ Lade Inventar...</p>';
  }

  try {
    const res = await fetch(GOOGLE_SCRIPT_URL);
    const data = await res.json();
    window.inventarData = Array.isArray(data) ? data : [];
    window.renderInventar();
  } catch (e) {
    console.error('Fehler beim Laden:', e);
    if (container) {
      container.innerHTML = '<p class="text-xs text-red-500 p-4">Fehler beim Laden der Daten aus Google Sheets.</p>';
    }
  }
};

window.renderInventar = function() {
  const container = document.getElementById('inventarTablesContainer');
  if (!container) return;

  if (!window.inventarData || window.inventarData.length === 0) {
    container.innerHTML = '<p class="text-xs text-slate-400 p-4">Keine Daten geladen.</p>';
    return;
  }

  // Nach Kategorien gruppieren
  const categories = {};
  window.inventarData.forEach((item) => {
    const cat = item.kategorie || item.Kategorie || 'SONSTIGES';
    if (!categories[cat]) categories[cat] = [];
    categories[cat].push(item);
  });

  // Tabellen-HTML bauen
  let html = '';
  for (const [catName, items] of Object.entries(categories)) {
    html += `
      <div class="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm mb-4">
        <div class="bg-slate-100 dark:bg-slate-800/80 px-4 py-3 border-b border-slate-200 dark:border-slate-800">
          <h3 class="font-extrabold text-xs text-amber-600 dark:text-amber-400 uppercase tracking-wider">${catName}</h3>
        </div>
        <div class="overflow-x-auto">
          <table class="w-full text-left text-xs border-collapse">
            <thead>
              <tr class="border-b border-slate-200 dark:border-slate-800 text-[10px] font-bold uppercase text-slate-400 bg-slate-50/50 dark:bg-slate-900/50">
                <th class="py-2.5 px-4">GEGENSTAND</th>
                <th class="py-2.5 px-2 text-center w-20">BEDARF</th>
                <th class="py-2.5 px-2 text-center w-20">LAGER</th>
                <th class="py-2.5 px-2 text-center w-28">STATUS</th>
                <th class="py-2.5 px-2 w-32">WER</th>
                <th class="py-2.5 px-2 text-center w-12">PACK</th>
                <th class="py-2.5 px-2 text-center w-20">BOX</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-100 dark:divide-slate-800/60">
              ${items.map(item => `
                <tr class="hover:bg-slate-50 dark:hover:bg-slate-800/30">
                  <td class="py-2.5 px-4 font-bold text-slate-800 dark:text-slate-200">
                    <div>${item.gegenstand \vert{}\vert{} item.Gegenstand \vert{}\vert{} ''}</div>${(item.beschreibung || item.Beschreibung) ? `<div class="text-[10px] font-normal text-slate-400">${item.beschreibung || item.Beschreibung}</div>` : ''}
                  </td>
                  <td class="py-2.5 px-2 text-center font-bold">${item.bedarf || item.Bedarf || 0}</td>
                  <td class="py-2.5 px-2 text-center font-bold">${item.lager || item.Lager || 0}</td>
                  <td class="py-2.5 px-2 text-center">
                    <span class="px-2 py-1 rounded-lg text-[10px] font-bold border bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">${item.status || item.Status || 'Offen'}</span>
                  </td>
                  <td class="py-2.5 px-2">${item.wer || item.Wer || '-'}</td>
                  <td class="py-2.5 px-2 text-center">${(item.pack || item.Pack) ? '✅' : '⬜'}</td>
                  <td class="py-2.5 px-2 text-center">${item.box || item.Box || '-'}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>
    `;
  }

  container.innerHTML = html;
};

window.openLightbox = function(imgSrc, title) {
  window.open(imgSrc, '_blank');
};

// Klick auf GAST/Rolle bringt den User immer zum Login-Screen
document.addEventListener('click', (e) => {
  if (e.target.closest('#roleLabel') || e.target.closest('#guestLockNotice')) {
    window.switchView('login');
  }
});

// Autostart
document.addEventListener('DOMContentLoaded', () => {
  window.initTheme();
  window.applyRolePermissions(window.currentUserRole);
});
