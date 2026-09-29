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
window.isSyncing = false;
window.autoSyncTimer = null;

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

  // Admin / Orga Kontrollen steuern
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

  if (window.inventarData && window.inventarData.length > 0) {
    renderInventar();
  }
  renderKasse();
}
window.applyRolePermissions = applyRolePermissions;

// ------------------------------------------
// 3. VERKAUF / KASSE & STATISTIK LOGIK WITH GOOGLE SHEETS SYNC
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
    alert('Nur Admins und die Orga dürfen Preise anpassen.');
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
  if (confirm('Möchtest du die Zählerstände der Kasse wirklich für die neue Schicht auf 0 zurücksetzen?')) {
    window.kasseData.kinderpunschPaid = 0;
    window.kasseData.kinderpunschFree = 0;
    window.kasseData.waffelPaid = 0;
    window.kasseData.waffelFree = 0;
    localStorage.setItem('kasseData', JSON.stringify(window.kasseData));
    renderKasse();
    renderStatistik();
    syncAllWithGoogleSheets();
  }
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
        renderInventar();
      } else if (!window.inventarData || window.inventarData.length === 0) {
        window.inventarData = getInitialInventarData();
        renderInventar();
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

// Standard Synchronisation für Inventar und Kasse
async function syncAllWithGoogleSheets() {
  updateKasseSyncBadge('syncing');
  const payload = {
    inventarData: window.inventarData || [],
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

// Auto-Polling für synchrone Live-Daten auf allen Geräten
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
