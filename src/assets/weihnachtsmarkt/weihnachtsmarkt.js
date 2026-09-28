// Google Apps Script Web-App URL
const GOOGLE_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbyQg2LmxT_UbLXjFVKrNf9gXnqgk_ku4V_P1SZeSGqphn-WRTYI3a9l5szzkDfqEE881Q/exec';

// Globale Variablen
window.currentUserRole = localStorage.getItem('userRole') || 'gast';
window.inventarData = [];
window.isEditMode = false;
window.currentFilterStatus = 'alle';

const ROLE_PASSWORDS = {
  helfer: '1',
  orga: '2',
  admin: '3'
};

// --- GLOBALE THEME-STEUERUNG ---
window.initTheme = function() {
  const savedTheme = localStorage.getItem('theme');
  const systemPrefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  if (savedTheme === 'dark' || (!savedTheme && systemPrefersDark)) {
    window.applyDarkMode(true);
  } else {
    window.applyDarkMode(false);
  }
};

window.applyDarkMode = function(isDark) {
  if (isDark) {
    document.documentElement.classList.add('dark');
    if (document.body) document.body.classList.add('dark');
  } else {
    document.documentElement.classList.remove('dark');
    if (document.body) document.body.classList.remove('dark');
  }
  window.updateThemeIcon(isDark);
};

window.toggleTheme = function() {
  const isDarkCurrently = document.documentElement.classList.contains('dark');
  const newDarkState = !isDarkCurrently;
  localStorage.setItem('theme', newDarkState ? 'dark' : 'light');
  window.applyDarkMode(newDarkState);
};

window.updateThemeIcon = function(isDark) {
  const icon = document.getElementById('themeToggleIcon');
  if (icon) {
    icon.innerText = isDark ? '☀️' : '🌙';
  }
};

// --- GLOBALE NAVIGATION & ROLLEN ---
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
  const input = document.getElementById(inputId);
  const password = input ? input.value.trim() : '';
  const errorBox = document.getElementById('loginErrorMessage');

  if (password === ROLE_PASSWORDS[role]) {
    if (errorBox) errorBox.classList.add('hidden');
    if (input) input.value = '';
    window.setRole(role);
  } else {
    if (errorBox) {
      errorBox.classList.remove('hidden');
      const errText = document.getElementById('loginErrorText');
      if (errText) errText.innerText = 'Falsches Passwort für ' + role.toUpperCase() + '.';
    }
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
    if (role === 'admin' || role === 'orga') {
      adminEditBtn.classList.remove('hidden');
    } else {
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

// --- GOOGLE SHEETS & INVENTAR LOGIK ---
window.loadInventarFromGoogleSheets = async function() {
  const progressText = document.getElementById('inventarProgressText');
  if (progressText) progressText.innerText = 'Lade Daten...';

  try {
    const res = await fetch(GOOGLE_SCRIPT_URL);
    const data = await res.json();
    if (Array.isArray(data) && data.length > 0) {
      window.inventarData = data;
    } else if (window.inventarCategories) {
      window.inventarData = window.convertLocalCategoriesToFlat(window.inventarCategories);
    }
  } catch (e) {
    if (window.inventarCategories && window.inventarData.length === 0) {
      window.inventarData = window.convertLocalCategoriesToFlat(window.inventarCategories);
    }
  }
  
  window.updateCategoryDropdown();
  window.renderInventar();
};

window.convertLocalCategoriesToFlat = function(categories) {
  let flat = [];
  if (!Array.isArray(categories)) return flat;
  categories.forEach(cat => {
    if (cat.items && Array.isArray(cat.items)) {
      cat.items.forEach(item => {
        flat.push({
          kategorie: cat.title ? cat.title.replace(/^[^\w\s]+/, '').trim() : 'SONSTIGES',
          gegenstand: item.name || '',
          beschreibung: item.sub || '',
          bedarf: item.bedarf || 1,
          lager: item.lager || 0,
          status: item.status || 'Offen',
          wer: item.wer || '',
          pack: item.pack || false,
          box: item.box || ''
        });
      });
    }
  });
  return flat;
};

window.saveInventarToGoogleSheets = async function() {
  const progressText = document.getElementById('inventarProgressText');
  if (progressText) progressText.innerText = 'Speichere...';

  try {
    await fetch(GOOGLE_SCRIPT_URL, {
      method: 'POST',
      mode: 'no-cors',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'updateAll', items: window.inventarData })
    });
    if (progressText) progressText.innerText = 'Gespeichert!';
    setTimeout(() => window.calculateProgress(), 2000);
  } catch (e) {
    console.error(e);
  }
};

