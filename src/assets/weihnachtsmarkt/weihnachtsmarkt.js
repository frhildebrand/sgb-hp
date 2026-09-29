// ==========================================================
// SG BARNSTORF WEIHNACHTSMARKT - MAIN ENGINE (Neuaufbau)
// Prinzip: Alles wird zuerst lokal gespeichert und sofort
// angezeigt. Danach wird im Hintergrund mit Google Sheets
// synchronisiert.
// ==========================================================
const GOOGLE_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbyQg2LmxT_UbLXjFVKrNf9gXnqgk_ku4V_P1SZeSGqphn-WRTYI3a9l5szzkDfqEE881Q/exec';

// Passwoerter (nur Sichtschutz, im Quelltext lesbar)
const ROLE_PASSWORDS = { '1': 'helfer', '2': 'orga', '3': 'admin' };

// Punsch-Rezept (Vereinsrezept, Mengen fuer 8 Liter)
const PUNSCH_BASIS_LITER = 8;
const PUNSCH_ZUTATEN = [
  { name: 'Wasser', menge: 2, einheit: 'l' },
  { name: 'Wintertee', menge: 10, einheit: 'Btl.', schritt: 0.5 },
  { name: 'Orangensaft', menge: 1, einheit: 'l' },
  { name: 'Apfelsaft', menge: 2.5, einheit: 'l' },
  { name: 'Roter Traubensaft', menge: 2.5, einheit: 'l' },
  { name: 'Zimtstangen', menge: 2, einheit: 'Stk.', aufrunden: true },
  { name: 'Glühfix', menge: 5, einheit: 'Btl.', schritt: 0.5 }
];

const DEFAULT_PRICE = 2.0;
const COUNT_KEYS = ['kinderpunschPaid', 'kinderpunschFree', 'waffelPaid', 'waffelFree'];
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

function hashString(str) {
  let h = 5381;
  for (let i = 0; i < str.length; i++) h = ((h << 5) + h + str.charCodeAt(i)) | 0;
  return str.length + '-' + (h >>> 0).toString(36);
}
function capDay(day) {
  return day.charAt(0).toUpperCase() + day.slice(1);
}

// --- Verbindung zu Google Sheets (Apps Script Web-App) ---
async function getFromSheets(action, params) {
  try {
    const qs = new URLSearchParams(Object.assign({ action: action }, params || {}));
    const res = await fetch(GOOGLE_SCRIPT_URL + '?' + qs.toString(), { cache: 'no-store' });
    if (!res.ok) return null;
    const data = await res.json();
    return data && data.status === 'error' ? null : data;
  } catch (e) {
    return null;
  }
}
// Gibt { ok, verified } zurueck. Alle Schreibvorgaenge sind so gebaut, dass
// doppeltes Senden unschaedlich ist (immer kompletter Zustand, keine Zaehler-Deltas).
async function postToSheets(payload) {
  const body = JSON.stringify(payload);
  const headers = { 'Content-Type': 'text/plain;charset=utf-8' };
  try {
    const res = await fetch(GOOGLE_SCRIPT_URL, { method: 'POST', headers: headers, body: body });
    if (!res.ok) return { ok: false, verified: false };
    const reply = await res.json().catch(() => null);
    return { ok: !reply || reply.status !== 'error', verified: !!reply };
  } catch (e) {
    try {
      await fetch(GOOGLE_SCRIPT_URL, { method: 'POST', mode: 'no-cors', headers: headers, body: body });
      return { ok: true, verified: false };
    } catch (e2) {
      return { ok: false, verified: false };
    }
  }
}

// ------------------------------------------
// 1. ZUSTAND (immer zuerst lokal laden)
// ------------------------------------------
let savedRole = localStorage.getItem('userRole') || 'gast';
if (!['gast', 'helfer', 'orga', 'admin'].includes(savedRole)) savedRole = 'gast';
window.currentUserRole = savedRole;
window.currentView = 'aushang';
window.isEditMode = false;
window.currentFilterStatus = 'alle';
window.currentSearchTerm = '';
window.inventarData = lsGet('inventarData', null);
if (!Array.isArray(window.inventarData) || window.inventarData.length === 0) {
  window.inventarData = clone(window.inventarCategories || []);
}
let inventarSyncTimer = null;

