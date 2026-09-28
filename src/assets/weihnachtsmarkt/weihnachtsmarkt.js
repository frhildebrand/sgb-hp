// Google Apps Script Web-App URL
const GOOGLE_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbyQg2LmxT_UbLXjFVKrNf9gXnqgk_ku4V_P1SZeSGqphn-WRTYI3a9l5szzkDfqEE881Q/exec';

// Status & Daten
let currentUserRole = localStorage.getItem('userRole') || 'gast';
let inventarData = [];
let isEditMode = false;
let currentFilterStatus = 'alle';

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

// --- LOGIN & RECHTE ---
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
      if (errText) errText.innerText = 'Falsches Passwort für ' + role.toUpperCase() + '.';
    }
  }
}

function setRole(role) {
  currentUserRole = role;
  localStorage.setItem('userRole', role);
  applyRolePermissions(role);
}

function applyRolePermissions(role) {
  currentUserRole = role;
  const burgerBtn = document.getElementById('burgerMenuBtn');
  const guestNotice = document.getElementById('guestLockNotice');
  const roleLabel = document.getElementById('roleLabel');
  const roleIcon = document.getElementById('roleIcon');
  const adminEditBtn = document.getElementById('adminInventarEditBtn');

  if (roleLabel) {
    roleLabel.innerText = role === 'admin' ? '🟢 ADMIN' : (role === 'orga' ? '🔵 ORGA' : (role === 'helfer' ? '🟡 HELFER' : 'GAST'));
  }

  // Admin / Orga Button zum Verwalten von Gegenständen einblenden
  if (adminEditBtn) {
    if (role === 'admin' || role === 'orga') {
      adminEditBtn.classList.remove('hidden');
    } else {
      adminEditBtn.classList.add('hidden');
      isEditMode = false;
    }
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
    if (viewName === 'inventar') {
      loadInventarFromGoogleSheets();
    }
  }

  const navModal = document.getElementById('navigationModal');
  if (navModal) navModal.classList.add('hidden');
}

function toggleBurgerMenu() {
  const navModal = document.getElementById('navigationModal');
  if (navModal) navModal.classList.toggle('hidden');
}

// --- GOOGLE SHEETS LIVE-SYNC & INVENTAR LOGIK ---
async function loadInventarFromGoogleSheets() {
  const progressText = document.getElementById('inventarProgressText');
  if (progressText) progressText.innerText = 'Lade Daten aus Google Sheets...';

  try {
    const res = await fetch(GOOGLE_SCRIPT_URL);
    const data = await res.json();
    if (Array.isArray(data) && data.length > 0) {
      inventarData = data;
    } else if (window.inventarCategories) {
      inventarData = convertLocalCategoriesToFlat(window.inventarCategories);
    }
  } catch (e) {
    console.error('Fehler beim Laden aus Google Sheets:', e);
    if (window.inventarCategories && inventarData.length === 0) {
      inventarData = convertLocalCategoriesToFlat(window.inventarCategories);
    }
  }
  
  updateCategoryDropdown();
  renderInventar();
}

function convertLocalCategoriesToFlat(categories) {
  let flat = [];
  categories.forEach(cat => {
    cat.items.forEach(item => {
      flat.push({
        kategorie: cat.title.replace(/^[^\w\s]+/, '').trim(),
        gegenstand: item.name,
        beschreibung: item.sub || '',
        bedarf: item.bedarf || 1,
        lager: item.lager || 0,
        status: item.status || 'Offen',
        wer: item.wer || '',
        pack: item.pack || false,
        box: item.box || ''
      });
    });
  });
  return flat;
}

async function saveInventarToGoogleSheets() {
  const progressText = document.getElementById('inventarProgressText');
  if (progressText) progressText.innerText = 'Speichere in Google Sheets...';

  try {
    await fetch(GOOGLE_SCRIPT_URL, {
      method: 'POST',
      mode: 'no-cors',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'updateAll', items: inventarData })
    });
    if (progressText) progressText.innerText = 'Gespeichert!';
    setTimeout(() => calculateProgress(), 2000);
  } catch (e) {
    console.error('Fehler beim Speichern:', e);
    if (progressText) progressText.innerText = 'Fehler beim Speichern!';
  }
}

