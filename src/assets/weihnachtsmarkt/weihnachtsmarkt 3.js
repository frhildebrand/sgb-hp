// ==========================================================
// SG BARNSTORF WEIHNACHTSMARKT - MAIN ENGINE (Neuaufbau)
// Prinzip: Alles wird zuerst lokal gespeichert und sofort
// angezeigt. Danach wird im Hintergrund mit Google Sheets
// synchronisiert.
// ==========================================================
const GOOGLE_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbyQg2LmxT_UbLXjFVKrNf9gXnqgk_ku4V_P1SZeSGqphn-WRTYI3a9l5szzkDfqEE881Q/exec';

// Passwoerter (nur Sichtschutz, im Quelltext lesbar)
const ROLE_PASSWORDS = { '1': 'helfer', '2': 'orga', '3': 'admin' };

// Punsch-Rezept: Mengen fuer 4 Liter hier eintragen (null = keine Menge anzeigen)
const PUNSCH_ZUTATEN = [
  { name: 'Roter Traubensaft', pro4l: null, einheit: '' },
  { name: 'Apfelsaft', pro4l: null, einheit: '' },
  { name: 'Orangensaft', pro4l: null, einheit: '' },
  { name: 'Wintertee', pro4l: null, einheit: '' },
  { name: 'Glühfix', pro4l: null, einheit: '' },
  { name: 'Zimtstangen', pro4l: null, einheit: '' }
];

const DEFAULT_KASSE_DATA = {
  kinderpunschPaid: 0,
  kinderpunschFree: 0,
  waffelPaid: 0,
  waffelFree: 0,
  kinderpunschPrice: 2.0,
  waffelPrice: 2.0
};
const DEFAULT_STATUSES_STANDARD = ['Offen', 'Vorbereitet', 'Verteilt', 'Erledigt'];
const DEFAULT_STATUSES_EINKAUF = ['Offen', 'Vorbereitet', 'Verteilt', 'Eingekauft', 'Erledigt'];

const VIEW_IDS = {
  aushang: 'viewAushang',
  login: 'viewLogin',
  inventar: 'viewInventar',
  verkauf: 'viewVerkauf',
  kasse: 'viewVerkauf',
  statistik: 'viewStatistik',
  einkaufsliste: 'viewEinkaufsliste',
  verkabelung: 'viewVerkabelung',
  lagerbestand: 'viewLagerbestand',
  boxen: 'viewBoxenuebersicht',
  rezepte: 'viewRezepte',
  admin: 'viewAdminpanel'
};

// ------------------------------------------
// 0. HILFSFUNKTIONEN
// ------------------------------------------
function lsGet(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw === null ? fallback : JSON.parse(raw);
  } catch (e) {
    return fallback;
  }
}
function lsSet(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (e) {
    console.warn('Lokales Speichern fehlgeschlagen:', e);
  }
}
function clone(obj) {
  return JSON.parse(JSON.stringify(obj));
}
function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
function formatEuro(value) {
  return value.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €';
}
function setText(id, text) {
  const el = document.getElementById(id);
  if (el) el.innerText = text;
}

// ------------------------------------------
// 1. ZUSTAND (immer zuerst lokal laden)
// ------------------------------------------
let savedRole = localStorage.getItem('userRole') || 'gast';
if (!['gast', 'helfer', 'orga', 'admin'].includes(savedRole)) savedRole = 'gast';
window.currentUserRole = savedRole;
window.isEditMode = false;
window.currentFilterStatus = 'alle';
window.currentSearchTerm = '';
window.kasseData = Object.assign({}, DEFAULT_KASSE_DATA, lsGet('kasseData', {}));
window.inventarData = lsGet('inventarData', null);
if (!Array.isArray(window.inventarData) || window.inventarData.length === 0) {
  window.inventarData = clone(window.inventarCategories || []);
}
let inventarSyncTimer = null;

// ------------------------------------------
// 2. THEME (startet mit Systemeinstellung, gilt fuer die ganze Seite)
// ------------------------------------------
window.applyDarkMode = function (isDark) {
  document.documentElement.classList.toggle('dark', isDark);
  if (document.body) document.body.classList.toggle('dark', isDark);
  setText('themeToggleIcon', isDark ? '☀️' : '🌙');
};
window.initTheme = function () {
  const saved = localStorage.getItem('theme');
  const media = window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)') : null;
  window.applyDarkMode(saved ? saved === 'dark' : !!(media && media.matches));
  if (media && media.addEventListener) {
    media.addEventListener('change', (e) => {
      if (!localStorage.getItem('theme')) window.applyDarkMode(e.matches);
    });
  }
};
window.toggleTheme = function () {
  const nextDark = !document.documentElement.classList.contains('dark');
  localStorage.setItem('theme', nextDark ? 'dark' : 'light');
  window.applyDarkMode(nextDark);
};

// ------------------------------------------
// 3. NAVIGATION, ROLLEN, MODALS
// ------------------------------------------
window.switchView = function (viewName) {
  const targetId = VIEW_IDS[viewName];
  if (!targetId) return;
  if (window.currentUserRole === 'gast' && viewName !== 'aushang' && viewName !== 'login') {
    alert('Bitte melde dich an, um auf diesen Bereich zuzugreifen.');
    return;
  }
  if (viewName === 'admin' && window.currentUserRole !== 'admin') {
    alert('Das Admin-Panel ist nur für Administratoren.');
    return;
  }
  document.querySelectorAll('main > div[id^="view"]').forEach((v) => v.classList.add('hidden'));
  const target = document.getElementById(targetId);
  if (target) target.classList.remove('hidden');

  if (viewName === 'inventar') {
    window.renderInventar();
    window.loadInventarFromGoogleSheets();
  } else if (viewName === 'verkauf' || viewName === 'kasse') {
    window.renderKasse();
  } else if (viewName === 'statistik') {
    window.renderStatistik();
  } else if (viewName === 'einkaufsliste') {
    renderEinkaufsliste();
  } else if (viewName === 'lagerbestand') {
    renderLagerbestand();
  } else if (viewName === 'boxen') {
    renderBoxen();
  } else if (viewName === 'verkabelung') {
    renderVerkabelung();
  } else if (viewName === 'rezepte') {
    window.updatePunschRecipe();
  } else if (viewName === 'admin') {
    renderAdmin();
  }
  const navModal = document.getElementById('navigationModal');
  if (navModal) navModal.classList.add('hidden');
  window.scrollTo(0, 0);
};