window.renderInventar = function() {
  const container = document.getElementById('inventarTablesContainer');
  if (!container) return;

  window.calculateProgress();

  const categories = {};
  window.inventarData.forEach((item, index) => {
    const cat = item.kategorie || 'SONSTIGES';
    if (!categories[cat]) categories[cat] = [];
    categories[cat].push({ ...item, originalIndex: index });
  });

  const searchVal = (document.getElementById('inventarSearchInput')?.value || '').toLowerCase();

  let html = '';
  for (const [catName, items] of Object.entries(categories)) {
    const filteredItems = items.filter(item => {
      const matchSearch = (item.gegenstand || '').toLowerCase().includes(searchVal) || 
                          (item.wer || '').toLowerCase().includes(searchVal) || 
                          (item.box || '').toLowerCase().includes(searchVal);
      const matchStatus = window.currentFilterStatus === 'alle' || item.status === window.currentFilterStatus;
      return matchSearch && matchStatus;
    });

    if (filteredItems.length === 0) continue;

    html += `
      <div class="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm">
        <div class="bg-slate-100 dark:bg-slate-800/80 px-4 py-3 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
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
                ${window.isEditMode ? '<th class="py-2.5 px-2 text-center w-12">AKTION</th>' : ''}
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-100 dark:divide-slate-800/60">
              ${filteredItems.map(item => `
                <tr class="hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors">
                  <td class="py-2.5 px-4 font-bold text-slate-800 dark:text-slate-200">
                    ${window.isEditMode ? `
                      <input type="text" value="${item.gegenstand}" onchange="window.updateItemField(${item.originalIndex}, 'gegenstand', this.value)" class="w-full px-2 py-1 bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-xs font-bold">
                    ` : `
                      <div>${item.gegenstand}</div>
                      ${item.beschreibung ? `<div class="text-[10px] font-normal text-slate-400 dark:text-slate-500">${item.beschreibung}</div>` : ''}
                    `}
                  </td>
                  <td class="py-2.5 px-2 text-center">
                    <input type="number" min="0" value="${item.bedarf}" onchange="window.updateItemField(${item.originalIndex}, 'bedarf', parseInt(this.value) || 0)" class="w-14 text-center px-1 py-1 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-lg font-bold text-xs">
                  </td>
                  <td class="py-2.5 px-2 text-center">
                    <input type="number" min="0" value="${item.lager}" onchange="window.updateItemField(${item.originalIndex}, 'lager', parseInt(this.value) || 0)" class="w-14 text-center px-1 py-1 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-lg font-bold text-xs">
                  </td>
                  <td class="py-2.5 px-2 text-center">
                    <select onchange="window.updateItemField(${item.originalIndex}, 'status', this.value)" class="px-2 py-1 rounded-lg text-[10px] font-bold border focus:outline-none ${window.getStatusColorClass(item.status)}">
                      <option value="Offen" ${item.status === 'Offen' ? 'selected' : ''}>🔴 Offen</option>
                      <option value="Vorbereitet" ${item.status === 'Vorbereitet' ? 'selected' : ''}>🟡 Vorbereitet</option>
                      <option value="Verteilt" ${item.status === 'Verteilt' ? 'selected' : ''}>🟣 Verteilt</option>
                      <option value="Erledigt" ${item.status === 'Erledigt' ? 'selected' : ''}>🟢 Erledigt</option>
                    </select>
                  </td>
                  <td class="py-2.5 px-2">
                    <input type="text" placeholder="Name..." value="${item.wer \vert{}\vert{} ''}" onchange="window.updateItemField(${item.originalIndex}, 'wer', this.value)" class="w-full px-2 py-1 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-lg text-[11px]">
                  </td>
                  <td class="py-2.5 px-2 text-center">
                    <input type="checkbox" ${item.pack ? 'checked' : ''} onchange="window.updateItemField(${item.originalIndex}, 'pack', this.checked)" class="w-4 h-4 rounded border-slate-300 text-amber-500 cursor-pointer">
                  </td>
                  <td class="py-2.5 px-2 text-center">
                    <input type="text" placeholder="Box..." value="${item.box \vert{}\vert{} ''}" onchange="window.updateItemField(${item.originalIndex}, 'box', this.value)" class="w-16 text-center px-1 py-1 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-lg text-[11px]">
                  </td>
                  ${window.isEditMode ? `
                    <td class="py-2.5 px-2 text-center">
                      <button onclick="window.deleteItem(${item.originalIndex})" class="p-1 bg-red-500/10 text-red-500 hover:bg-red-500/20 rounded-lg text-xs cursor-pointer" title="Löschen">🗑️</button>
                    </td>
                  ` : ''}
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

window.getStatusColorClass = function(status) {
  switch (status) {
    case 'Offen': return 'bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/30';
    case 'Vorbereitet': return 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30';
    case 'Verteilt': return 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/30';
    case 'Erledigt': return 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30';
    default: return 'bg-slate-100 text-slate-600 border-slate-200';
  }
};

window.updateItemField = function(index, field, value) {
  if (window.inventarData[index]) {
    window.inventarData[index][field] = value;
    window.renderInventar();
    window.saveInventarToGoogleSheets();
  }
};

window.calculateProgress = function() {
  const progressText = document.getElementById('inventarProgressText');
  if (!progressText || !window.inventarData || window.inventarData.length === 0) return;

  const erledigt = window.inventarData.filter(i => i.status === 'Erledigt').length;
  const total = window.inventarData.length;
  const percent = Math.round((erledigt / total) * 100);

  progressText.innerText = `${percent}% erledigt (${erledigt}/${total})`;
};

window.filterInventarTable = function() {
  window.renderInventar();
};

window.filterInventarStatus = function(status) {
  window.currentFilterStatus = status;
  window.renderInventar();
};

window.toggleInventarEditMode = function() {
  window.isEditMode = !window.isEditMode;
  const panel = document.getElementById('addItemPanel');
  if (panel) {
    if (window.isEditMode) panel.classList.remove('hidden');
    else panel.classList.add('hidden');
  }
  window.renderInventar();
};

window.createNewItem = function() {
  const nameInput = document.getElementById('newItemName');
  const catInput = document.getElementById('newItemCategory');
  const bedarfInput = document.getElementById('newItemBedarf');

  if (!nameInput || !nameInput.value.trim()) return;

  const newItem = {
    kategorie: catInput ? catInput.value : 'SONSTIGES',
    gegenstand: nameInput.value.trim(),
    beschreibung: '',
    bedarf: parseInt(bedarfInput.value) || 1,
    lager: 0,
    status: 'Offen',
    wer: '',
    pack: false,
    box: ''
  };

  window.inventarData.push(newItem);
  nameInput.value = '';
  window.renderInventar();
  window.saveInventarToGoogleSheets();
};

window.deleteItem = function(index) {
  if (confirm('Möchtest du diesen Gegenstand wirklich löschen?')) {
    window.inventarData.splice(index, 1);
    window.renderInventar();
    window.saveInventarToGoogleSheets();
  }
};

window.updateCategoryDropdown = function() {
  const catSelect = document.getElementById('newItemCategory');
  if (!catSelect || !window.inventarData) return;

  const categories = [...new Set(window.inventarData.map(i => i.kategorie || 'SONSTIGES'))];
  catSelect.innerHTML = categories.map(c => `<option value="${c}">${c}</option>`).join('');
};

window.openLightbox = function(imgSrc, title) {
  window.open(imgSrc, '_blank');
};

// Automatischer Start beim Laden
document.addEventListener('DOMContentLoaded', () => {
  window.initTheme();
  window.applyRolePermissions(window.currentUserRole);
});