function renderInventar() {
  const container = document.getElementById('inventarTablesContainer');
  if (!container) return;

  calculateProgress();

  // Gruppieren nach Kategorien
  const categories = {};
  inventarData.forEach((item, index) => {
    const cat = item.kategorie || 'SONSTIGES';
    if (!categories[cat]) categories[cat] = [];
    categories[cat].push({ ...item, originalIndex: index });
  });

  const searchVal = (document.getElementById('inventarSearchInput')?.value || '').toLowerCase();

  let html = '';
  for (const [catName, items] of Object.entries(categories)) {
    const filteredItems = items.filter(item => {
      const matchSearch = item.gegenstand.toLowerCase().includes(searchVal) || (item.wer && item.wer.toLowerCase().includes(searchVal)) || (item.box && item.box.toLowerCase().includes(searchVal));
      const matchStatus = currentFilterStatus === 'alle' || item.status === currentFilterStatus;
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
                ${isEditMode ? '<th class="py-2.5 px-2 text-center w-12">AKTION</th>' : ''}
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-100 dark:divide-slate-800/60">
              ${filteredItems.map(item => `
                <tr class="hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors">
                  <td class="py-2.5 px-4 font-bold text-slate-800 dark:text-slate-200">
                    ${isEditMode ? `
                      <input type="text" value="${item.gegenstand}" onchange="updateItemField(${item.originalIndex}, 'gegenstand', this.value)" class="w-full px-2 py-1 bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-xs font-bold">
                    ` : `
                      <div>${item.gegenstand}</div>
                      ${item.beschreibung ? `<div class="text-[10px] font-normal text-slate-400 dark:text-slate-500">${item.beschreibung}</div>` : ''}
                    `}
                  </td>
                  <td class="py-2.5 px-2 text-center">
                    <input type="number" min="0" value="${item.bedarf}" onchange="updateItemField(${item.originalIndex}, 'bedarf', parseInt(this.value) || 0)" class="w-14 text-center px-1 py-1 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-lg font-bold text-xs">
                  </td>
                  <td class="py-2.5 px-2 text-center">
                    <input type="number" min="0" value="${item.lager}" onchange="updateItemField(${item.originalIndex}, 'lager', parseInt(this.value) || 0)" class="w-14 text-center px-1 py-1 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-lg font-bold text-xs">
                  </td>
                  <td class="py-2.5 px-2 text-center">
                    <select onchange="updateItemField(${item.originalIndex}, 'status', this.value)" class="px-2 py-1 rounded-lg text-[10px] font-bold border focus:outline-none ${getStatusColorClass(item.status)}">
                      <option value="Offen" ${item.status === 'Offen' ? 'selected' : ''}>🔴 Offen</option>
                      <option value="Vorbereitet" ${item.status === 'Vorbereitet' ? 'selected' : ''}>🟡 Vorbereitet</option>
                      <option value="Verteilt" ${item.status === 'Verteilt' ? 'selected' : ''}>🟣 Verteilt</option>
                      <option value="Erledigt" ${item.status === 'Erledigt' ? 'selected' : ''}>🟢 Erledigt</option>
                    </select>
                  </td>
                  <td class="py-2.5 px-2">
                    <input type="text" placeholder="Name..." value="${item.wer \vert{}\vert{} ''}" onchange="updateItemField(${item.originalIndex}, 'wer', this.value)" class="w-full px-2 py-1 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-lg text-[11px] focus:outline-none focus:ring-1 focus:ring-amber-500">
                  </td>
                  <td class="py-2.5 px-2 text-center">
                    <input type="checkbox" ${item.pack ? 'checked' : ''} onchange="updateItemField(${item.originalIndex}, 'pack', this.checked)" class="w-4 h-4 rounded border-slate-300 text-amber-500 focus:ring-amber-500 cursor-pointer">
                  </td>
                  <td class="py-2.5 px-2 text-center">
                    <input type="text" placeholder="Box..." value="${item.box \vert{}\vert{} ''}" onchange="updateItemField(${item.originalIndex}, 'box', this.value)" class="w-16 text-center px-1 py-1 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-lg text-[11px]">
                  </td>
                  ${isEditMode ? `
                    <td class="py-2.5 px-2 text-center">
                      <button onclick="deleteItem(${item.originalIndex})" class="p-1 bg-red-500/10 text-red-500 hover:bg-red-500/20 rounded-lg text-xs cursor-pointer" title="Löschen">🗑️</button>
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
}

function getStatusColorClass(status) {
  switch (status) {
    case 'Offen': return 'bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/30';
    case 'Vorbereitet': return 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30';
    case 'Verteilt': return 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/30';
    case 'Erledigt': return 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30';
    default: return 'bg-slate-100 text-slate-600 border-slate-200';
  }
}

function updateItemField(index, field, value) {
  if (inventarData[index]) {
    inventarData[index][field] = value;
    renderInventar();
    saveInventarToGoogleSheets();
  }
}

function calculateProgress() {
  const progressText = document.getElementById('inventarProgressText');
  if (!progressText || inventarData.length === 0) return;

  const erledigt = inventarData.filter(i => i.status === 'Erledigt').length;
  const total = inventarData.length;
  const percent = Math.round((erledigt / total) * 100);

  progressText.innerText = `${percent}% erledigt (${erledigt}/${total})`;
}

function filterInventarTable() {
  renderInventar();
}

function filterInventarStatus(status) {
  currentFilterStatus = status;
  renderInventar();
}

function toggleInventarEditMode() {
  isEditMode = !isEditMode;
  const panel = document.getElementById('addItemPanel');
  if (panel) {
    if (isEditMode) panel.classList.remove('hidden');
    else panel.classList.add('hidden');
  }
  renderInventar();
}

function createNewItem() {
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

  inventarData.push(newItem);
  nameInput.value = '';
  renderInventar();
  saveInventarToGoogleSheets();
}

function deleteItem(index) {
  if (confirm('Möchtest du diesen Gegenstand wirklich löschen?')) {
    inventarData.splice(index, 1);
    renderInventar();
    saveInventarToGoogleSheets();
  }
}

function updateCategoryDropdown() {
  const catSelect = document.getElementById('newItemCategory');
  if (!catSelect) return;

  const categories = [...new Set(inventarData.map(i => i.kategorie || 'SONSTIGES'))];
  catSelect.innerHTML = categories.map(c => `<option value="${c}">${c}</option>`).join('');
}

function openLightbox(imgSrc, title) {
  window.open(imgSrc, '_blank');
}

// Initialisierung
document.addEventListener('DOMContentLoaded', () => {
  initTheme();
  applyRolePermissions(currentUserRole);
});
