// ==========================================
// SG BARNSTORF WEIHNACHTSMARKT - MAIN ENGINE
// ==========================================

const GOOGLE_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbyQg2LmxT_UbLXjFVKrNf9gXnqgk_ku4V_P1SZeSGqphn-WRTYI3a9l5szzkDfqEE881Q/exec';

// Standard-Inventar falls Google Sheets oder LocalStorage leer sind
const DEFAULT_INVENTAR_CATEGORIES = [
  {
    category: "Stand & Elektro",
    items: [
      { name: "Verlängerungskabel (Outdoor)", menge: "3 Stk", kiste: "Kiste 1 (Elektro)", verantwortlicher: "SG Barnstorf", status: "vorhanden" },
      { name: "Mehrfachsteckdosen", menge: "4 Stk", kiste: "Kiste 1 (Elektro)", verantwortlicher: "SG Barnstorf", status: "vorhanden" },
      { name: "Lichterkette / Beleuchtung", menge: "2 Stk", kiste: "Kiste 2 (Deko)", verantwortlicher: "SG Barnstorf", status: "vorhanden" },
      { name: "Kabelbrücken", menge: "2 Stk", kiste: "Standzubehör", verantwortlicher: "SG Barnstorf", status: "vorhanden" }
    ]
  },
  {
    category: "Waffeln & Zubehör",
    items: [
      { name: "Doppel-Waffeleisen", menge: "2 Stk", kiste: "Kiste 3 (Küche)", verantwortlicher: "SG Barnstorf", status: "vorhanden" },
      { name: "Teigbehälter & Schöpfkellen", menge: "2 Set", kiste: "Kiste 3 (Küche)", verantwortlicher: "SG Barnstorf", status: "vorhanden" },
      { name: "Puderzuckerstreuer", menge: "2 Stk", kiste: "Kiste 3 (Küche)", verantwortlicher: "SG Barnstorf", status: "vorhanden" },
      { name: "Servietten & Einwegteller", menge: "500 Stk", kiste: "Verbrauchsmaterial", verantwortlicher: "Orga", status: "offen" }
    ]
  },
  {
    category: "Kinderpunsch & Gastro",
    items: [
      { name: "Glühweineinkocher / Thermotop", menge: "2 Stk", kiste: "Kiste 4 (Gastro)", verantwortlicher: "SG Barnstorf", status: "vorhanden" },
      { name: "Thermobecher (0,2l)", menge: "300 Stk", kiste: "Kiste 4 (Gastro)", verantwortlicher: "Orga", status: "offen" },
      { name: "Ausschöpfkellen & Messbecher", menge: "2 Stk", kiste: "Kiste 4 (Gastro)", verantwortlicher: "SG Barnstorf", status: "vorhanden" },
      { name: "Topflappen & Spültücher", menge: "1 Set", kiste: "Kiste 4 (Gastro)", verantwortlicher: "SG Barnstorf", status: "vorhanden" }
    ]
  },
  {
    category: "Kasse & Standausstattung",
    items: [
      { name: "Wechselgeldkassette", menge: "1 Stk", kiste: "Orga", verantwortlicher: "Kassierer", status: "vorhanden" },
      { name: "Preisschilder & Aushänge", menge: "1 Set", kiste: "Deko", verantwortlicher: "Orga", status: "vorhanden" },
      { name: "Müllbeutel & Desinfektion", menge: "1 Set", kiste: "Hygiene", verantwortlicher: "Orga", status: "vorhanden" }
    ]
  }
];

// Globale Zustandsvariablen
window.currentUserRole = localStorage.getItem('userRole') || 'gast';
window.isEditMode = false;
window.currentFilterStatus = 'alle';
window.currentSearchTerm = '';
window.isSyncing = false;
window.autoSyncTimer = null;

// Sicheres Laden der initialen Inventardaten
function getInitialInventarData() {
  if (typeof window.inventarCategories !== 'undefined' && Array.isArray(window.inventarCategories) && window.inventarCategories.length > 0) {
    try {
      return JSON.parse(JSON.stringify(window.inventarCategories));
    } catch (e) {
      console.error('Fehler beim Klonen von inventarCategories:', e);
    }
  }
  return JSON.parse(JSON.stringify(DEFAULT_INVENTAR_CATEGORIES));
}
window.getInitialInventarData = getInitialInventarData;