window.toggleBurgerMenu = function () {
  const navModal = document.getElementById('navigationModal');
  if (navModal) navModal.classList.toggle('hidden');
};
window.openModal = function (id) {
  const el = document.getElementById(id);
  if (el) el.classList.remove('hidden');
};
window.closeModal = function (id) {
  const el = document.getElementById(id);
  if (el) el.classList.add('hidden');
};
window.closeLoginModal = function () {
  window.closeModal('loginModal');
};

window.tryLogin = function (role, inputId) {
  const input = document.getElementById(inputId);
  const password = input ? input.value.trim() : '';
  const errorBox = document.getElementById('loginErrorMessage');
  if (ROLE_PASSWORDS[password] === role) {
    if (errorBox) errorBox.classList.add('hidden');
    if (input) input.value = '';
    window.setRole(role);
  } else if (errorBox) {
    errorBox.classList.remove('hidden');
    setText('loginErrorText', 'Falsches Passwort für die gewählte Rolle.');
  }
};
window.submitLogin = function () {
  const input = document.getElementById('loginPasswordInput');
  const role = ROLE_PASSWORDS[input ? input.value.trim() : ''];
  if (!role) {
    alert('Falsches Passwort.');
    return;
  }
  input.value = '';
  window.closeLoginModal();
  window.setRole(role);
};
window.selectRoleWithPassword = function (role) {
  window.closeModal('roleModal');
  if (role === 'betrachter' || role === 'gast') {
    window.setRole('gast');
    return;
  }
  const password = prompt('Passwort für ' + role + ':');
  if (password !== null && ROLE_PASSWORDS[password.trim()] === role) {
    window.setRole(role);
  } else if (password !== null) {
    alert('Falsches Passwort.');
  }
};
window.setRole = function (role) {
  if (role === 'betrachter') role = 'gast';
  window.currentUserRole = role;
  localStorage.setItem('userRole', role);
  window.applyRolePermissions(role);
};
window.applyRolePermissions = function (role) {
  window.currentUserRole = role;
  const isLoggedIn = role !== 'gast';
  const canEdit = role === 'admin' || role === 'orga';

  const labels = { admin: '🟢 ADMIN', orga: '🔵 ORGA', helfer: '🟡 HELFER', gast: 'GAST' };
  setText('roleLabel', labels[role] || 'GAST');
  setText('roleIcon', isLoggedIn ? '🔓' : '👁️');

  const burgerBtn = document.getElementById('burgerMenuBtn');
  if (burgerBtn) burgerBtn.classList.toggle('hidden', !isLoggedIn);
  const guestNotice = document.getElementById('guestLockNotice');
  if (guestNotice) guestNotice.classList.toggle('hidden', isLoggedIn);

  const editBtn = document.getElementById('adminInventarEditBtn');
  if (editBtn) editBtn.classList.toggle('hidden', !canEdit);
  if (!canEdit) window.isEditMode = false;

  document.querySelectorAll('.admin-only-control').forEach((el) => el.classList.toggle('hidden', !canEdit));
  const addBoxBtn = document.getElementById('addBoxBtn');
  if (addBoxBtn) addBoxBtn.classList.toggle('hidden', !canEdit);

  window.switchView('aushang');
};

// ------------------------------------------
// 4. KASSE & STATISTIK (nur lokal)
// ------------------------------------------
function saveKasseBackup() {
  const cutoff = Date.now() - 15 * 60 * 1000;
  const list = lsGet('kasseBackups', []).filter((b) => b.ts > cutoff);
  list.push({ ts: Date.now(), data: Object.assign({}, window.kasseData) });
  lsSet('kasseBackups', list.slice(-40));
}
function persistKasse() {
  lsSet('kasseData', window.kasseData);
}
window.openBackupModal = function () {
  const box = document.getElementById('backupListContainer');
  const cutoff = Date.now() - 15 * 60 * 1000;
  const list = lsGet('kasseBackups', []).filter((b) => b.ts > cutoff).reverse();
  if (box) {
    box.innerHTML = list.length === 0
      ? '<div class="text-slate-500 text-center py-4">Keine Backups der letzten 15 Minuten.</div>'
      : list.map((b) => {
          const time = new Date(b.ts).toLocaleTimeString('de-DE');
          const d = b.data;
          return `<div class="flex items-center justify-between gap-2 p-2 bg-slate-100 dark:bg-slate-800 rounded-lg">
            <span>${time} – Punsch ${d.kinderpunschPaid}/${d.kinderpunschFree}, Waffeln ${d.waffelPaid}/${d.waffelFree}</span>
            <button onclick="window.restoreKasseBackup(${b.ts})" class="px-2 py-1 bg-amber-500 text-slate-950 font-bold rounded-lg">Laden</button>
          </div>`;
        }).join('');
  }
  window.openModal('backupModal');
};
window.restoreKasseBackup = function (ts) {
  const entry = lsGet('kasseBackups', []).find((b) => b.ts === ts);
  if (!entry) return;
  saveKasseBackup();
  window.kasseData = Object.assign({}, DEFAULT_KASSE_DATA, entry.data);
  persistKasse();
  window.renderKasse();
  window.renderStatistik();
  window.closeModal('backupModal');
};