// Kasse: jedes Geraet fuehrt eigene Zaehler, angezeigt wird die Summe aller Geraete.
function emptyCounts() {
  const c = {};
  COUNT_KEYS.forEach((k) => { c[k] = 0; });
  return c;
}
function pickCounts(src) {
  const c = emptyCounts();
  COUNT_KEYS.forEach((k) => { c[k] = Math.max(0, parseInt(src && src[k], 10) || 0); });
  return c;
}
function pickPrice(v) {
  const n = parseFloat(v);
  return isNaN(n) || n < 0 ? DEFAULT_PRICE : n;
}
function getDeviceId() {
  let id = localStorage.getItem('deviceId');
  if (!id) {
    id = 'd' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
    localStorage.setItem('deviceId', id);
  }
  return id;
}
const DEVICE_ID = getDeviceId();
const legacyKasse = lsGet('kasseData', null); // Altlast der ersten Version
let kasseConfig = Object.assign(
  {
    epoch: 0,
    ts: 0,
    kinderpunschPrice: pickPrice(legacyKasse && legacyKasse.kinderpunschPrice),
    waffelPrice: pickPrice(legacyKasse && legacyKasse.waffelPrice)
  },
  lsGet('kasseConfig', null) || {}
);
let kasseMine = lsGet('kasseMine', null) || { epoch: kasseConfig.epoch, counts: pickCounts(legacyKasse) };
kasseMine.counts = pickCounts(kasseMine.counts);
let kasseOthers = lsGet('kasseOthers', {});
window.kasseData = {};

