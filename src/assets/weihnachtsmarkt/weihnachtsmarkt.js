// ==========================================
// SG BARNSTORF WEIHNACHTSMARKT - MAIN ENGINE
// ==========================================

const GOOGLE_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbyQg2LmxT_UbLXjFVKrNf9gXnqgk_ku4V_P1SZeSGqphn-WRTYI3a9l5szzkDfqEE881Q/exec';

// Globale Zustandsvariablen
window.currentUserRole = localStorage.getItem('userRole') || 'gast';
window.inventarData = [];
window.isEditMode = false;
window.currentFilterStatus = 'alle';
window.currentSearchTerm = '';

// Helper zum sicheren Laden der Initialdaten
function getInitialInventarData() {
  if (typeof window.inventarCategories !== 'undefined' && Array.isArray(window.inventarCategories) && window.inventarCategories.length > 0) {
    try {
      return JSON.parse(JSON.stringify(window.inventarCategories));
    } catch (e) {
      console.error('Fehler beim Klonen von inventarCategories:', e);
    }
  }
  return [];
}
window.getInitialInventarData = getInitialInventarData;

// Kassen- und Verkauf-Zustand (mit Preisen)
const DEFAULT_KASSE_DATA = {
  kinderpunschPaid: 0,
  kinderpunschFree: 0,
  waffelPaid: 0,
  waffelFree: 0,
  kinderpunschPrice: 2.00,
  waffelPrice: 2.00
};

try {
  const savedKasse = localStorage.getItem('kasseData');
  const parsed = savedKasse ? JSON.parse(savedKasse) : {};
  window.kasseData = Object.assign({}, DEFAULT_KASSE_DATA, parsed);
} catch (e) {
  window.kasseData = { ...DEFAULT_KASSE_DATA };
}

// Default Status-Listen
const DEFAULT_STATUSES_STANDARD = ['Offen', 'Vorbereitet', 'Verteilt', 'Erledigt'];
const DEFAULT_STATUSES_EINKAUF = ['Offen', 'Vorbereitet', 'Verteilt', 'Eingekauft', 'Erledigt'];

// ------------------------------------------
// 1. THEME ENGINE (DARK / LIGHT MODE)
// ------------------------------------------
function applyDarkMode(isDark) {
  if (isDark) {
    document.documentElement.classList.add('dark');
    if (document.body) document.body.classList.add('dark');
  } else {
    document.documentElement.classList.remove('dark');
    if (document.body) document.body.classList.remove('dark');
  }
  const icon = document.getElementById('themeToggleIcon');
  if (icon) icon.innerText = isDark ? '☀️' : '🌙';
}
window.applyDarkMode = applyDarkMode;

function initTheme() {
  const savedTheme = localStorage.getItem('theme');
  const systemPrefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
  applyDarkMode(savedTheme === 'dark' || (!savedTheme && systemPrefersDark));
}
window.initTheme = initTheme;

function toggleTheme() {
  const isDarkCurrently = document.documentElement.classList.contains('dark');
  const newDarkState = !isDarkCurrently;
  localStorage.setItem('theme', newDarkState ? 'dark' : 'light');
  applyDarkMode(newDarkState);
}
window.toggleTheme = toggleTheme;

// ------------------------------------------
// 2. NAVIGATION & ROLLENMANAGEMENT
// ------------------------------------------
function switchView(viewName) {
  if (window.currentUserRole === 'gast' && viewName !== 'aushang' && viewName !== 'login') {
    alert('Bitte melde dich an, um auf diesen Bereich zuzugreifen.');
    return;
  }

  const views = document.querySelectorAll('main > div[id^="view"]');
  views.forEach(v => v.classList.add('hidden'));

  const lowerName = (viewName || '').toLowerCase();
  let targetView = null;

  if (lowerName === 'verkauf' || lowerName === 'kasse') {
    targetView = document.getElementById('viewVerkauf') || document.getElementById('viewKasse');
  } else {
    const targetId = 'view' + viewName.charAt(0).toUpperCase() + viewName.slice(1);
    targetView = document.getElementById(targetId);
  }

  if (targetView) {
    targetView.classList.remove('hidden');
    if (lowerName === 'inventar') {
      loadInventarFromGoogleSheets();
    } else if (lowerName === 'verkauf' || lowerName === 'kasse') {
      renderKasse();
    } else if (lowerName === 'statistik') {
      renderStatistik();
    }
  }

  const navModal = document.getElementById('navigationModal');
  if (navModal) navModal.classList.add('hidden');
}
window.switchView = switchView;