window.changeKasseCount = function (item, type, delta) {
  const key = item + (type === 'paid' ? 'Paid' : 'Free');
  if (typeof window.kasseData[key] !== 'number') return;
  saveKasseBackup();
  window.kasseData[key] = Math.max(0, window.kasseData[key] + delta);
  persistKasse();
  window.renderKasse();
};
window.updateKassePrice = function (item, value) {
  const price = parseFloat(String(value).replace(',', '.'));
  if (isNaN(price) || price < 0) return;
  window.kasseData[item + 'Price'] = price;
  persistKasse();
  window.renderKasse();
};
window.updatePricesFromAdmin = function () {
  const waffel = document.getElementById('adminPriceWaffel');
  const punsch = document.getElementById('adminPricePunsch');
  if (waffel && waffel.value !== '') window.updateKassePrice('waffel', waffel.value);
  if (punsch && punsch.value !== '') window.updateKassePrice('kinderpunsch', punsch.value);
};
window.loadKasseFromGoogleSheets = function () {
  // Die Kasse wird aktuell nur lokal gespeichert (Sheets-Schnittstelle kennt nur das Inventar).
  window.renderKasse();
  window.renderStatistik();
};
window.renderKasse = function () {
  const k = window.kasseData;
  setText('countKinderpunschPaid', k.kinderpunschPaid || 0);
  setText('countKinderpunschFree', k.kinderpunschFree || 0);
  setText('countWaffelPaid', k.waffelPaid || 0);
  setText('countWaffelFree', k.waffelFree || 0);
  setText('displayKinderpunschPrice', formatEuro(k.kinderpunschPrice) + ' / Becher');
  setText('displayWaffelPrice', formatEuro(k.waffelPrice) + ' / Stück');
  const punschInput = document.getElementById('inputKinderpunschPrice');
  const waffelInput = document.getElementById('inputWaffelPrice');
  if (punschInput && document.activeElement !== punschInput) punschInput.value = k.kinderpunschPrice;
  if (waffelInput && document.activeElement !== waffelInput) waffelInput.value = k.waffelPrice;
  setText('kasseLiveTotalEuros', formatEuro(k.kinderpunschPaid * k.kinderpunschPrice + k.waffelPaid * k.waffelPrice));

  const badge = document.getElementById('kasseSyncBadge');
  if (badge) {
    badge.className = 'text-xs px-3 py-1 rounded-full font-bold bg-amber-500/10 text-amber-400 border border-amber-500/30 flex items-center gap-1.5';
    badge.innerHTML = '<span class="w-2.5 h-2.5 rounded-full bg-amber-500"></span> Lokal gespeichert';
  }
};
window.renderStatistik = function () {
  const k = window.kasseData;
  const punschRev = k.kinderpunschPaid * k.kinderpunschPrice;
  const waffelRev = k.waffelPaid * k.waffelPrice;
  const paidItems = k.kinderpunschPaid + k.waffelPaid;
  const freeItems = k.kinderpunschFree + k.waffelFree;

  setText('statTotalRevenue', formatEuro(punschRev + waffelRev));
  setText('statTotalPaidItems', paidItems + ' Stk.');
  setText('statTotalFreeItems', freeItems + ' Stk.');
  setText('statTotalAllItems', paidItems + freeItems + ' Stk.');
  setText('statKinderpunschPaid', `${k.kinderpunschPaid} Stk. (${formatEuro(punschRev)})`);
  setText('statKinderpunschFree', `${k.kinderpunschFree} Stk.`);
  setText('statKinderpunschTotal', `${k.kinderpunschPaid + k.kinderpunschFree} Stk.`);
  setText('statWaffelPaid', `${k.waffelPaid} Stk. (${formatEuro(waffelRev)})`);
  setText('statWaffelFree', `${k.waffelFree} Stk.`);
  setText('statWaffelTotal', `${k.waffelPaid + k.waffelFree} Stk.`);
};
window.resetKasseData = function () {
  if (!confirm('Möchtest du die Zählerstände der Kasse wirklich für die neue Schicht auf 0 zurücksetzen?')) return;
  saveKasseBackup();
  window.kasseData = Object.assign({}, DEFAULT_KASSE_DATA, {
    kinderpunschPrice: window.kasseData.kinderpunschPrice,
    waffelPrice: window.kasseData.waffelPrice
  });
  persistKasse();
  window.renderKasse();
  window.renderStatistik();
};

// ------------------------------------------
// 5. INVENTAR: lokal zuerst, dann Google Sheets
// ------------------------------------------
function isValidInventar(data) {
  return Array.isArray(data) && data.length > 0 && data.every((c) => c && Array.isArray(c.items));
}
function setInventarSaved() {
  lsSet('inventarData', window.inventarData);
}

window.syncWithGoogleSheets = function () {
  setInventarSaved();
  localStorage.setItem('inventarDirty', '1');
  clearTimeout(inventarSyncTimer);
  inventarSyncTimer = setTimeout(pushInventarToSheets, 800);
};
async function pushInventarToSheets() {
  try {
    await fetch(GOOGLE_SCRIPT_URL, {
      method: 'POST',
      mode: 'no-cors',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(window.inventarData)
    });
    localStorage.removeItem('inventarDirty');
  } catch (e) {
    console.warn('Offline - Änderungen bleiben lokal und werden später gesendet:', e);
  }
}
window.loadInventarFromGoogleSheets = async function () {
  // Lokale, noch nicht gesendete Änderungen haben Vorrang.
  if (localStorage.getItem('inventarDirty') === '1') {
    await pushInventarToSheets();
    return;
  }
  try {
    const res = await fetch(GOOGLE_SCRIPT_URL);
    if (!res.ok) return;
    let data = await res.json();
    if (typeof data === 'string') data = JSON.parse(data);
    if (!isValidInventar(data)) {
      console.warn('Google Sheets lieferte keine gültigen Daten - lokale Daten bleiben.');
      return;
    }
    window.inventarData = data;
    setInventarSaved();
    const container = document.getElementById('inventarTablesContainer');
    const typing = container && container.contains(document.activeElement) && document.activeElement.tagName === 'INPUT';
    if (!typing) window.renderInventar();
  } catch (e) {
    console.warn('Google Sheets nicht erreichbar - lokale Daten bleiben:', e);
  }
};