// ------------------------------------------
// 2. THEME (Auto = Geraeteeinstellung, oder fest Hell/Dunkel; gilt fuer die ganze Seite)
// ------------------------------------------
function systemPrefersDark() {
  return !!(window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches);
}
window.getThemeMode = function () {
  const m = localStorage.getItem('themeMode');
  return m === 'light' || m === 'dark' ? m : 'auto';
};
window.applyDarkMode = function (isDark) {
  document.documentElement.classList.toggle('dark', isDark);
  if (document.body) document.body.classList.toggle('dark', isDark);
};
window.applyThemeMode = function () {
  const mode = window.getThemeMode();
  window.applyDarkMode(mode === 'dark' || (mode === 'auto' && systemPrefersDark()));
  const ui = {
    auto: ['🌓', 'Auto', 'Design: Automatisch (folgt dem Gerät)'],
    light: ['☀️', 'Hell', 'Design: Hell'],
    dark: ['🌙', 'Dunkel', 'Design: Dunkel']
  }[mode];
  setText('themeToggleIcon', ui[0]);
  setText('themeToggleLabel', ui[1]);
  const btn = document.getElementById('themeToggleBtn');
  if (btn) btn.title = ui[2] + ' - tippen zum Wechseln';
};
window.initTheme = function () {
  localStorage.removeItem('theme'); // Altlast: frueher gespeicherte Hell/Dunkel-Wahl
  window.applyThemeMode();
  const media = window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)') : null;
  if (media) {
    const onChange = () => { if (window.getThemeMode() === 'auto') window.applyThemeMode(); };
    if (media.addEventListener) media.addEventListener('change', onChange);
    else if (media.addListener) media.addListener(onChange);
  }
};
window.toggleTheme = function () {
  const order = ['auto', 'light', 'dark'];
  const next = order[(order.indexOf(window.getThemeMode()) + 1) % order.length];
  localStorage.setItem('themeMode', next);
  window.applyThemeMode();
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
  window.currentView = viewName;
  const backBtn = document.getElementById('backToAushangBtn');
  if (backBtn) backBtn.classList.toggle('hidden', viewName === 'aushang');

  if (viewName === 'aushang') {
    window.renderAushangImages();
    window.pullAushang();
  } else if (viewName === 'inventar') {
    window.renderInventar();
    window.loadInventarFromGoogleSheets();
  } else if (viewName === 'verkauf' || viewName === 'kasse') {
    window.renderKasse();
    window.loadKasseFromGoogleSheets();
  } else if (viewName === 'statistik') {
    window.renderStatistik();
    window.loadKasseFromGoogleSheets();
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
// 4. KASSE & STATISTIK (lokal zuerst, Abgleich ueber Google Sheets)
// Jedes Geraet bucht auf eigene Zaehler. Angezeigt wird die Summe aller
// Geraete, deshalb gehen bei gleichzeitigem Verkauf keine Buchungen verloren.
// "Schicht zuruecksetzen" erhoeht eine gemeinsame Schicht-Nummer (epoch);
// Zaehler mit alter Nummer werden auf allen Geraeten ignoriert.
// ------------------------------------------
let kasseSyncTimer = null;
let kasseSyncing = false;
let kasseResync = false;

function canEditKasse() {
  return window.currentUserRole === 'admin' || window.currentUserRole === 'orga';
}
function persistKasse() {
  lsSet('kasseMine', kasseMine);
  lsSet('kasseConfig', kasseConfig);
  lsSet('kasseOthers', kasseOthers);
}
function reconcileKasseEpoch() {
  if (kasseMine.epoch < kasseConfig.epoch) kasseMine = { epoch: kasseConfig.epoch, counts: emptyCounts() };
}
function recomputeKasse() {
  const total = Object.assign({}, kasseMine.epoch === kasseConfig.epoch ? kasseMine.counts : emptyCounts());
  Object.keys(kasseOthers).forEach((id) => {
    const o = kasseOthers[id];
    if (id === DEVICE_ID || !o || o.epoch !== kasseConfig.epoch) return;
    COUNT_KEYS.forEach((k) => { total[k] += Math.max(0, parseInt(o.data && o.data[k], 10) || 0); });
  });
  window.kasseData = Object.assign(total, {
    kinderpunschPrice: kasseConfig.kinderpunschPrice,
    waffelPrice: kasseConfig.waffelPrice
  });
}

function setKasseBadge(state) {
  const badge = document.getElementById('kasseSyncBadge');
  if (!badge) return;
  const styles = {
    loading: ['bg-slate-500/10 text-slate-300 border-slate-500/30', 'bg-slate-400 animate-pulse', 'Verbinde...'],
    pending: ['bg-sky-500/10 text-sky-400 border-sky-500/30', 'bg-sky-500 animate-pulse', 'Wird gesendet...'],
    synced: ['bg-emerald-500/10 text-emerald-400 border-emerald-500/30', 'bg-emerald-500 animate-pulse', 'Synchronisiert'],
    offline: ['bg-amber-500/10 text-amber-400 border-amber-500/30', 'bg-amber-500', 'Offline - lokal gespeichert']
  };
  const s = styles[state] || styles.offline;
  badge.className = 'text-xs px-3 py-1 rounded-full font-bold border flex items-center gap-1.5 ' + s[0];
  badge.innerHTML = '<span class="w-2.5 h-2.5 rounded-full ' + s[1] + '"></span> ' + s[2];
}

async function pushKasseConfig() {
  const r = await postToSheets({ action: 'kasseConfig', config: kasseConfig });
  if (r.ok) localStorage.removeItem('kasseConfigDirty');
  return r.ok;
}
async function pushKasseMine() {
  const r = await postToSheets({
    action: 'kasse',
    device: DEVICE_ID,
    epoch: kasseMine.epoch,
    data: kasseMine.counts
  });
  if (r.ok) localStorage.removeItem('kasseDirty');
  return r.ok;
}
window.syncKasse = async function () {
  if (kasseSyncing) {
    kasseResync = true;
    return;
  }
  kasseSyncing = true;
  try {
    if (localStorage.getItem('kasseConfigDirty') && !(await pushKasseConfig())) return setKasseBadge('offline');
    if (localStorage.getItem('kasseDirty') && !(await pushKasseMine())) return setKasseBadge('offline');
    const data = await getFromSheets('kasse');
    if (!data) return setKasseBadge('offline');
    if (data.config && typeof data.config.epoch === 'number') {
      kasseConfig = Object.assign({}, kasseConfig, data.config);
    }
    kasseOthers = {};
    Object.keys(data.devices || {}).forEach((id) => {
      if (id !== DEVICE_ID) kasseOthers[id] = data.devices[id];
    });
    reconcileKasseEpoch();
    persistKasse();
    recomputeKasse();
    window.renderKasse();
    window.renderStatistik();
    setKasseBadge('synced');
  } finally {
    kasseSyncing = false;
    if (kasseResync) {
      kasseResync = false;
      window.syncKasse();
    }
  }
};
function scheduleKasseSync() {
  setKasseBadge('pending');
  clearTimeout(kasseSyncTimer);
  kasseSyncTimer = setTimeout(window.syncKasse, 700);
}
window.loadKasseFromGoogleSheets = function () {
  setKasseBadge('loading');
  return window.syncKasse();
};

// --- Backups (nur dieses Geraet, letzte 15 Minuten) ---
function saveKasseBackup() {
  const cutoff = Date.now() - 15 * 60 * 1000;
  const list = lsGet('kasseBackups', []).filter((b) => b.ts > cutoff);
  list.push({ ts: Date.now(), epoch: kasseMine.epoch, counts: Object.assign({}, kasseMine.counts) });
  lsSet('kasseBackups', list.slice(-40));
}
window.openBackupModal = function () {
  const box = document.getElementById('backupListContainer');
  const cutoff = Date.now() - 15 * 60 * 1000;
  const list = lsGet('kasseBackups', []).filter((b) => b.ts > cutoff).reverse();
  if (box) {
    box.innerHTML = list.length === 0
      ? '<div class="text-slate-500 text-center py-4">Keine Backups der letzten 15 Minuten.</div>'
      : list.map((b) => {
          const c = b.counts || {};
          return `<div class="flex items-center justify-between gap-2 p-2 bg-slate-100 dark:bg-slate-800 rounded-lg">
            <span>${new Date(b.ts).toLocaleTimeString('de-DE')}: Punsch ${c.kinderpunschPaid}/${c.kinderpunschFree}, Waffeln ${c.waffelPaid}/${c.waffelFree}</span>
            <button onclick="window.restoreKasseBackup(${b.ts})" class="px-2 py-1 bg-amber-500 text-slate-950 font-bold rounded-lg">Laden</button>
          </div>`;
        }).join('') + '<div class="text-[11px] text-slate-500 pt-1">Gilt nur für die Buchungen dieses Geräts (bezahlt/gratis).</div>';
  }
  window.openModal('backupModal');
};
window.restoreKasseBackup = function (ts) {
  const entry = lsGet('kasseBackups', []).find((b) => b.ts === ts);
  if (!entry) return;
  if (entry.epoch !== kasseConfig.epoch) {
    alert('Dieses Backup stammt aus einer früheren Schicht und kann nicht geladen werden.');
    return;
  }
  saveKasseBackup();
  kasseMine = { epoch: kasseConfig.epoch, counts: pickCounts(entry.counts) };
  localStorage.setItem('kasseDirty', '1');
  persistKasse();
  recomputeKasse();
  window.renderKasse();
  window.renderStatistik();
  window.closeModal('backupModal');
  scheduleKasseSync();
};

// --- Buchen, Preise, Zuruecksetzen ---
window.changeKasseCount = function (item, type, delta) {
  const key = item + (type === 'paid' ? 'Paid' : 'Free');
  if (!COUNT_KEYS.includes(key)) return;
  reconcileKasseEpoch();
  if (delta < 0 && kasseMine.counts[key] === 0) {
    alert('Auf diesem Gerät wurde hier nichts gebucht. Korrigieren kann man nur am Gerät, das die Buchung erfasst hat.');
    return;
  }
  saveKasseBackup();
  kasseMine.counts[key] = Math.max(0, kasseMine.counts[key] + delta);
  localStorage.setItem('kasseDirty', '1');
  persistKasse();
  recomputeKasse();
  window.renderKasse();
  scheduleKasseSync();
};
window.updateKassePrice = function (item, value) {
  if (!canEditKasse()) return;
  const price = parseFloat(String(value).replace(',', '.'));
  if (isNaN(price) || price < 0) return;
  kasseConfig[item + 'Price'] = price;
  kasseConfig.ts = Date.now();
  localStorage.setItem('kasseConfigDirty', '1');
  persistKasse();
  recomputeKasse();
  window.renderKasse();
  window.renderStatistik();
  scheduleKasseSync();
};
window.updatePricesFromAdmin = function () {
  const waffel = document.getElementById('adminPriceWaffel');
  const punsch = document.getElementById('adminPricePunsch');
  if (waffel && waffel.value !== '') window.updateKassePrice('waffel', waffel.value);
  if (punsch && punsch.value !== '') window.updateKassePrice('kinderpunsch', punsch.value);
};
function doKasseReset() {
  saveKasseBackup();
  const epoch = Math.max(Date.now(), kasseConfig.epoch + 1);
  kasseConfig.epoch = epoch;
  kasseConfig.ts = Date.now();
  kasseMine = { epoch: epoch, counts: emptyCounts() };
  kasseOthers = {};
  localStorage.setItem('kasseConfigDirty', '1');
  localStorage.setItem('kasseDirty', '1');
  persistKasse();
  recomputeKasse();
  window.renderKasse();
  window.renderStatistik();
  scheduleKasseSync();
}
window.resetKasseData = function () {
  if (!canEditKasse()) {
    alert('Nur Admin oder Orga dürfen die Schicht zurücksetzen.');
    return;
  }
  if (!confirm('Das setzt die Zähler auf ALLEN Geräten für die neue Schicht auf 0. Bitte vorher die Summen aus der Statistik notieren. Fortfahren?')) return;
  doKasseReset();
};

// --- Darstellung ---
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
  const r = await postToSheets(window.inventarData);
  if (r.ok) localStorage.removeItem('inventarDirty');
  else console.warn('Offline - Änderungen bleiben lokal und werden später gesendet.');
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

// --- Rezept-Rechner (Kinderpunsch) ---
window.updatePunschRecipe = function () {
  const list = document.getElementById('recipeIngredientsList');
  const input = document.getElementById('punschCalcInput');
  if (!list || !input) return;
  const liters = Math.max(1, parseFloat(String(input.value).replace(',', '.')) || PUNSCH_BASIS_LITER);
  const factor = liters / PUNSCH_BASIS_LITER;
  list.innerHTML = PUNSCH_ZUTATEN.map((z) => {
    let amount = z.menge * factor;
    if (z.aufrunden) amount = Math.ceil(amount - 1e-9);
    else if (z.schritt) amount = Math.round(amount / z.schritt) * z.schritt;
    else amount = Math.round(amount * 100) / 100;
    const text = amount.toLocaleString('de-DE', { maximumFractionDigits: 2 });
    return `<li><span class="font-bold">${text} ${escapeHtml(z.einheit)}</span> ${escapeHtml(z.name)}</li>`;
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
  doKasseReset();
  window.renderInventar();
  window.renderKasse();
  window.renderStatistik();
};

// ------------------------------------------
// 7. AUSHANG: pro Tag ein DIN-A4-Blatt (Teigspenden + Schichtplan)
// Lokal zuerst, Bilder liegen zusaetzlich im Google Sheet und
// werden so auf allen Geraeten angezeigt.
// ------------------------------------------
const AUSHANG_TAGE = { samstag: 'Samstag', sonntag: 'Sonntag' };
window.roshopImages = { samstag: null, sonntag: null };
Object.keys(AUSHANG_TAGE).forEach((day) => {
  localStorage.removeItem('roshopImage_' + day); // Altlast: nur lokal gespeicherte Bilder der ersten Version
  window.roshopImages[day] = lsGet('aushangImage_' + day, null);
});

function saveAushangLocal(day, rec) {
  window.roshopImages[day] = rec;
  try {
    if (rec) localStorage.setItem('aushangImage_' + day, JSON.stringify(rec));
    else localStorage.removeItem('aushangImage_' + day);
  } catch (e) {
    console.warn('Bild zu groß für den lokalen Speicher - wird nur im Arbeitsspeicher gehalten:', e);
  }
}

window.renderAushangImages = function () {
  Object.keys(AUSHANG_TAGE).forEach((day) => {
    const cap = capDay(day);
    const img = document.getElementById('aushangImg' + cap);
    const empty = document.getElementById('aushangEmpty' + cap);
    const hint = document.getElementById('aushangHint' + cap);
    const rec = window.roshopImages[day];
    const has = !!(rec && rec.data);
    if (img) {
      if (has && img.dataset.sig !== rec.sig) {
        img.src = rec.data;
        img.dataset.sig = rec.sig;
      }
      img.classList.toggle('hidden', !has);
    }
    if (empty) empty.classList.toggle('hidden', has);
    if (hint) hint.classList.toggle('hidden', !has);
  });
};

async function uploadAushangRecord(day, rec) {
  const r = await postToSheets({ action: 'image', name: day, data: rec.data, sig: rec.sig });
  if (!r.ok) return false;
  const meta = await getFromSheets('imagemeta');
  const ok = !!(meta && meta[day] && meta[day].sig === rec.sig);
  if (ok) {
    rec.synced = true;
    saveAushangLocal(day, rec);
  }
  return ok;
}

let aushangPulling = false;
window.pullAushang = async function () {
  if (aushangPulling) return;
  aushangPulling = true;
  try {
    const meta = await getFromSheets('imagemeta');
    if (!meta) return;
    for (const day of Object.keys(AUSHANG_TAGE)) {
      if (!Object.prototype.hasOwnProperty.call(meta, day)) continue;
      const local = window.roshopImages[day];
      const remote = meta[day];
      if (local && local.synced === false) {
        await uploadAushangRecord(day, local);
        continue;
      }
      if (!remote || !remote.chunks) {
        if (local) saveAushangLocal(day, null);
        continue;
      }
      if (local && local.sig === remote.sig) continue;
      const res = await getFromSheets('image', { name: day });
      if (res && res.data) saveAushangLocal(day, { sig: res.sig || remote.sig, data: res.data, synced: true });
    }
    window.renderAushangImages();
  } finally {
    aushangPulling = false;
  }
};

function compressForAushang(img) {
  let scale = Math.min(1, 1600 / Math.max(img.width, img.height));
  let quality = 0.72;
  let out = '';
  for (let i = 0; i < 6; i++) {
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(img.width * scale));
    canvas.height = Math.max(1, Math.round(img.height * scale));
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    out = canvas.toDataURL('image/jpeg', quality);
    if (out.length <= 1100000) break;
    if (quality > 0.5) quality -= 0.1;
    else scale *= 0.85;
  }
  return out;
}

window.uploadRoshopImage = function (day, input) {
  const file = input.files && input.files[0];
  if (!file || !AUSHANG_TAGE[day]) return;
  const status = document.getElementById('uploadStatus' + capDay(day));
  const say = (t) => { if (status) status.innerText = t; };
  say('Bild wird verarbeitet...');
  const reader = new FileReader();
  reader.onerror = () => say('Die Datei konnte nicht gelesen werden.');
  reader.onload = () => {
    const img = new Image();
    img.onerror = () => say('Das ist kein lesbares Bild.');
    img.onload = async () => {
      const dataUrl = compressForAushang(img);
      const rec = { sig: hashString(dataUrl), data: dataUrl, synced: false };
      saveAushangLocal(day, rec);
      window.renderAushangImages();
      say('Wird hochgeladen...');
      const ok = await uploadAushangRecord(day, rec);
      say(ok
        ? '✓ Hochgeladen - jetzt für alle Geräte sichtbar.'
        : '⚠ Nur auf diesem Gerät gespeichert. Der Upload wird automatisch erneut versucht.');
      input.value = '';
    };
    img.src = reader.result;
  };
  reader.readAsDataURL(file);
};

// --- Vollbildansicht ---
window.openAushang = function (day) {
  const rec = window.roshopImages[day];
  if (!rec || !rec.data) return;
  window.openLightbox(rec.data, AUSHANG_TAGE[day] + ' - Teigspenden & Schichtplan');
};
window.closeLightbox = function () {
  const old = document.getElementById('lightboxOverlay');
  if (old) old.remove();
};
window.openLightbox = function (src, title) {
  window.closeLightbox();
  const overlay = document.createElement('div');
  overlay.id = 'lightboxOverlay';
  overlay.className = 'fixed inset-0 z-[60] bg-slate-950/95 flex flex-col';
  overlay.innerHTML =
    '<div class="flex items-center justify-between gap-3 px-4 py-3 text-white">' +
      '<div class="text-sm font-bold">' + escapeHtml(title || '') + '</div>' +
      '<button type="button" onclick="closeLightbox()" class="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 rounded-xl text-xs font-bold">✕ Schließen</button>' +
    '</div>' +
    '<div id="lightboxScroll" class="flex-1 overflow-auto px-2 pb-2"></div>' +
    '<div class="px-4 pb-3 text-center text-[11px] text-slate-400">Auf das Blatt tippen: vergrößern / verkleinern</div>';
  document.body.appendChild(overlay);
  const img = document.createElement('img');
  img.src = src;
  img.alt = title || '';
  img.className = 'mx-auto rounded-lg cursor-zoom-in bg-white';
  img.style.maxHeight = '82vh';
  img.style.width = 'auto';
  let zoomed = false;
  img.addEventListener('click', () => {
    zoomed = !zoomed;
    img.style.width = zoomed ? '200%' : 'auto';
    img.style.maxWidth = zoomed ? 'none' : '100%';
    img.style.maxHeight = zoomed ? 'none' : '82vh';
    img.className = 'mx-auto rounded-lg bg-white ' + (zoomed ? 'cursor-zoom-out' : 'cursor-zoom-in');
  });
  document.getElementById('lightboxScroll').appendChild(img);
};
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') window.closeLightbox();
});

// ------------------------------------------
// 8. START
// ------------------------------------------
function initApp() {
  window.initTheme();
  window.applyRolePermissions(window.currentUserRole);
  reconcileKasseEpoch();
  recomputeKasse();
  persistKasse();
  window.renderKasse();
  window.renderStatistik();
  window.renderInventar();
  window.renderAushangImages();
  setKasseBadge(localStorage.getItem('kasseDirty') || localStorage.getItem('kasseConfigDirty') ? 'pending' : 'loading');

  window.loadInventarFromGoogleSheets();
  window.pullAushang();
  if (window.currentUserRole !== 'gast') window.syncKasse();

  // Regelmaessiger Abgleich: Kasse/Statistik alle 8 s, sonst seltener
  let tick = 0;
  setInterval(() => {
    if (document.hidden) return;
    tick++;
    const view = window.currentView;
    const kasseView = view === 'verkauf' || view === 'kasse' || view === 'statistik';
    if (window.currentUserRole !== 'gast' && (kasseView || tick % 4 === 0)) window.syncKasse();
    if (view === 'aushang' && tick % 8 === 0) window.pullAushang();
  }, 8000);
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) return;
    window.pullAushang();
    if (window.currentUserRole !== 'gast') window.syncKasse();
  });
}
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initApp);
} else {
  initApp();
}
