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

// Hilfsfunktion für die Farben im Inventar
function getStatusColorClass(status) {
  switch (status) {
    case 'Offen': return 'bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/30';
    case 'Vorbereitet': return 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30';
    case 'Verteilt': return 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/30';
    case 'Erledigt': return 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30';
    default: return 'bg-slate-100 text-slate-600 border-slate-200';
  }
}

// NUR HIER WURDE DIE TABELLENANSICHT EINGEFÜGT:
window.renderInventar = function() {
  const container = document.getElementById('inventarTablesContainer');
  if (!container) return;

  if (!window.inventarData || window.inventarData.length === 0) {
    container.innerHTML = '<p class="text-xs text-slate-400 p-4">Keine Daten geladen.</p>';
    return;
  }

  const categories = {};
  window.inventarData.forEach((item, index) => {
    const cat = item.kategorie || 'SONSTIGES';
    if (!categories[cat]) categories[cat] = [];
    categories[cat].push({ ...item, originalIndex: index });
  });

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
              <tr class="border-b border-slate-200 dark:border-slate-800 text-[10px] font-bold uppercase text-slate-400 dark:text-slate-500 bg-slate-50/50 dark:bg-slate-900/50">
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
                <tr class="hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors">
                  <td class="py-2.5 px-4 font-bold text-slate-800 dark:text-slate-200">
                    <div>${item.gegenstand \vert{}\vert{} ''}</div>${item.beschreibung ? `<div class="text-[10px] font-normal text-slate-400 dark:text-slate-500">${item.beschreibung}</div>` : ''}
                  </td>
                  <td class="py-2.5 px-2 text-center font-bold">${item.bedarf || 0}</td>
                  <td class="py-2.5 px-2 text-center font-bold">${item.lager || 0}</td>
                  <td class="py-2.5 px-2 text-center">
                    <span class="px-2 py-1 rounded-lg text-[10px] font-bold border ${getStatusColorClass(item.status)}">${item.status || 'Offen'}</span>
                  </td>
                  <td class="py-2.5 px-2">${item.wer || '-'}</td>
                  <td class="py-2.5 px-2 text-center">${item.pack ? '✅' : '⬜'}</td>
                  <td class="py-2.5 px-2 text-center">${item.box || '-'}</td>
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

// Autostart
document.addEventListener('DOMContentLoaded', () => {
  window.initTheme();
  window.applyRolePermissions(window.currentUserRole);
});