window.getCategoryStatuses = function (cat) {
  if (Array.isArray(cat.statuses) && cat.statuses.length > 0) return cat.statuses;
  const title = (cat.title || '').toLowerCase();
  if (['zutat', 'einkauf', 'lebensmittel', 'verpflegung'].some((w) => title.includes(w))) {
    return DEFAULT_STATUSES_EINKAUF;
  }
  return DEFAULT_STATUSES_STANDARD;
};
window.setInventarFilter = function (status) {
  window.currentFilterStatus = status;
  window.renderInventar();
};
window.handleInventarSearch = function (val) {
  window.currentSearchTerm = (val || '').toLowerCase().trim();
  window.renderInventar();
};
window.toggleEditMode = function () {
  if (window.currentUserRole !== 'admin' && window.currentUserRole !== 'orga') {
    alert('Nur Admins und Orga können den Bearbeitungsmodus aktivieren.');
    return;
  }
  window.isEditMode = !window.isEditMode;
  const btn = document.getElementById('adminInventarEditBtn');
  if (btn) {
    btn.innerText = window.isEditMode ? '❌ Bearbeiten beenden' : '✏️ Bearbeiten';
    btn.className = window.isEditMode
      ? 'px-3.5 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-xl transition shadow flex items-center gap-1.5'
      : 'px-3.5 py-2 bg-amber-500 hover:bg-amber-600 text-slate-950 text-xs font-bold rounded-xl transition shadow flex items-center gap-1.5';
  }
  window.renderInventar();
};

// --- Bearbeiten: Kategorien und Eintraege ---
window.updateInventarItem = function (catIdx, itemIdx, field, val) {
  const item = window.inventarData[catIdx] && window.inventarData[catIdx].items[itemIdx];
  if (!item) return;
  item[field] = val;
  if (field === 'wer' && 'verantwortlich' in item) item.verantwortlich = val;
  window.syncWithGoogleSheets();
  window.renderInventar();
};
window.addCategory = function () {
  const name = prompt('Name der neuen Kategorie (z.B. 🍿 SNACKS):');
  if (!name || !name.trim()) return;
  window.inventarData.push({ title: name.trim(), items: [] });
  window.syncWithGoogleSheets();
  window.renderInventar();
};
window.renameCategory = function (catIdx) {
  const cat = window.inventarData[catIdx];
  if (!cat) return;
  const name = prompt('Kategoriename ändern:', cat.title);
  if (name && name.trim()) {
    cat.title = name.trim();
    window.syncWithGoogleSheets();
    window.renderInventar();
  }
};
window.deleteCategory = function (catIdx) {
  const cat = window.inventarData[catIdx];
  if (!cat) return;
  if (confirm(`Möchtest du die Kategorie "${cat.title}" inklusive aller ${cat.items.length} Einträge wirklich löschen?`)) {
    window.inventarData.splice(catIdx, 1);
    window.syncWithGoogleSheets();
    window.renderInventar();
  }
};
window.moveCategory = function (catIdx, direction) {
  const target = catIdx + direction;
  const list = window.inventarData;
  if (target < 0 || target >= list.length) return;
  [list[catIdx], list[target]] = [list[target], list[catIdx]];
  window.syncWithGoogleSheets();
  window.renderInventar();
};
window.editCategoryStatuses = function (catIdx) {
  const cat = window.inventarData[catIdx];
  if (!cat) return;
  const input = prompt(
    `Verfügbare Status-Optionen für "${cat.title}" festlegen (kommagetrennt):\n\nBeispiel: Offen, Vorbereitet, Verteilt, Eingekauft, Erledigt`,
    window.getCategoryStatuses(cat).join(', ')
  );
  if (input === null) return;
  const list = input.split(',').map((s) => s.trim()).filter(Boolean);
  if (list.length > 0) cat.statuses = list;
  else delete cat.statuses;
  window.syncWithGoogleSheets();
  window.renderInventar();
};
window.addItem = function (catIdx) {
  const cat = window.inventarData[catIdx];
  if (!cat) return;
  const name = prompt('Name des neuen Gegenstands:');
  if (!name || !name.trim()) return;
  cat.items.push({ name: name.trim(), sub: '', bedarf: 1, lager: 0, status: 'Offen', wer: '', pack: false, box: '' });
  window.syncWithGoogleSheets();
  window.renderInventar();
};
window.deleteItem = function (catIdx, itemIdx) {
  const cat = window.inventarData[catIdx];
  if (!cat || !cat.items[itemIdx]) return;
  if (confirm(`Eintrag "${cat.items[itemIdx].name}" wirklich löschen?`)) {
    cat.items.splice(itemIdx, 1);
    window.syncWithGoogleSheets();
    window.renderInventar();
  }
};
window.moveItem = function (catIdx, itemIdx, direction) {
  const cat = window.inventarData[catIdx];
  if (!cat) return;
  const target = itemIdx + direction;
  if (target < 0 || target >= cat.items.length) return;
  [cat.items[itemIdx], cat.items[target]] = [cat.items[target], cat.items[itemIdx]];
  window.syncWithGoogleSheets();
  window.renderInventar();
};

