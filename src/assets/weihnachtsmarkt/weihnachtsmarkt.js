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

// ---------------------------------------------------------------------
// INVENTAR RENDERN (MIT FORMULARFELDERN & ADMIN-OPTIONEN)
// ---------------------------------------------------------------------
window.renderInventar = function() {
  const container = document.getElementById('inventarTablesContainer');
  if (!container) return;

  if (!window.inventarData || window.inventarData.length === 0) {
    container.innerHTML = '<p class="text-xs text-slate-400 p-4">Keine Daten vorhanden.</p>';
    return;
  }

  // Progress-Text oben leeren
  const progressText = document.getElementById('inventarProgressText');
  if (progressText) progressText.innerText = '';

  // Daten nach Kategorie gruppieren
  const categories = {};
  window.inventarData.forEach((item, index) => {
    const cat = item.kategorie || item.Kategorie || 'SONSTIGES';
    if (!categories[cat]) categories[cat] = [];
    categories[cat].push({ ...item, originalIndex: index });
  });

  const isAdminOrOrga = (window.currentUserRole === 'admin' || window.currentUserRole === 'orga');

  let html = '';
  for (const [catName, items] of Object.entries(categories)) {
    html += `
      <div class="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm mb-6">
        <!-- Kategorie Header -->
        <div class="bg-slate-50 dark:bg-slate-800/60 px-5 py-3.5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <h3 class="font-bold text-sm text-amber-600 dark:text-amber-400 flex items-center gap-2">
            📦 ${catName}
          </h3>
          ${isAdminOrGen(isAdminOrOrga, catName)}
        </div>

        <!-- Tabelle -->
        <div class="overflow-x-auto">
          <table class="w-full text-left text-xs border-collapse">
            <thead>
              <tr class="border-b border-slate-200 dark:border-slate-800 text-[10px] font-bold uppercase text-slate-400 dark:text-slate-500 bg-slate-50/30 dark:bg-slate-900/30">
                <th class="py-3 px-4">GEGENSTAND</th>
                <th class="py-3 px-2 text-center w-20">BENÖTIGT</th>
                <th class="py-3 px-2 text-center w-20">AUF LAGER</th>
                <th class="py-3 px-2 text-center w-32">STATUS</th>
                <th class="py-3 px-2 w-36">VERANTWORTLICH</th>
                <th class="py-3 px-2 text-center w-14">GEPACKT?</th>
                <th class="py-3 px-2 text-center w-20">BOX</th>
                ${isAdminOrOrga ? '<th class="py-3 px-2 text-center w-16">ADMIN</th>' : ''}
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-100 dark:divide-slate-800/60">
              ${items.map(item => renderRowHtml(item, isAdminOrOrga)).join('')}
            </tbody>
          </table>
        </div>
      </div>
    `;
  }

  container.innerHTML = html;
};

// Hilfsfunktion: Admin-Aktionen im Kategorie-Header (Umbenennen / Löschen)
function isAdminOrGen(isAdmin, catName) {
  if (!isAdmin) return '';
  return `
    <div class="flex items-center gap-3 text-xs">
      <button onclick="renameCategory('${catName}')" class="text-slate-400 hover:text-amber-500 flex items-center gap-1 transition-colors">
        ✏️ Umbenennen
      </button>
      <button onclick="deleteCategory('${catName}')" class="text-red-400 hover:text-red-600 flex items-center gap-1 transition-colors">
        🗑️ Löschen
      </button>
    </div>
  `;
}

// Hilfsfunktion: Einzelne Zeile mit den Input-Feldern zusammenbauen
function renderRowHtml(item, isAdmin) {
  const idx = item.originalIndex;
  const statusOptions = ['Offen', 'Vorbereitet', 'Verteilt', 'Erledigt'];
  
  return `
    <tr class="hover:bg-slate-50/80 dark:hover:bg-slate-800/30 transition-colors">
      <td class="py-2.5 px-4 font-bold text-slate-800 dark:text-slate-200">
        <div>${item.gegenstand || item.Gegenstand || ''}</div>
        ${(item.beschreibung || item.Beschreibung) ? `<div class="text-[10px] font-normal text-slate-400">${item.beschreibung || item.Beschreibung}</div>` : ''}
      </td>

      <td class="py-2.5 px-2 text-center">
        <input type="number" value="${item.bedarf || item.Bedarf || ''}" placeholder="-"
          onchange="updateInventarItem(${idx}, 'bedarf', this.value)"
          class="w-16 text-center py-1 px-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 font-bold focus:ring-2 focus:ring-amber-500 outline-none" />
      </td>

      <td class="py-2.5 px-2 text-center">
        <input type="number" value="${item.lager || item.Lager || 0}"
          onchange="updateInventarItem(${idx}, 'lager', this.value)"
          class="w-16 text-center py-1 px-1.5 rounded-lg border border-amber-200 dark:border-amber-900/40 bg-amber-50/30 dark:bg-amber-950/20 font-bold text-amber-700 dark:text-amber-400 focus:ring-2 focus:ring-amber-500 outline-none" />
      </td>

      <td class="py-2.5 px-2 text-center">
        <select onchange="updateInventarItem(${idx}, 'status', this.value)"
          class="w-full text-center py-1 px-2 rounded-lg border border-red-200 dark:border-red-900/40 bg-red-50/40 dark:bg-red-950/20 font-bold text-red-600 dark:text-red-400 text-[11px] focus:ring-2 focus:ring-amber-500 outline-none cursor-pointer">
          ${statusOptions.map(opt => `
            <option value="${opt}" ${(item.status \vert{}\vert{} item.Status) === opt ? 'selected' : ''}>${opt}</option>
          `).join('')}
        </select>
      </td>

      <td class="py-2.5 px-2">
        <input type="text" value="${item.wer || item.Wer || ''}" placeholder="Name..."
          onchange="updateInventarItem(${idx}, 'wer', this.value)"
          class="w-full py-1 px-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 focus:ring-2 focus:ring-amber-500 outline-none" />
      </td>

      <td class="py-2.5 px-2 text-center">
        <input type="checkbox" ${item.pack || item.Pack ? 'checked' : ''}
          onchange="updateInventarItem(${idx}, 'pack', this.checked)"
          class="w-4 h-4 rounded border-slate-300 text-amber-500 focus:ring-amber-500 cursor-pointer" />
      </td>

      <td class="py-2.5 px-2 text-center">
        <input type="text" value="${item.box || item.Box || ''}" placeholder="-"
          onchange="updateInventarItem(${idx}, 'box', this.value)"
          class="w-16 text-center py-1 px-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 focus:ring-2 focus:ring-amber-500 outline-none" />
      </td>

      ${isAdmin ? `
        <td class="py-2.5 px-2 text-center">
          <div class="flex items-center justify-center gap-1">
            <button onclick="editItem(${idx})" class="text-amber-500 hover:text-amber-600 p-1">✏️</button>
            <button onclick="deleteItem(${idx})" class="text-slate-400 hover:text-red-500 p-1">🗑️</button>
          </div>
        </td>
      ` : ''}
    </tr>
  `;
}

// Wertänderungen im lokalen Array speichern
window.updateInventarItem = function(index, field, value) {
  if (window.inventarData && window.inventarData[index]) {
    window.inventarData[index][field] = value;
  }
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