// Initialisierung von window.inventarData aus LocalStorage oder Fallback
try {
  const savedInv = localStorage.getItem('inventarData');
  const parsedInv = savedInv ? JSON.parse(savedInv) : null;
  if (parsedInv && Array.isArray(parsedInv) && parsedInv.length > 0) {
    window.inventarData = parsedInv;
  } else {
    window.inventarData = getInitialInventarData();
  }
} catch (e) {
  window.inventarData = getInitialInventarData();
}

// Standard Kassen- & Verkauf-Zustand
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
  const parsedKasse = savedKasse ? JSON.parse(savedKasse) : {};
  window.kasseData = Object.assign({}, DEFAULT_KASSE_DATA, parsedKasse);
} catch (e) {
  window.kasseData = { ...DEFAULT_KASSE_DATA };
}

// Nicht-blockierende Toast-Benachrichtigung
function showToast(message, type = 'info') {
  let toastContainer = document.getElementById('toastContainer');
  if (!toastContainer) {
    toastContainer = document.createElement('div');
    toastContainer.id = 'toastContainer';
    toastContainer.className = 'fixed bottom-5 right-5 z-50 flex flex-col gap-2 max-w-sm pointer-events-none';
    document.body.appendChild(toastContainer);
  }

  const toast = document.createElement('div');
  const bgClass = type === 'error' 
    ? 'bg-rose-900/90 border-rose-700 text-rose-100' 
    : (type === 'success' ? 'bg-emerald-900/90 border-emerald-700 text-emerald-100' : 'bg-slate-900/90 border-slate-700 text-slate-100');

  toast.className = `pointer-events-auto px-4 py-3 rounded-xl border shadow-xl text-xs font-bold backdrop-blur transition-all transform translate-y-2 opacity-0 flex items-center justify-between gap-3 ${bgClass}`;
  toast.innerHTML = `<span>${message}</span>`;

  toastContainer.appendChild(toast);

  requestAnimationFrame(() => {
    toast.classList.remove('translate-y-2', 'opacity-0');
  });

  setTimeout(() => {
    toast.classList.add('opacity-0', 'translate-y-2');
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}
window.showToast = showToast;

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
    showToast('Bitte melde dich an, um auf diesen Bereich zuzugreifen.', 'error');
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
      loadKasseFromGoogleSheets();
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
    showToast(`Erfolgreich als ${role.toUpperCase()} angemeldet!`, 'success');
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

  const adminControls = document.querySelectorAll('.admin-only-control');
  adminControls.forEach(el => {
    if (role === 'admin' || role === 'orga') {
      el.classList.remove('hidden');
    } else {
      el.classList.add('hidden');
    }
  });

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

  renderInventar();
  renderKasse();
}
window.applyRolePermissions = applyRolePermissions;

// ------------------------------------------
// 3. VERKAUF / KASSE & STATISTIK
// ------------------------------------------
function updateKasseSyncBadge(status) {
  const badge = document.getElementById('kasseSyncBadge');
  if (!badge) return;

  if (status === 'syncing') {
    badge.className = "text-xs px-3 py-1 rounded-full font-bold bg-amber-500/10 text-amber-400 border border-amber-500/30 flex items-center gap-1.5";
    badge.innerHTML = '<span class="w-2.5 h-2.5 rounded-full bg-amber-500 animate-ping"></span> Speichere...';
  } else if (status === 'success') {
    badge.className = "text-xs px-3 py-1 rounded-full font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 flex items-center gap-1.5";
    badge.innerHTML = '<span class="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span> Synchronisiert';
  } else if (status === 'error') {
    badge.className = "text-xs px-3 py-1 rounded-full font-bold bg-rose-500/10 text-rose-400 border border-rose-500/30 flex items-center gap-1.5";
    badge.innerHTML = '<span class="w-2.5 h-2.5 rounded-full bg-rose-500"></span> Offline (Lokal)';
  }
}
window.updateKasseSyncBadge = updateKasseSyncBadge;

function updateKassePrice(item, priceVal) {
  if (window.currentUserRole !== 'admin' && window.currentUserRole !== 'orga') {
    showToast('Nur Admins und die Orga dürfen Preise anpassen.', 'error');
    return;
  }
  const price = Math.max(0, parseFloat(priceVal) || 0);
  const key = item + 'Price';
  window.kasseData[key] = price;
  localStorage.setItem('kasseData', JSON.stringify(window.kasseData));
  renderKasse();
  renderStatistik();
  syncAllWithGoogleSheets();
}
window.updateKassePrice = updateKassePrice;

function changeKasseCount(item, type, delta) {
  const key = item + (type === 'paid' ? 'Paid' : 'Free');
  const currentVal = typeof window.kasseData[key] === 'number' ? window.kasseData[key] : 0;
  window.kasseData[key] = Math.max(0, currentVal + delta);
  localStorage.setItem('kasseData', JSON.stringify(window.kasseData));
  renderKasse();
  renderStatistik();
  syncAllWithGoogleSheets();
}
window.changeKasseCount = changeKasseCount;

function renderKasse() {
  const punschPaidEl = document.getElementById('countKinderpunschPaid');
  const punschFreeEl = document.getElementById('countKinderpunschFree');
  const waffelPaidEl = document.getElementById('countWaffelPaid');
  const waffelFreeEl = document.getElementById('countWaffelFree');
  const totalEurosEl = document.getElementById('kasseLiveTotalEuros');

  const punschPriceDisp = document.getElementById('displayKinderpunschPrice');
  const punschPriceInp = document.getElementById('inputKinderpunschPrice');
  const waffelPriceDisp = document.getElementById('displayWaffelPrice');
  const waffelPriceInp = document.getElementById('inputWaffelPrice');

  const punschPrice = typeof window.kasseData.kinderpunschPrice === 'number' ? window.kasseData.kinderpunschPrice : 2.00;
  const waffelPrice = typeof window.kasseData.waffelPrice === 'number' ? window.kasseData.waffelPrice : 2.00;

  if (punschPaidEl) punschPaidEl.innerText = window.kasseData.kinderpunschPaid || 0;
  if (punschFreeEl) punschFreeEl.innerText = window.kasseData.kinderpunschFree || 0;
  if (waffelPaidEl) waffelPaidEl.innerText = window.kasseData.waffelPaid || 0;
  if (waffelFreeEl) waffelFreeEl.innerText = window.kasseData.waffelFree || 0;

  if (punschPriceDisp) punschPriceDisp.innerText = `${punschPrice.toFixed(2).replace('.', ',')} € / Becher`;
  if (punschPriceInp && document.activeElement !== punschPriceInp) punschPriceInp.value = punschPrice.toFixed(2);

  if (waffelPriceDisp) waffelPriceDisp.innerText = `${waffelPrice.toFixed(2).replace('.', ',')} € / Stück`;
  if (waffelPriceInp && document.activeElement !== waffelPriceInp) waffelPriceInp.value = waffelPrice.toFixed(2);

  const totalRev = ((window.kasseData.kinderpunschPaid || 0) * punschPrice) +
                   ((window.kasseData.waffelPaid || 0) * waffelPrice);

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

  const punschPrice = typeof window.kasseData.kinderpunschPrice === 'number' ? window.kasseData.kinderpunschPrice : 2.00;
  const waffelPrice = typeof window.kasseData.waffelPrice === 'number' ? window.kasseData.waffelPrice : 2.00;

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
  window.kasseData.kinderpunschPaid = 0;
  window.kasseData.kinderpunschFree = 0;
  window.kasseData.waffelPaid = 0;
  window.kasseData.waffelFree = 0;
  localStorage.setItem('kasseData', JSON.stringify(window.kasseData));
  renderKasse();
  renderStatistik();
  syncAllWithGoogleSheets();
  showToast('Zählerstände wurden auf 0 zurückgesetzt.', 'info');
}
window.resetKasseData = resetKasseData;

async function loadKasseFromGoogleSheets() {
  updateKasseSyncBadge('syncing');
  try {
    const res = await fetch(GOOGLE_SCRIPT_URL);
    if (res.ok) {
      let data = await res.json();
      if (typeof data === 'string') {
        try { data = JSON.parse(data); } catch (e) {}
      }
      
      if (data && data.kasseData) {
        window.kasseData = Object.assign({}, DEFAULT_KASSE_DATA, data.kasseData);
        localStorage.setItem('kasseData', JSON.stringify(window.kasseData));
        renderKasse();
        renderStatistik();
      } else if (data && data.kinderpunschPaid !== undefined) {
        window.kasseData = Object.assign({}, DEFAULT_KASSE_DATA, data);
        localStorage.setItem('kasseData', JSON.stringify(window.kasseData));
        renderKasse();
        renderStatistik();
      }
      updateKasseSyncBadge('success');
    }
  } catch (e) {
    console.warn('Offline oder Fehler beim Laden der Kasse aus Google Sheets:', e);
    updateKasseSyncBadge('error');
  }
}
window.loadKasseFromGoogleSheets = loadKasseFromGoogleSheets;

// ------------------------------------------
// 4. INVENTAR, SUCHE, FILTER & EDIT LOGIK
// ------------------------------------------
function toggleEditMode() {
  if (window.currentUserRole !== 'admin' && window.currentUserRole !== 'orga') {
    showToast('Nur Admins und die Orga können den Bearbeitungsmodus aktivieren.', 'error');
    return;
  }
  window.isEditMode = !window.isEditMode;
  const btn = document.getElementById('adminInventarEditBtn');
  if (btn) {
    btn.innerText = window.isEditMode ? '💾 Bearbeiten Beenden' : '✏️ Bearbeiten';
    btn.className = window.isEditMode 
      ? 'px-3.5 py-2 bg-emerald-500 hover:bg-emerald-600 text-slate-950 text-xs font-bold rounded-xl transition shadow' 
      : 'px-3.5 py-2 bg-amber-500 hover:bg-amber-600 text-slate-950 text-xs font-bold rounded-xl transition shadow';
  }
  renderInventar();
}
window.toggleEditMode = toggleEditMode;

function handleInventarSearch(term) {
  window.currentSearchTerm = (term || '').toLowerCase();
  renderInventar();
}
window.handleInventarSearch = handleInventarSearch;

function setFilterStatus(status) {
  window.currentFilterStatus = status;
  renderInventar();
}
window.setFilterStatus = setFilterStatus;

function renderFilterButtons() {
  const container = document.getElementById('filterButtonsContainer');
  if (!container) return;

  const statuses = [
    { id: 'alle', label: 'Alle' },
    { id: 'offen', label: 'Offen ❌' },
    { id: 'eingekauft', label: 'Besorgt 🛒' },
    { id: 'vorhanden', label: 'Vorhanden ✅' }
  ];

  container.innerHTML = statuses.map(s => {
    const isActive = window.currentFilterStatus === s.id;
    const activeClass = isActive 
      ? 'bg-amber-500 text-slate-950 font-bold border-amber-500' 
      : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800';
    return `<button onclick="window.setFilterStatus('${s.id}')" class="px-3 py-1.5 text-xs rounded-xl border transition ${activeClass}">${s.label}</button>`;
  }).join('');
}

function renderInventar() {
  renderFilterButtons();
  const container = document.getElementById('inventarTablesContainer');
  if (!container) return;

  if (!window.inventarData || !Array.isArray(window.inventarData) || window.inventarData.length === 0) {
    window.inventarData = getInitialInventarData();
  }

  let totalItemsCount = 0;
  let matchesCount = 0;

  let html = window.inventarData.map((cat, catIdx) => {
    const items = cat.items || [];
    totalItemsCount += items.length;

    const filteredItems = items.filter(item => {
      const name = (item.name || '').toLowerCase();
      const resp = (item.verantwortlicher || '').toLowerCase();
      const box = (item.kiste || '').toLowerCase();
      const matchesSearch = !window.currentSearchTerm || name.includes(window.currentSearchTerm) || resp.includes(window.currentSearchTerm) || box.includes(window.currentSearchTerm);

      const status = (item.status || 'offen').toLowerCase();
      let matchesFilter = true;
      if (window.currentFilterStatus !== 'alle') {
        matchesFilter = status === window.currentFilterStatus;
      }

      return matchesSearch && matchesFilter;
    });

    matchesCount += filteredItems.length;

    if (filteredItems.length === 0 && !window.isEditMode) return '';

    const rowsHtml = filteredItems.map((item) => {
      const realItemIndex = items.indexOf(item);
      const isEditable = window.isEditMode && (window.currentUserRole === 'admin' || window.currentUserRole === 'orga');

      if (isEditable) {
        return `
          <tr class="border-b border-slate-100 dark:border-slate-800/60 hover:bg-slate-50 dark:hover:bg-slate-800/40">
            <td class="p-3"><input type="text" value="${item.name || ''}" onchange="window.updateInventarField(${catIdx}, ${realItemIndex}, 'name', this.value)" class="w-full px-2 py-1 text-xs bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded" /></td>
            <td class="p-3"><input type="text" value="${item.menge || ''}" onchange="window.updateInventarField(${catIdx}, ${realItemIndex}, 'menge', this.value)" class="w-20 px-2 py-1 text-xs bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded" /></td>
            <td class="p-3"><input type="text" value="${item.kiste || ''}" onchange="window.updateInventarField(${catIdx}, ${realItemIndex}, 'kiste', this.value)" class="w-full px-2 py-1 text-xs bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded" /></td>
            <td class="p-3"><input type="text" value="${item.verantwortlicher || ''}" onchange="window.updateInventarField(${catIdx}, ${realItemIndex}, 'verantwortlicher', this.value)" class="w-full px-2 py-1 text-xs bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded" /></td>
            <td class="p-3">
              <select onchange="window.updateInventarField(${catIdx}, ${realItemIndex}, 'status', this.value)" class="px-2 py-1 text-xs bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded">
                <option value="offen" ${item.status === 'offen' ? 'selected' : ''}>Offen ❌</option>
                <option value="eingekauft" ${item.status === 'eingekauft' ? 'selected' : ''}>Besorgt 🛒</option>
                <option value="vorhanden" ${item.status === 'vorhanden' ? 'selected' : ''}>Vorhanden ✅</option>
              </select>
            </td>
            <td class="p-3 text-center">
              <button onclick="window.deleteInventarItem(${catIdx}, ${realItemIndex})" class="p-1 text-rose-500 hover:text-rose-700 font-bold">🗑️</button>
            </td>
          </tr>
        `;
      }

      let statusBadge = '<span class="px-2.5 py-1 rounded-full text-[10px] font-bold bg-rose-500/10 text-rose-500 border border-rose-500/20">Offen ❌</span>';
      if (item.status === 'eingekauft') {
        statusBadge = '<span class="px-2.5 py-1 rounded-full text-[10px] font-bold bg-amber-500/10 text-amber-500 border border-amber-500/20">Besorgt 🛒</span>';
      } else if (item.status === 'vorhanden') {
        statusBadge = '<span class="px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">Vorhanden ✅</span>';
      }

      return `
        <tr class="border-b border-slate-100 dark:border-slate-800/60 hover:bg-slate-50 dark:hover:bg-slate-800/40 transition">
          <td class="p-3 text-xs font-bold text-slate-800 dark:text-slate-100">${item.name || ''}</td>
          <td class="p-3 text-xs font-semibold text-amber-600 dark:text-amber-400">${item.menge || '-'}</td>
          <td class="p-3 text-xs text-slate-500 dark:text-slate-400">${item.kiste || '-'}</td>
          <td class="p-3 text-xs text-slate-600 dark:text-slate-300 font-medium">${item.verantwortlicher || '-'}</td>
          <td class="p-3 text-xs">${statusBadge}</td>
        </tr>
      `;
    }).join('');

    return `
      <div class="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden space-y-2">
        <div class="bg-slate-50 dark:bg-slate-950 p-4 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center">
          <h3 class="font-black text-sm sm:text-base text-amber-600 dark:text-amber-400 flex items-center gap-2">
            <span>${cat.category || 'Kategorie'}</span>
          </h3>
          ${window.isEditMode ? `<button onclick="window.addInventarItem(${catIdx})" class="px-3 py-1 bg-amber-500 hover:bg-amber-600 text-slate-950 text-xs font-bold rounded-lg transition">+ Gegenstand</button>` : ''}
        </div>
        <div class="overflow-x-auto">
          <table class="w-full text-left border-collapse">
            <thead>
              <tr class="text-[11px] font-bold uppercase tracking-wider text-slate-400 border-b border-slate-100 dark:border-slate-800/80">
                <th class="p-3">Gegenstand</th>
                <th class="p-3">Menge</th>
                <th class="p-3">Kiste / Ort</th>
                <th class="p-3">Verantwortlich</th>
                <th class="p-3">Status</th>
                ${window.isEditMode ? '<th class="p-3 text-center">Aktion</th>' : ''}
              </tr>
            </thead>
            <tbody>
              ${rowsHtml}
            </tbody>
          </table>
        </div>
      </div>
    `;
  }).join('');

  container.innerHTML = html || `<div class="p-8 text-center text-slate-500 text-xs font-semibold">Keine Gegenstände für die Filterung gefunden.</div>`;

  const progressText = document.getElementById('inventarProgressText');
  if (progressText) {
    progressText.innerText = `Zeige ${matchesCount} von ${totalItemsCount} Gegenständen`;
  }
}
window.renderInventar = renderInventar;

function updateInventarField(catIdx, itemIdx, field, value) {
  if (!window.inventarData[catIdx] || !window.inventarData[catIdx].items[itemIdx]) return;
  window.inventarData[catIdx].items[itemIdx][field] = value;
  localStorage.setItem('inventarData', JSON.stringify(window.inventarData));
  syncAllWithGoogleSheets();
}
window.updateInventarField = updateInventarField;

function addInventarItem(catIdx) {
  if (!window.inventarData[catIdx]) return;
  window.inventarData[catIdx].items.push({
    name: 'Neuer Gegenstand',
    menge: '1 Stk',
    kiste: 'Box',
    verantwortlicher: 'Verein',
    status: 'offen'
  });
  localStorage.setItem('inventarData', JSON.stringify(window.inventarData));
  renderInventar();
  syncAllWithGoogleSheets();
}
window.addInventarItem = addInventarItem;

function deleteInventarItem(catIdx, itemIdx) {
  if (!window.inventarData[catIdx] || !window.inventarData[catIdx].items[itemIdx]) return;
  window.inventarData[catIdx].items.splice(itemIdx, 1);
  localStorage.setItem('inventarData', JSON.stringify(window.inventarData));
  renderInventar();
  syncAllWithGoogleSheets();
  showToast('Gegenstand entfernt.', 'info');
}
window.deleteInventarItem = deleteInventarItem;

// ------------------------------------------
// 5. GOOGLE SHEETS SYNC SYSTEM
// ------------------------------------------
async function loadInventarFromGoogleSheets() {
  const progressText = document.getElementById('inventarProgressText');
  if (progressText) progressText.innerText = 'Lade Daten...';

  try {
    const res = await fetch(GOOGLE_SCRIPT_URL);
    if (res.ok) {
      let data = await res.json();
      if (typeof data === 'string') {
        try { data = JSON.parse(data); } catch (e) {}
      }
      
      let invArr = null;
      if (Array.isArray(data)) {
        invArr = data;
      } else if (data && Array.isArray(data.inventarData)) {
        invArr = data.inventarData;
        if (data.kasseData) {
          window.kasseData = Object.assign({}, DEFAULT_KASSE_DATA, data.kasseData);
          localStorage.setItem('kasseData', JSON.stringify(window.kasseData));
          renderKasse();
          renderStatistik();
        }
      }

      if (invArr && invArr.length > 0) {
        window.inventarData = invArr;
        localStorage.setItem('inventarData', JSON.stringify(window.inventarData));
        renderInventar();
      } else {
        // Falls Google Sheets leere Daten zurückgibt, stelle die Daten wieder her
        syncAllWithGoogleSheets();
        renderInventar();
      }
    }
  } catch (e) {
    console.warn('Google Sheets Fehler / Offline - nutze lokale Daten:', e);
    renderInventar();
  }
}
window.loadInventarFromGoogleSheets = loadInventarFromGoogleSheets;

async function syncAllWithGoogleSheets() {
  updateKasseSyncBadge('syncing');

  // Schutz vor dem Senden leerer Inventardaten!
  if (!window.inventarData || !Array.isArray(window.inventarData) || window.inventarData.length === 0) {
    window.inventarData = getInitialInventarData();
  }

  const payload = {
    inventarData: window.inventarData,
    kasseData: window.kasseData || DEFAULT_KASSE_DATA
  };

  try {
    await fetch(GOOGLE_SCRIPT_URL, {
      method: 'POST',
      mode: 'no-cors',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    updateKasseSyncBadge('success');
  } catch (e) {
    console.warn('Fehler beim Speichern in Google Sheets:', e);
    updateKasseSyncBadge('error');
  }
}
window.syncAllWithGoogleSheets = syncAllWithGoogleSheets;

function startAutoSync() {
  if (window.autoSyncTimer) clearInterval(window.autoSyncTimer);
  window.autoSyncTimer = setInterval(() => {
    if (document.visibilityState === 'visible') {
      loadKasseFromGoogleSheets();
    }
  }, 15000);
}

function initApp() {
  try {
    initTheme();
    applyRolePermissions(window.currentUserRole);
    renderKasse();
    renderStatistik();
    startAutoSync();
  } catch (e) {
    console.error('Fehler bei der Initialisierung:', e);
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initApp);
} else {
  initApp();
}