// --- Darstellung ---
function statusStyleClass(status) {
  const map = {
    Offen: 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-300 dark:border-rose-800/80 font-bold',
    Eingekauft: 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-300 dark:border-purple-800/80 font-bold',
    Vorbereitet: 'bg-amber-500/20 text-amber-700 dark:text-amber-400 border-amber-400 dark:border-amber-500/80 font-extrabold',
    Verteilt: 'bg-sky-500/10 text-sky-600 dark:text-sky-400 border-sky-300 dark:border-sky-800/80 font-bold',
    Erledigt: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-300 dark:border-emerald-800/80 font-bold'
  };
  return map[status] || 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-700 font-bold';
}
function filterButtonClass(status, isActive) {
  const base = isActive
    ? 'px-3.5 py-1.5 rounded-lg text-xs font-bold transition shadow-md '
    : 'px-3.5 py-1.5 rounded-lg text-xs font-medium transition border ';
  const colors = {
    alle: ['bg-amber-500 text-slate-950', 'bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-700'],
    Offen: ['bg-rose-500 text-white', 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/30'],
    Vorbereitet: ['bg-amber-500 text-slate-950', 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30'],
    Verteilt: ['bg-sky-500 text-white', 'bg-sky-500/10 text-sky-600 dark:text-sky-400 border-sky-500/30'],
    Eingekauft: ['bg-purple-600 text-white', 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/30'],
    Erledigt: ['bg-emerald-500 text-white', 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30']
  };
  const pair = colors[status] || ['bg-indigo-600 text-white', 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/30'];
  return base + (isActive ? pair[0] : pair[1]);
}
window.updateFilterButtonsUI = function () {
  const container = document.getElementById('filterButtonsContainer');
  if (!container) return;
  const statuses = ['alle', 'Offen', 'Vorbereitet', 'Verteilt', 'Eingekauft', 'Erledigt'];
  window.inventarData.forEach((cat) => {
    window.getCategoryStatuses(cat).forEach((s) => { if (!statuses.includes(s)) statuses.push(s); });
    cat.items.forEach((i) => { if (i.status && !statuses.includes(i.status)) statuses.push(i.status); });
  });
  // "Eingekauft" nur zeigen, wenn es tatsaechlich genutzt wird
  const used = new Set();
  window.inventarData.forEach((cat) => {
    window.getCategoryStatuses(cat).forEach((s) => used.add(s));
    cat.items.forEach((i) => used.add(i.status || 'Offen'));
  });
  container.innerHTML = statuses
    .filter((s) => s === 'alle' || used.has(s))
    .map((s) => {
      const active = window.currentFilterStatus.toLowerCase() === s.toLowerCase();
      return `<button data-filter="${escapeHtml(s)}" onclick="window.setInventarFilter(this.dataset.filter)" class="${filterButtonClass(s, active)}">${s === 'alle' ? 'Alle' : escapeHtml(s)}</button>`;
    })
    .join('');
};

const TH = 'py-3 px-2 text-center text-[11px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400';

function renderItemRow(item, catIdx, itemIdx, cat, edit, readonly) {
  const status = item.status || 'Offen';
  const options = window.getCategoryStatuses(cat).slice();
  if (!options.includes(status)) options.push(status);
  const dis = readonly ? 'disabled' : '';
  const ref = `${catIdx}, ${itemIdx}`;
  const inputBase = 'bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 focus:border-amber-500 focus:outline-none rounded-md disabled:opacity-60';

  const nameCell = edit
    ? `<input type="text" value="${escapeHtml(item.name)}" placeholder="Name..." onchange="window.updateInventarItem(${ref}, 'name', this.value)" class="w-full font-bold ${inputBase} py-0.5 px-1.5 text-xs mb-1" />
       <input type="text" value="${escapeHtml(item.sub || '')}" placeholder="Beschreibung..." onchange="window.updateInventarItem(${ref}, 'sub', this.value)" class="w-full text-[10px] ${inputBase} py-0.5 px-1.5" />`
    : `<div class="leading-tight font-bold">${escapeHtml(item.name)}${item.sub ? `<div class="text-[10px] font-normal text-slate-500 dark:text-slate-400 mt-0.5">${escapeHtml(item.sub)}</div>` : ''}</div>`;

  const actions = edit
    ? `<td class="py-2.5 px-2 text-center"><div class="flex items-center justify-center gap-1">
         <button onclick="window.moveItem(${ref}, -1)" ${itemIdx === 0 ? 'disabled' : ''} title="Nach oben" class="p-1 text-[10px] bg-slate-200 dark:bg-slate-800 rounded disabled:opacity-30">⬆️</button>
         <button onclick="window.moveItem(${ref}, 1)" ${itemIdx === cat.items.length - 1 ? 'disabled' : ''} title="Nach unten" class="p-1 text-[10px] bg-slate-200 dark:bg-slate-800 rounded disabled:opacity-30">⬇️</button>
         <button onclick="window.deleteItem(${ref})" title="Löschen" class="p-1 text-[10px] bg-rose-500/20 text-rose-500 border border-rose-500/30 rounded font-bold">🗑️</button>
       </div></td>`
    : '';

  return `<tr class="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition">
    <td class="py-2.5 px-4 text-slate-900 dark:text-slate-100">${nameCell}</td>
    <td class="py-2.5 px-2 text-center"><input type="number" ${dis} value="${Number(item.bedarf) || 0}" onchange="window.updateInventarItem(${ref}, 'bedarf', parseInt(this.value) || 0)" class="w-12 text-center ${inputBase} py-1 px-1 font-bold" /></td>
    <td class="py-2.5 px-2 text-center"><input type="number" ${dis} value="${Number(item.lager) || 0}" onchange="window.updateInventarItem(${ref}, 'lager', parseInt(this.value) || 0)" class="w-12 text-center ${inputBase} py-1 px-1 font-black text-emerald-600 dark:text-emerald-400" /></td>
    <td class="py-2.5 px-2 text-center"><select ${dis} onchange="window.updateInventarItem(${ref}, 'status', this.value)" class="w-full bg-white dark:bg-slate-950 border rounded-md py-1 px-2 text-xs focus:border-amber-500 focus:outline-none disabled:opacity-60 ${statusStyleClass(status)}">
      ${options.map((s) => `<option value="${escapeHtml(s)}" ${s === status ? 'selected' : ''} class="bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100">${escapeHtml(s)}</option>`).join('')}
    </select></td>
    <td class="py-2.5 px-2 text-center"><input type="text" ${dis} value="${escapeHtml(item.wer || item.verantwortlich || '')}" placeholder="Name..." onchange="window.updateInventarItem(${ref}, 'wer', this.value)" class="w-full min-w-[7rem] ${inputBase} py-1 px-2 text-xs" /></td>
    <td class="py-2.5 px-2 text-center"><input type="checkbox" ${dis} ${item.pack ? 'checked' : ''} onchange="window.updateInventarItem(${ref}, 'pack', this.checked)" class="w-4 h-4 accent-amber-500" /></td>
    <td class="py-2.5 px-2 text-center"><input type="text" ${dis} value="${escapeHtml(item.box || '')}" onchange="window.updateInventarItem(${ref}, 'box', this.value)" class="w-20 ${inputBase} py-1 px-2 text-xs" /></td>
    ${actions}
  </tr>`;
}

window.renderInventar = function () {
  const container = document.getElementById('inventarTablesContainer');
  if (!container) return;
  if (!Array.isArray(window.inventarData) || window.inventarData.length === 0) {
    window.inventarData = clone(window.inventarCategories || []);
  }
  window.updateFilterButtonsUI();

  const readonly = window.currentUserRole === 'gast';
  const edit = window.isEditMode && (window.currentUserRole === 'admin' || window.currentUserRole === 'orga');
  let total = 0;
  let done = 0;
  let html = '';

  window.inventarData.forEach((cat, catIdx) => {
    cat.items.forEach((item) => {
      total++;
      if (item.status === 'Erledigt' || item.status === 'Eingekauft' || item.pack) done++;
    });

    const matching = cat.items.filter((item) => {
      if (window.currentSearchTerm) {
        const haystack = [item.name, item.sub, item.wer, item.verantwortlich, item.empfaenger, item.box, cat.title]
          .map((v) => (v || '').toLowerCase()).join(' ');
        if (!haystack.includes(window.currentSearchTerm)) return false;
      }
      if (window.currentFilterStatus !== 'alle') {
        if ((item.status || 'Offen').toLowerCase() !== window.currentFilterStatus.toLowerCase()) return false;
      }
      return true;
    });
    if (matching.length === 0 && !edit) return;

    const catControls = edit
      ? `<div class="flex items-center gap-1">
           <button onclick="window.moveCategory(${catIdx}, -1)" title="Nach oben" class="p-1.5 text-xs bg-slate-200 dark:bg-slate-800 rounded-lg">⬆️</button>
           <button onclick="window.moveCategory(${catIdx}, 1)" title="Nach unten" class="p-1.5 text-xs bg-slate-200 dark:bg-slate-800 rounded-lg">⬇️</button>
           <button onclick="window.renameCategory(${catIdx})" title="Umbenennen" class="p-1.5 text-xs bg-slate-200 dark:bg-slate-800 rounded-lg">✏️</button>
           <button onclick="window.editCategoryStatuses(${catIdx})" title="Status-Optionen" class="p-1.5 text-xs bg-slate-200 dark:bg-slate-800 rounded-lg">🏷️</button>
           <button onclick="window.deleteCategory(${catIdx})" title="Kategorie löschen" class="p-1.5 text-xs bg-rose-500/20 text-rose-500 border border-rose-500/30 rounded-lg">🗑️</button>
         </div>`
      : '';

    html += `<div class="bg-white dark:bg-slate-900 rounded-2xl border ${edit ? 'border-amber-500/50' : 'border-slate-200 dark:border-slate-800'} shadow-sm overflow-hidden">
      <div class="px-5 py-3.5 border-b border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2">
        <div class="flex items-center gap-2">
          <h3 class="text-xs sm:text-sm font-black tracking-wide text-amber-600 dark:text-amber-400 uppercase">${escapeHtml(cat.title)}</h3>
        </div>
        <div class="flex items-center gap-2">
          ${catControls}
          <span class="text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-300 dark:border-slate-700">${matching.length} Einträge</span>
        </div>
      </div>
      <div class="overflow-x-auto">
      <table class="w-full text-left text-xs">
        <thead class="border-b border-slate-200 dark:border-slate-800">
          <tr>
            <th class="py-3 px-4 text-[11px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">Gegenstand</th>
            <th class="${TH} w-16">Bedarf</th>
            <th class="${TH} w-16">Lager</th>
            <th class="${TH} w-36">Status</th>
            <th class="${TH} w-40">Wer</th>
            <th class="${TH} w-16">Pack</th>
            <th class="${TH} w-24">Box</th>
            ${edit ? `<th class="${TH} w-28">Aktionen</th>` : ''}
          </tr>
        </thead>
        <tbody class="divide-y divide-slate-200 dark:divide-slate-800/60">`;

    cat.items.forEach((item, itemIdx) => {
      if (!edit && !matching.includes(item)) return;
      html += renderItemRow(item, catIdx, itemIdx, cat, edit, readonly);
    });

    html += `</tbody></table></div>
      ${edit ? `<div class="p-3 border-t border-slate-200 dark:border-slate-800 text-center">
        <button onclick="window.addItem(${catIdx})" class="px-3 py-1 bg-amber-500/20 hover:bg-amber-500/30 text-amber-600 dark:text-amber-400 border border-amber-500/30 text-xs font-bold rounded-lg transition">➕ Neuer Gegenstand in ${escapeHtml(cat.title)}</button>
      </div>` : ''}
    </div>`;
  });

  if (edit) {
    html += `<div class="p-6 border-2 border-dashed border-amber-500/40 rounded-2xl text-center">
      <button onclick="window.addCategory()" class="px-5 py-2.5 bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs rounded-xl shadow-md transition">➕ Neue Kategorie hinzufügen</button>
    </div>`;
  }
  container.innerHTML = html || '<div class="p-8 text-center text-slate-500 dark:text-slate-400 text-xs">Keine passenden Einträge für diesen Filter gefunden.</div>';

  const percent = total > 0 ? Math.round((done / total) * 100) : 0;
  setText('inventarProgressText', `${percent}% erledigt (${done}/${total})`);
};

// ------------------------------------------
// 6. WEITERE ANSICHTEN (aus den Inventardaten abgeleitet)
// ------------------------------------------
function renderEinkaufsliste() {
  const box = document.getElementById('einkaufslisteContainer');
  if (!box) return;
  let html = '';
  window.inventarData.forEach((cat, catIdx) => {
    if ((cat.title || '').toLowerCase().includes('orga')) return;
    const rows = [];
    cat.items.forEach((item, itemIdx) => {
      const missing = (Number(item.bedarf) || 0) - (Number(item.lager) || 0);
      if (missing > 0 && item.status !== 'Erledigt' && item.status !== 'Eingekauft') {
        rows.push(`<div class="flex items-center justify-between gap-3 py-2 border-b border-slate-100 dark:border-slate-800/60 text-xs">
          <span class="font-bold text-slate-800 dark:text-slate-100">${escapeHtml(item.name)}</span>
          <span class="flex items-center gap-2">
            <span class="font-black text-orange-600 dark:text-orange-400">fehlt: ${missing}</span>
            <button onclick="window.updateInventarItem(${catIdx}, ${itemIdx}, 'status', 'Eingekauft')" class="px-2.5 py-1 bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/30 rounded-lg font-bold">Eingekauft</button>
          </span>
        </div>`);
      }
    });
    if (rows.length) {
      html += `<div><h4 class="text-xs font-black uppercase tracking-wider text-amber-600 dark:text-amber-400 mb-1">${escapeHtml(cat.title)}</h4>${rows.join('')}</div>`;
    }
  });
  box.innerHTML = html || '<div class="text-xs text-slate-500 text-center py-4">Nichts zu besorgen.</div>';
}

function renderLagerbestand() {
  const box = document.getElementById('lagerbestandContainer');
  if (!box) return;
  const cards = [];
  window.inventarData.forEach((cat) => {
    const title = (cat.title || '').toLowerCase();
    if (title.includes('orga')) return;
    cat.items.forEach((item) => {
      const need = Number(item.bedarf) || 0;
      const have = Number(item.lager) || 0;
      if (need <= 0) return;
      cards.push({ name: item.name, need, have, ratio: Math.min(1, have / need) });
    });
  });
  cards.sort((a, b) => a.ratio - b.ratio);
  box.innerHTML = cards.map((c) => {
    const color = c.ratio >= 1 ? 'bg-emerald-500' : c.ratio > 0 ? 'bg-amber-500' : 'bg-rose-500';
    return `<div class="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-2">
      <div class="flex justify-between text-xs font-bold text-slate-800 dark:text-slate-100"><span>${escapeHtml(c.name)}</span><span>${c.have} / ${c.need}</span></div>
      <div class="h-2 bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden"><div class="h-full ${color}" style="width:${Math.round(c.ratio * 100)}%"></div></div>
    </div>`;
  }).join('') || '<div class="text-xs text-slate-500">Keine Daten.</div>';
}

function renderVerkabelung() {
  const box = document.getElementById('powerPool');
  if (!box) return;
  const chips = [];
  window.inventarData.forEach((cat) => {
    const title = (cat.title || '').toLowerCase();
    if (!title.includes('elektrik') && !title.includes('licht') && !title.includes('geräte')) return;
    cat.items.forEach((item) => {
      chips.push(`<span class="px-2.5 py-1 bg-sky-500/10 text-sky-700 dark:text-sky-300 border border-sky-500/30 rounded-lg font-bold">${escapeHtml(item.name)} (${Number(item.bedarf) || 0})</span>`);
    });
  });
  box.innerHTML = chips.join('') || '<span class="text-slate-500">Keine Elektro-Artikel vorhanden.</span>';
}

// --- Boxen ---
function normBox(name) {
  return String(name || '').trim().toLowerCase();
}
function renderBoxen() {
  const grid = document.getElementById('boxOverviewGrid');
  if (!grid) return;
  const defs = lsGet('boxDefs', []);
  const canEdit = window.currentUserRole === 'admin' || window.currentUserRole === 'orga';
  const boxes = defs.map((d) => ({ id: d.id, name: d.name, desc: d.desc, items: [] }));
  const unknown = {};
  window.inventarData.forEach((cat) => {
    cat.items.forEach((item) => {
      const key = normBox(item.box);
      if (!key) return;
      let target = boxes.find((b) => normBox(b.name) === key);
      if (!target) {
        target = unknown[key] || (unknown[key] = { id: null, name: item.box.trim(), desc: '', items: [] });
      }
      target.items.push(item.name);
    });
  });
  const all = boxes.concat(Object.values(unknown));
  grid.innerHTML = all.map((b) => `<div class="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-2">
      <div class="flex items-start justify-between gap-2">
        <div><h3 class="font-black text-sm text-purple-600 dark:text-purple-400">📦 ${escapeHtml(b.name)}</h3>
        ${b.desc ? `<p class="text-[11px] text-slate-500 dark:text-slate-400">${escapeHtml(b.desc)}</p>` : ''}</div>
        ${canEdit && b.id ? `<span class="flex gap-1"><button onclick="window.openBoxModal('${escapeHtml(b.id)}')" class="p-1 text-xs bg-slate-200 dark:bg-slate-800 rounded">✏️</button><button onclick="window.deleteBox('${escapeHtml(b.id)}')" class="p-1 text-xs bg-rose-500/20 text-rose-500 rounded">🗑️</button></span>` : ''}
      </div>
      <ul class="text-xs text-slate-700 dark:text-slate-300 list-disc pl-4 space-y-0.5">${b.items.map((n) => `<li>${escapeHtml(n)}</li>`).join('') || '<li class="list-none text-slate-400">Noch leer</li>'}</ul>
    </div>`).join('') || '<div class="text-xs text-slate-500">Noch keine Boxen. Trage im Inventar bei "Box" einen Namen ein oder lege eine neue Box an.</div>';
}
window.openBoxModal = function (id) {
  const def = lsGet('boxDefs', []).find((d) => d.id === id);
  document.getElementById('boxModalId').value = def ? def.id : '';
  document.getElementById('boxModalName').value = def ? def.name : '';
  document.getElementById('boxModalDesc').value = def ? def.desc : '';
  setText('boxModalTitle', def ? '📦 Box bearbeiten' : '📦 Neue Box');
  window.openModal('boxEditModal');
};
window.saveBoxFromModal = function () {
  const id = document.getElementById('boxModalId').value;
  const name = document.getElementById('boxModalName').value.trim();
  const desc = document.getElementById('boxModalDesc').value.trim();
  if (!name) {
    alert('Bitte einen Namen eingeben.');
    return;
  }
  const defs = lsGet('boxDefs', []);
  const existing = defs.find((d) => d.id === id);
  if (existing) {
    existing.name = name;
    existing.desc = desc;
  } else {
    defs.push({ id: 'box_' + Date.now(), name, desc });
  }
  lsSet('boxDefs', defs);
  window.closeModal('boxEditModal');
  renderBoxen();
};
window.deleteBox = function (id) {
  if (!confirm('Diese Box wirklich löschen?')) return;
  lsSet('boxDefs', lsGet('boxDefs', []).filter((d) => d.id !== id));
  renderBoxen();
};

// --- Rezept-Rechner ---
window.updatePunschRecipe = function () {
  const list = document.getElementById('recipeIngredientsList');
  const input = document.getElementById('punschCalcInput');
  if (!list || !input) return;
  const liters = Math.max(1, parseFloat(input.value) || 8);
  const factor = liters / 4;
  list.innerHTML = PUNSCH_ZUTATEN.map((z) => {
    if (z.pro4l === null || z.pro4l === undefined) return `<li>${escapeHtml(z.name)}</li>`;
    const amount = Math.round(z.pro4l * factor * 100) / 100;
    return `<li>${amount.toLocaleString('de-DE')} ${escapeHtml(z.einheit)} ${escapeHtml(z.name)}</li>`;
  }).join('');
};

// --- Admin ---
function renderAdmin() {
  const waffel = document.getElementById('adminPriceWaffel');
  const punsch = document.getElementById('adminPricePunsch');
  if (waffel) waffel.value = window.kasseData.waffelPrice;
  if (punsch) punsch.value = window.kasseData.kinderpunschPrice;
  const grid = document.getElementById('adminPermissionsGrid');
  if (grid) {
    const rows = [
      ['👁️ Gast', 'Nur Aushänge'],
      ['🧑‍🍳 Helfer', 'Alle Bereiche außer Admin-Panel'],
      ['📋 Orga', 'Wie Helfer, dazu Inventar bearbeiten'],
      ['🛡️ Admin', 'Vollzugriff']
    ];
    grid.innerHTML = `<div class="text-xs bg-slate-50 dark:bg-slate-950 p-4 rounded-xl border border-slate-200 dark:border-slate-800 space-y-1">
      <h4 class="font-extrabold text-amber-600 dark:text-amber-400 uppercase tracking-wider mb-2">Rollen</h4>
      ${rows.map((r) => `<div class="flex justify-between gap-3"><span class="font-bold text-slate-800 dark:text-slate-100">${r[0]}</span><span class="text-slate-500 dark:text-slate-400">${r[1]}</span></div>`).join('')}
    </div>`;
  }
}
window.addNewItemPrompt = function () {
  const names = window.inventarData.map((c, i) => `${i + 1} = ${c.title}`).join('\n');
  const answer = prompt('In welche Kategorie? Nummer eingeben:\n\n' + names);
  const idx = parseInt(answer, 10) - 1;
  if (isNaN(idx) || !window.inventarData[idx]) return;
  window.addItem(idx);
};
window.downloadBackup = function () {
  const payload = {
    exportedAt: new Date().toISOString(),
    inventar: window.inventarData,
    kasse: window.kasseData,
    boxen: lsGet('boxDefs', [])
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'weihnachtsmarkt-backup-' + new Date().toISOString().slice(0, 10) + '.json';
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
};
window.resetSeasonPrompt = function () {
  if (!confirm('Saison-Reset: Inventar und Kasse auf den Ausgangszustand setzen?')) return;
  if (prompt('Zur Bestätigung bitte RESET eintippen:') !== 'RESET') return;
  window.downloadBackup();
  window.inventarData = clone(window.inventarCategories || []);
  window.syncWithGoogleSheets();
  window.kasseData = Object.assign({}, DEFAULT_KASSE_DATA, {
    kinderpunschPrice: window.kasseData.kinderpunschPrice,
    waffelPrice: window.kasseData.waffelPrice
  });
  persistKasse();
  window.renderInventar();
  window.renderKasse();
  window.renderStatistik();
};

// ------------------------------------------
// 7. AUSHANG: Bilder und Vollbildansicht
// ------------------------------------------
function findRoshopImages(day) {
  const prefix = day === 'samstag' ? 'Samstag' : 'Sonntag';
  return Array.from(document.querySelectorAll('#viewAushang img')).filter(
    (img) => img.alt.indexOf(prefix) === 0 && img.alt.indexOf('Teigspenden') !== -1
  );
}
window.applyStoredImages = function () {
  ['samstag', 'sonntag'].forEach((day) => {
    const data = lsGet('roshopImage_' + day, null);
    if (data) findRoshopImages(day).forEach((img) => { img.src = data; });
  });
};
window.uploadRoshopImage = function (day, input) {
  const file = input.files && input.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, 1400 / Math.max(img.width, img.height));
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
      lsSet('roshopImage_' + day, canvas.toDataURL('image/jpeg', 0.75));
      window.applyStoredImages();
      alert('Bild gespeichert (nur auf diesem Gerät).');
    };
    img.src = reader.result;
  };
  reader.readAsDataURL(file);
};
window.openLightbox = function (src, title) {
  const day = /^Samstag/.test(title) ? 'samstag' : /^Sonntag/.test(title) ? 'sonntag' : null;
  const stored = day && /Teigspenden/.test(title) ? lsGet('roshopImage_' + day, null) : null;
  const old = document.getElementById('lightboxOverlay');
  if (old) old.remove();
  const overlay = document.createElement('div');
  overlay.id = 'lightboxOverlay';
  overlay.className = 'fixed inset-0 z-[60] bg-slate-950/90 flex flex-col items-center justify-center p-4 cursor-pointer';
  overlay.innerHTML = `<div class="text-white text-sm font-bold mb-3">${escapeHtml(title || '')}</div>
    <img src="${escapeHtml(stored || src)}" class="max-w-full max-h-[80vh] object-contain rounded-xl" alt="">
    <div class="text-slate-300 text-xs mt-3">Tippen zum Schließen</div>`;
  overlay.onclick = () => overlay.remove();
  document.body.appendChild(overlay);
};
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    const o = document.getElementById('lightboxOverlay');
    if (o) o.remove();
  }
});

// ------------------------------------------
// 8. START
// ------------------------------------------
function initApp() {
  window.initTheme();
  window.applyRolePermissions(window.currentUserRole);
  window.applyStoredImages();
  window.renderKasse();
  window.renderStatistik();
  window.renderInventar();
  window.loadInventarFromGoogleSheets();
}
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initApp);
} else {
  initApp();
}