function toggleBurgerMenu() {
  const navModal = document.getElementById('navigationModal');
  if (navModal) navModal.classList.toggle('hidden');
}
window.toggleBurgerMenu = toggleBurgerMenu;

function tryLogin(role, inputId) {
  const passwords = { helfer: '1', orga: '2', admin: '3' };
  const input = document.getElementById(inputId);
  const password = input ? input.value.trim() : '';
  const errorBox = document.getElementById('loginErrorMessage');

  if (password === passwords[role]) {
    if (errorBox) errorBox.classList.add('hidden');
    if (input) input.value = '';
    setRole(role);
  } else if (errorBox) {
    errorBox.classList.remove('hidden');
    const errText = document.getElementById('loginErrorText');
    if (errText) errText.innerText = 'Falsches Passwort.';
  }
}
window.tryLogin = tryLogin;

function setRole(role) {
  window.currentUserRole = role;
  localStorage.setItem('userRole', role);
  applyRolePermissions(role);
}
window.setRole = setRole;

function applyRolePermissions(role) {
  window.currentUserRole = role || 'gast';
  const burgerBtn = document.getElementById('burgerMenuBtn');
  const guestNotice = document.getElementById('guestLockNotice');
  const roleLabel = document.getElementById('roleLabel');
  const roleIcon = document.getElementById('roleIcon');
  const adminEditBtn = document.getElementById('adminInventarEditBtn');

  if (roleLabel) {
    roleLabel.innerText = role === 'admin' ? '🟢 ADMIN' : (role === 'orga' ? '🔵 ORGA' : (role === 'helfer' ? '🟡 HELFER' : '👁️ GAST'));
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

    const activeView = document.querySelector('main > div[id^="view"]:not(.hidden)');
    if (!activeView || (activeView.id !== 'viewAushang' && activeView.id !== 'viewLogin')) {
      switchView('aushang');
    }
  } else {
    if (burgerBtn) burgerBtn.classList.remove('hidden');
    if (guestNotice) guestNotice.classList.add('hidden');
    if (roleIcon) roleIcon.innerText = '🔓';
  }

  if (window.inventarData && window.inventarData.length > 0) {
    renderInventar();
  }
}
window.applyRolePermissions = applyRolePermissions;

// ------------------------------------------
// 3. VERKAUF / KASSE & STATISTIK LOGIK
// ------------------------------------------
function changeKasseCount(item, type, delta) {
  const key = item + (type === 'paid' ? 'Paid' : 'Free');
  const currentVal = typeof window.kasseData[key] === 'number' ? window.kasseData[key] : 0;
  window.kasseData[key] = Math.max(0, currentVal + delta);
  localStorage.setItem('kasseData', JSON.stringify(window.kasseData));
  renderKasse();
  renderStatistik();
}
window.changeKasseCount = changeKasseCount;

function renderKasse() {
  const punschPaidEl = document.getElementById('countKinderpunschPaid');
  const punschFreeEl = document.getElementById('countKinderpunschFree');
  const waffelPaidEl = document.getElementById('countWaffelPaid');
  const waffelFreeEl = document.getElementById('countWaffelFree');
  const totalEurosEl = document.getElementById('kasseLiveTotalEuros');

  if (punschPaidEl) punschPaidEl.innerText = window.kasseData.kinderpunschPaid || 0;
  if (punschFreeEl) punschFreeEl.innerText = window.kasseData.kinderpunschFree || 0;
  if (waffelPaidEl) waffelPaidEl.innerText = window.kasseData.waffelPaid || 0;
  if (waffelFreeEl) waffelFreeEl.innerText = window.kasseData.waffelFree || 0;

  const totalRev = ((window.kasseData.kinderpunschPaid || 0) * (window.kasseData.kinderpunschPrice || 2)) +
                   ((window.kasseData.waffelPaid || 0) * (window.kasseData.waffelPrice || 2));

  if (totalEurosEl) {
    totalEurosEl.innerText = totalRev.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €';
  }
}
window.renderKasse = renderKasse;

function renderStatistik() {
  const punschPaid = window.kasseData.kinderpunschPaid || 0;
  const punschFree = window.kasseData.kinderpunschFree || 0;
  const waffelPaid = window.kasseData.waffelPaid || 0;
  const waffelFree = window.kasseData.waffelFree || 0;

  const punschPrice = window.kasseData.kinderpunschPrice || 2;
  const waffelPrice = window.kasseData.waffelPrice || 2;

  const punschRev = punschPaid * punschPrice;
  const waffelRev = waffelPaid * waffelPrice;
  const totalRev = punschRev + waffelRev;

  const totalPaidItems = punschPaid + waffelPaid;
  const totalFreeItems = punschFree + waffelFree;
  const totalAllItems = totalPaidItems + totalFreeItems;

  const setEl = (id, txt) => {
    const el = document.getElementById(id);
    if (el) el.innerText = txt;
  };

  setEl('statTotalRevenue', totalRev.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €');
  setEl('statTotalPaidItems', totalPaidItems + ' Stk.');
  setEl('statTotalFreeItems', totalFreeItems + ' Stk.');
  setEl('statTotalAllItems', totalAllItems + ' Stk.');

  setEl('statKinderpunschPaid', `${punschPaid} Stk. (${punschRev.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €)`);
  setEl('statKinderpunschFree', `${punschFree} Stk.`);
  setEl('statKinderpunschTotal', `${punschPaid + punschFree} Stk.`);

  setEl('statWaffelPaid', `${waffelPaid} Stk. (${waffelRev.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €)`);
  setEl('statWaffelFree', `${waffelFree} Stk.`);
  setEl('statWaffelTotal', `${waffelPaid + waffelFree} Stk.`);
}
window.renderStatistik = renderStatistik;

function resetKasseData() {
  if (confirm('Möchtest du die Zählerstände der Kasse wirklich für die neue Schicht auf 0 zurücksetzen?')) {
    window.kasseData = { ...DEFAULT_KASSE_DATA };
    localStorage.setItem('kasseData', JSON.stringify(window.kasseData));
    renderKasse();
    renderStatistik();
  }
}
window.resetKasseData = resetKasseData;

// ------------------------------------------
// 4. INVENTAR & GOOGLE SHEETS SYSTEM
// ------------------------------------------
async function loadInventarFromGoogleSheets() {
  const progressText = document.getElementById('inventarProgressText');
  if (progressText) progressText.innerText = 'Lade Daten...';

  if (!window.inventarData || window.inventarData.length === 0) {
    const fallback = getInitialInventarData();
    if (fallback.length > 0) {
      window.inventarData = fallback;
      renderInventar();
    }
  }

  try {
    const res = await fetch(GOOGLE_SCRIPT_URL);
    if (res.ok) {
      let data = await res.json();
      if (typeof data === 'string') {
        try { data = JSON.parse(data); } catch (e) {}
      }
      const isValid = Array.isArray(data) && data.length > 0 && Array.isArray(data[0].items);
      if (isValid) {
        window.inventarData = data;
        renderInventar();
      } else {
        console.warn('Google Sheets hat leere/ungültige Daten geliefert. Lokale Daten bleiben bestehen.');
        if (!window.inventarData || window.inventarData.length === 0) {
          window.inventarData = getInitialInventarData();
          renderInventar();
        }
      }
    }
  } catch (e) {
    console.warn('Google Sheets Fehler / Offline - erstelle mit lokalen Daten:', e);
    if (!window.inventarData || window.inventarData.length === 0) {
      window.inventarData = getInitialInventarData();
      renderInventar();
    }
  }
}
window.loadInventarFromGoogleSheets = loadInventarFromGoogleSheets;

function setInventarFilter(filterStatus) {
  window.currentFilterStatus = filterStatus;
  updateFilterButtonsUI();
  renderInventar();
}
window.setInventarFilter = setInventarFilter;

function handleInventarSearch(val) {
  window.currentSearchTerm = (val || '').toLowerCase().trim();
  renderInventar();
}
window.handleInventarSearch = handleInventarSearch;

function toggleEditMode() {
  if (window.currentUserRole !== 'admin' && window.currentUserRole !== 'orga') {
    alert('Nur Admins und Orga können den Bearbeitungsmodus aktivieren.');
    return;
  }
  window.isEditMode = !window.isEditMode;
  const editBtn = document.getElementById('adminInventarEditBtn');
  if (editBtn) {
    if (window.isEditMode) {
      editBtn.innerText = '❌ Bearbeiten Beenden';
      editBtn.className = 'px-3.5 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-xl transition shadow';
    } else {
      editBtn.innerText = '✏️ Bearbeiten';
      editBtn.className = 'px-3.5 py-2 bg-amber-500 hover:bg-amber-600 text-slate-950 text-xs font-bold rounded-xl transition shadow';
    }
  }
  renderInventar();
}
window.toggleEditMode = toggleEditMode;

function updateFilterButtonsUI() {
  const container = document.getElementById('filterButtonsContainer');
  if (!container) return;

  const baseOrder = ['Offen', 'Vorbereitet', 'Verteilt', 'Eingekauft', 'Erledigt'];
  const allStatusesSet = new Set(baseOrder);

  if (window.inventarData && Array.isArray(window.inventarData)) {
    window.inventarData.forEach(cat => {
      const catStatuses = getCategoryStatuses(cat);
      catStatuses.forEach(st => allStatusesSet.add(st));
      (cat.items || []).forEach(item => {
        if (item.status) allStatusesSet.add(item.status);
      });
    });
  }

  const orderedStatuses = ['alle', ...baseOrder];
  allStatusesSet.forEach(st => {
    if (!orderedStatuses.includes(st)) {
      orderedStatuses.push(st);
    }
  });

  let buttonsHtml = '';
  orderedStatuses.forEach(status => {
    const isActive = (window.currentFilterStatus.toLowerCase() === status.toLowerCase());
    const label = status === 'alle' ? 'Alle' : status;
    let activeClass = "px-3.5 py-1.5 rounded-lg text-xs font-bold transition shadow-md ";
    let inactiveClass = "px-3.5 py-1.5 rounded-lg text-xs font-medium transition border ";

    if (status === 'alle') {
      activeClass += "bg-slate-800 dark:bg-slate-200 text-white dark:text-slate-950";
      inactiveClass += "bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-300 dark:hover:bg-slate-700 border-slate-300 dark:border-slate-700";
    } else if (status === 'Offen') {
      activeClass += "bg-rose-500 text-white";
      inactiveClass += "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/30 hover:bg-rose-500/20";
    } else if (status === 'Vorbereitet') {
      activeClass += "bg-amber-500 text-slate-950 font-black";
      inactiveClass += "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30 hover:bg-amber-500/20";
    } else if (status === 'Verteilt') {
      activeClass += "bg-sky-500 text-white";
      inactiveClass += "bg-sky-500/10 text-sky-600 dark:text-sky-400 border-sky-500/30 hover:bg-sky-500/20";
    } else if (status === 'Eingekauft') {
      activeClass += "bg-purple-600 text-white";
      inactiveClass += "bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/30 hover:bg-purple-500/20";
    } else if (status === 'Erledigt') {
      activeClass += "bg-emerald-500 text-white";
      inactiveClass += "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/20";
    } else {
      activeClass += "bg-indigo-600 text-white";
      inactiveClass += "bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/30 hover:bg-indigo-500/20";
    }

    buttonsHtml += `<button data-filter-btn="${escapeHtml(status)}" onclick="window.setInventarFilter('${escapeHtml(status)}')" class="${isActive ? activeClass : inactiveClass}">${escapeHtml(label)}</button>`;
  });

  container.innerHTML = buttonsHtml;
}
window.updateFilterButtonsUI = updateFilterButtonsUI;

function getCategoryStatuses(cat) {
  if (cat.statuses && Array.isArray(cat.statuses) && cat.statuses.length > 0) {
    return cat.statuses;
  }
  const title = (cat.title || '').toLowerCase();
  if (title.includes('zutat') || title.includes('einkauf') || title.includes('lebensmittel') || title.includes('verpflegung')) {
    return DEFAULT_STATUSES_EINKAUF;
  }
  return DEFAULT_STATUSES_STANDARD;
}
window.getCategoryStatuses = getCategoryStatuses;

function editCategoryStatuses(catIdx) {
  const cat = window.inventarData[catIdx];
  if (!cat) return;
  const currentList = getCategoryStatuses(cat).join(', ');
  const input = prompt(
    `Verfügbare Status-Optionen für "${cat.title}" festlegen (kommagetrennt):\n\nBeispiel: Offen, Vorbereitet, Verteilt, Eingekauft, Erledigt`,
    currentList
  );
  if (input !== null) {
    const list = input.split(',').map(s => s.trim()).filter(Boolean);
    if (list.length > 0) {
      cat.statuses = list;
    } else {
      delete cat.statuses;
    }
    syncWithGoogleSheets();
    renderInventar();
  }
}
window.editCategoryStatuses = editCategoryStatuses;

function addCategory() {
  const name = prompt('Name der neuen Kategorie (z.B. 🍿 SNACKS):');
  if (!name || !name.trim()) return;
  window.inventarData.push({
    title: name.trim(),
    items: []
  });
  syncWithGoogleSheets();
  renderInventar();
}
window.addCategory = addCategory;

function renameCategory(catIdx) {
  const cat = window.inventarData[catIdx];
  if (!cat) return;
  const newName = prompt('Kategoriename ändern:', cat.title);
  if (newName !== null && newName.trim()) {
    cat.title = newName.trim();
    syncWithGoogleSheets();
    renderInventar();
  }
}
window.renameCategory = renameCategory;

function deleteCategory(catIdx) {
  const cat = window.inventarData[catIdx];
  if (!cat) return;
  if (confirm(`Möchtest du die Kategorie "${cat.title}" inklusive aller ${cat.items.length} Einträge wirklich löschen?`)) {
    window.inventarData.splice(catIdx, 1);
    syncWithGoogleSheets();
    renderInventar();
  }
}
window.deleteCategory = deleteCategory;

function moveCategory(catIdx, direction) {
  const targetIdx = catIdx + direction;
  if (targetIdx < 0 || targetIdx >= window.inventarData.length) return;
  const temp = window.inventarData[catIdx];
  window.inventarData[catIdx] = window.inventarData[targetIdx];
  window.inventarData[targetIdx] = temp;
  syncWithGoogleSheets();
  renderInventar();
}
window.moveCategory = moveCategory;

function addItem(catIdx) {
  const cat = window.inventarData[catIdx];
  if (!cat) return;
  const name = prompt('Name des neuen Gegenstands:');
  if (!name || !name.trim()) return;
  cat.items.push({
    name: name.trim(),
    sub: '',
    bedarf: 1,
    lager: 0,
    status: 'Offen',
    wer: '',
    verantwortlich: '',
    empfaenger: '',
    pack: false,
    box: ''
  });
  syncWithGoogleSheets();
  renderInventar();
}
window.addItem = addItem;

function deleteItem(catIdx, itemIdx) {
  const cat = window.inventarData[catIdx];
  if (!cat || !cat.items[itemIdx]) return;
  if (confirm(`Eintrag "${cat.items[itemIdx].name}" wirklich löschen?`)) {
    cat.items.splice(itemIdx, 1);
    syncWithGoogleSheets();
    renderInventar();
  }
}
window.deleteItem = deleteItem;

function moveItem(catIdx, itemIdx, direction) {
  const cat = window.inventarData[catIdx];
  if (!cat) return;
  const targetIdx = itemIdx + direction;
  if (targetIdx < 0 || targetIdx >= cat.items.length) return;
  const temp = cat.items[itemIdx];
  cat.items[itemIdx] = cat.items[targetIdx];
  cat.items[targetIdx] = temp;
  syncWithGoogleSheets();
  renderInventar();
}
window.moveItem = moveItem;

function getStatusStyleClass(status) {
  switch (status) {
    case 'Offen':
      return 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-300 dark:border-rose-800/80 font-bold';
    case 'Eingekauft':
      return 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-300 dark:border-purple-800/80 font-bold';
    case 'Vorbereitet':
      return 'bg-amber-500/20 text-amber-700 dark:text-amber-400 border-amber-400 dark:border-amber-500/80 font-extrabold';
    case 'Verteilt':
      return 'bg-sky-500/10 text-sky-600 dark:text-sky-400 border-sky-300 dark:border-sky-800/80 font-bold';
    case 'Erledigt':
      return 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-300 dark:border-emerald-800/80 font-bold';
    default:
      return 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-700 font-bold';
  }
}

function getStatusOptionTextColor(status) {
  switch (status) {
    case 'Offen': return 'text-rose-600 dark:text-rose-400';
    case 'Eingekauft': return 'text-purple-600 dark:text-purple-400';
    case 'Vorbereitet': return 'text-amber-600 dark:text-amber-400';
    case 'Verteilt': return 'text-sky-600 dark:text-sky-400';
    case 'Erledigt': return 'text-emerald-600 dark:text-emerald-400';
    default: return 'text-slate-800 dark:text-slate-200';
  }
}

function renderInventar() {
  const container = document.getElementById('inventarTablesContainer');
  if (!container) return;

  if (!window.inventarData || window.inventarData.length === 0) {
    const fallback = getInitialInventarData();
    if (fallback.length > 0) {
      window.inventarData = fallback;
    } else {
      container.innerHTML = '<div class="p-8 text-center text-slate-500 dark:text-slate-400 text-xs">Keine Inventardaten vorhanden.</div>';
      return;
    }
  }

  updateFilterButtonsUI();

  let totalItems = 0;
  let completedItems = 0;
  let html = '';

  const isReadonly = window.currentUserRole === 'gast';
  const showEditControls = window.isEditMode && (window.currentUserRole === 'admin' || window.currentUserRole === 'orga');

  window.inventarData.forEach((cat, catIdx) => {
    const isOrga = (cat.title || '').toLowerCase().includes('orga');
    const availableStatuses = getCategoryStatuses(cat);

    (cat.items || []).forEach(item => {
      totalItems++;
      if (item.status === 'Erledigt' || item.status === 'Eingekauft' || item.pack) {
        completedItems++;
      }
    });

    const matchingItems = (cat.items || []).filter(item => {
      if (window.currentSearchTerm) {
        const matchName = (item.name || '').toLowerCase().includes(window.currentSearchTerm);
        const matchSub = (item.sub || '').toLowerCase().includes(window.currentSearchTerm);
        const matchWer = (item.wer || item.verantwortlich || '').toLowerCase().includes(window.currentSearchTerm);
        const matchEmpf = (item.empfaenger || '').toLowerCase().includes(window.currentSearchTerm);
        const matchBox = (item.box || '').toLowerCase().includes(window.currentSearchTerm);
        if (!matchName && !matchSub && !matchWer && !matchEmpf && !matchBox) return false;
      }

      if (window.currentFilterStatus !== 'alle') {
        const itemStatus = (item.status || 'Offen').toLowerCase();
        if (itemStatus !== window.currentFilterStatus.toLowerCase()) return false;
      }

      return true;
    });

    if (matchingItems.length > 0 || showEditControls) {
      html += `
      <div class="bg-white dark:bg-slate-900 rounded-2xl border ${showEditControls ? 'border-amber-500/50' : 'border-slate-200 dark:border-slate-800'} shadow-sm dark:shadow-md overflow-hidden mb-6">
        <div class="px-5 py-3.5 bg-slate-50 dark:bg-slate-900/90 border-b border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2">
          <div class="flex items-center gap-2">
            <h3 class="text-xs sm:text-sm font-black tracking-wide text-amber-600 dark:text-amber-400 uppercase">
              ${escapeHtml(cat.title)}
            </h3>
            <span class="text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-300 dark:border-slate-700">
              ${matchingItems.length} Einträge
            </span>
          </div>
          ${showEditControls ? `
          <div class="flex items-center gap-1">
            <button onclick="window.renameCategory(${catIdx})" class="px-2 py-1 text-[11px] font-semibold bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded hover:bg-slate-300 transition">✏️ Umbenennen</button>
            <button onclick="window.editCategoryStatuses(${catIdx})" class="px-2 py-1 text-[11px] font-semibold bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded hover:bg-slate-300 transition">🏷️ Status</button>
            <button onclick="window.moveCategory(${catIdx}, -1)" ${catIdx === 0 ? 'disabled' : ''} class="px-2 py-1 text-[11px] bg-slate-200 dark:bg-slate-800 rounded disabled:opacity-30">⬆️</button>
            <button onclick="window.moveCategory(${catIdx}, 1)" ${catIdx === window.inventarData.length - 1 ? 'disabled' : ''} class="px-2 py-1 text-[11px] bg-slate-200 dark:bg-slate-800 rounded disabled:opacity-30">⬇️</button>
            <button onclick="window.deleteCategory(${catIdx})" class="px-2 py-1 text-[11px] bg-rose-500/20 text-rose-600 dark:text-rose-400 border border-rose-500/30 rounded font-bold">🗑️ Löschen</button>
          </div>
          ` : ''}
        </div>
        <div class="overflow-x-auto">
          <table class="w-full text-left text-xs border-collapse">
            <thead>
              <tr class="bg-slate-100/70 dark:bg-slate-800/50 text-[11px] font-bold uppercase text-slate-600 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800">
                <th class="py-3 px-4">${isOrga ? 'DETAIL' : 'GEGENSTAND'}</th>
                ${isOrga ? '' : '<th class="py-3 px-2 text-center w-16">BEDARF</th>'}
                ${isOrga ? '' : '<th class="py-3 px-2 text-center w-16">LAGER</th>'}
                <th class="py-3 px-2 text-center w-36">STATUS</th>
                ${isOrga ? '<th class="py-3 px-2 text-center w-36">EMPFÄNGER</th>' : ''}
                <th class="py-3 px-2 text-center w-40">VERANTWORTLICH</th>
                ${isOrga ? '' : '<th class="py-3 px-2 text-center w-24">EINGEPACKT</th>'}
                <th class="py-3 px-2 text-center w-20">BOX</th>
                ${showEditControls ? '<th class="py-3 px-2 text-center w-24">AKTIONEN</th>' : ''}
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-200 dark:divide-slate-800/60">
      `;

      cat.items.forEach((item, itemIdx) => {
        if (!matchingItems.includes(item) && !showEditControls) return;

        const statusStyle = getStatusStyleClass(item.status || 'Offen');
        const verantwortlicherVal = item.verantwortlich || item.wer || '';
        const currentItemStatus = item.status || 'Offen';

        let optionsList = [...availableStatuses];
        if (!optionsList.includes(currentItemStatus)) {
          optionsList.push(currentItemStatus);
        }

        html += `
        <tr class="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition">
          <td class="py-2.5 px-4 font-semibold text-slate-900 dark:text-slate-100">
            ${showEditControls ? `
              <input type="text" value="${escapeHtml(item.name)}" placeholder="Name..." 
                onchange="window.updateInventarItem(${catIdx}, ${itemIdx}, 'name', this.value)"
                class="w-full font-bold bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded py-0.5 px-1.5 text-xs text-slate-900 dark:text-slate-100 focus:border-amber-500 focus:outline-none mb-1" />
              <input type="text" value="${escapeHtml(item.sub || '')}" placeholder="Beschreibung/Subtext..." 
                onchange="window.updateInventarItem(${catIdx}, ${itemIdx}, 'sub', this.value)"
                class="w-full text-[10px] bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded py-0.5 px-1.5 text-slate-600 dark:text-slate-400 focus:border-amber-500 focus:outline-none" />
            ` : `
              <div class="leading-tight text-slate-900 dark:text-slate-100 font-bold">${escapeHtml(item.name)}</div>
              ${item.sub ? `<div class="text-[10px] font-normal text-slate-500 dark:text-slate-400 mt-0.5">${escapeHtml(item.sub)}</div>` : ''}
            `}
          </td>
          ${isOrga ? '' : `
          <td class="py-2.5 px-2 text-center">
            <input type="number" value="${item.bedarf ?? 1}" ${isReadonly ? 'disabled' : ''} 
              onchange="window.updateInventarItem(${catIdx}, ${itemIdx}, 'bedarf', parseInt(this.value) || 0)"
              class="w-12 text-center bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-md py-1 px-1 text-slate-900 dark:text-slate-100 font-bold focus:border-amber-500 focus:outline-none disabled:opacity-60" />
          </td>
          <td class="py-2.5 px-2 text-center">
            <input type="number" value="${item.lager ?? 0}" ${isReadonly ? 'disabled' : ''} 
              onchange="window.updateInventarItem(${catIdx}, ${itemIdx}, 'lager', parseInt(this.value) || 0)"
              class="w-12 text-center bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-md py-1 px-1 text-emerald-600 dark:text-emerald-400 font-black focus:border-amber-500 focus:outline-none disabled:opacity-60" />
          </td>
          `}
          <td class="py-2.5 px-2 text-center">
            <select ${isReadonly ? 'disabled' : ''} onchange="window.updateInventarItem(${catIdx}, ${itemIdx}, 'status', this.value)" 
              class="w-full bg-white dark:bg-slate-950 border rounded-md py-1 px-2 text-xs font-bold focus:border-amber-500 focus:outline-none disabled:opacity-60 ${statusStyle}">
              ${optionsList.map(st => `
                <option value="${escapeHtml(st)}" ${st === currentItemStatus ? 'selected' : ''} class="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 font-semibold">
                  ${escapeHtml(st)}
                </option>
              `).join('')}
            </select>
          </td>
          ${isOrga ? `
          <td class="py-2.5 px-2 text-center">
            <input type="text" value="${escapeHtml(item.empfaenger || '')}" ${isReadonly ? 'disabled' : ''} placeholder="–" 
              onchange="window.updateInventarItem(${catIdx}, ${itemIdx}, 'empfaenger', this.value)"
              class="w-full bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-md py-1 px-2 text-xs text-slate-900 dark:text-slate-100 font-medium focus:border-amber-500 focus:outline-none disabled:opacity-60" />
          </td>
          ` : ''}
          <td class="py-2.5 px-2 text-center">
            <input type="text" value="${escapeHtml(verantwortlicherVal)}" ${isReadonly ? 'disabled' : ''} placeholder="–" 
              onchange="window.updateInventarItem(${catIdx}, ${itemIdx}, 'verantwortlich', this.value)"
              class="w-full bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-md py-1 px-2 text-xs text-slate-900 dark:text-slate-100 font-medium focus:border-amber-500 focus:outline-none disabled:opacity-60" />
          </td>
          ${isOrga ? '' : `
          <td class="py-2.5 px-2 text-center">
            <input type="checkbox" ${item.pack ? 'checked' : ''} ${isReadonly ? 'disabled' : ''} 
              onchange="window.updateInventarItem(${catIdx}, ${itemIdx}, 'pack', this.checked)"
              class="w-4 h-4 accent-amber-500 rounded cursor-pointer disabled:opacity-60" />
          </td>
          `}
          <td class="py-2.5 px-2 text-center">
            <input type="text" value="${escapeHtml(item.box || '')}" ${isReadonly ? 'disabled' : ''} placeholder="–" 
              onchange="window.updateInventarItem(${catIdx}, ${itemIdx}, 'box', this.value)"
              class="w-full text-center bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-md py-1 px-1 text-xs text-slate-900 dark:text-slate-100 font-mono focus:border-amber-500 focus:outline-none disabled:opacity-60" />
          </td>
          ${showEditControls ? `
          <td class="py-2.5 px-2 text-center">
            <div class="flex items-center justify-center gap-1">
              <button onclick="window.moveItem(${catIdx}, ${itemIdx}, -1)" ${itemIdx === 0 ? 'disabled' : ''} title="Nach oben" class="p-1 text-[10px] bg-slate-200 dark:bg-slate-800 rounded disabled:opacity-30">⬆️</button>
              <button onclick="window.moveItem(${catIdx}, ${itemIdx}, 1)" ${itemIdx === cat.items.length - 1 ? 'disabled' : ''} title="Nach unten" class="p-1 text-[10px] bg-slate-200 dark:bg-slate-800 rounded disabled:opacity-30">⬇️</button>
              <button onclick="window.deleteItem(${catIdx}, ${itemIdx})" title="Löschen" class="p-1 text-[10px] bg-rose-500/20 text-rose-500 border border-rose-500/30 rounded font-bold">🗑️</button>
            </div>
          </td>
          ` : ''}
        </tr>
        `;
      });

      html += `
            </tbody>
          </table>
        </div>
        ${showEditControls ? `
        <div class="p-3 bg-slate-100/50 dark:bg-slate-950/40 border-t border-slate-200 dark:border-slate-800 text-center">
          <button onclick="window.addItem(${catIdx})" class="px-3 py-1 bg-amber-500/20 hover:bg-amber-500/30 text-amber-600 dark:text-amber-400 border border-amber-500/30 text-xs font-bold rounded-lg transition inline-flex items-center gap-1">
            ➕ Neuer Gegenstand in ${escapeHtml(cat.title)}
          </button>
        </div>
        ` : ''}
      </div>
      `;
    }
  });

  if (showEditControls) {
    html += `
    <div class="p-6 bg-slate-50 dark:bg-slate-900 border-2 border-dashed border-amber-500/40 rounded-2xl text-center">
      <button onclick="window.addCategory()" class="px-5 py-2.5 bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs rounded-xl shadow-md transition flex items-center gap-2 mx-auto">
        ➕ Neue Kategorie hinzufügen
      </button>
    </div>
    `;
  }

  container.innerHTML = html || '<div class="p-8 text-center text-slate-500 dark:text-slate-400 text-xs">Keine passenden Einträge für diesen Filter gefunden.</div>';

  const percent = totalItems > 0 ? Math.round((completedItems / totalItems) * 100) : 0;
  const progressText = document.getElementById('inventarProgressText');
  if (progressText) {
    progressText.innerText = `${percent}% erledigt (${completedItems}/${totalItems})`;
  }
}
window.renderInventar = renderInventar;

function updateInventarItem(catIdx, itemIdx, field, val) {
  if (!window.inventarData[catIdx] || !window.inventarData[catIdx].items[itemIdx]) return;
  window.inventarData[catIdx].items[itemIdx][field] = val;
  syncWithGoogleSheets();
  renderInventar();
}
window.updateInventarItem = updateInventarItem;

async function syncWithGoogleSheets() {
  try {
    await fetch(GOOGLE_SCRIPT_URL, {
      method: 'POST',
      mode: 'no-cors',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(window.inventarData)
    });
  } catch (e) {
    console.warn('Fehler beim Speichern in Google Sheets:', e);
  }
}
window.syncWithGoogleSheets = syncWithGoogleSheets;

function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
window.escapeHtml = escapeHtml;

// Sichere Initialisierung
function initApp() {
  try {
    initTheme();
    applyRolePermissions(window.currentUserRole);
    renderKasse();
    renderStatistik();
  } catch (e) {
    console.error('Fehler bei der Initialisierung:', e);
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initApp);
} else {
  initApp();
}
