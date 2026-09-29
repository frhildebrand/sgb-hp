// ==========================================================
// SG BARNSTORF WEIHNACHTSMARKT - MAIN ENGINE (Version 4)
// Prinzip: Alles wird zuerst lokal gespeichert und sofort
// angezeigt. Danach wird im Hintergrund mit Google Sheets
// synchronisiert.
// ==========================================================
const GOOGLE_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbz5_j65a248FUib9POAAWryFHFh6-613bhVpXUaBuTIpDEHx_kUOrOnh-NVhBduT8Ks/exec';

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

const KASSE_DAYS = ['samstag', 'sonntag'];
const KASSE_PRODUCTS = ['waffel', 'kinderpunsch'];
const KASSE_TYPES = ['paid', 'free'];
const DEFAULT_PRICE = 2.0;
const COUNT_KEYS = [];
KASSE_DAYS.forEach((d) => KASSE_PRODUCTS.forEach((p) => KASSE_TYPES.forEach((t) => COUNT_KEYS.push(d + '_' + p + '_' + t))));

// ------------------------------------------
// RECHTE: Standard-Matrix (Admin darf immer alles).
// Alle Pruefungen laufen ueber window.can(...). Spaeter kann eine Verwaltung im
// Admin-Panel die Eintraege in permOverrides ueberschreiben.
// ------------------------------------------
const ALL_ROLES = ['gast', 'helfer', 'orga', 'admin'];
const LOGGED_IN = ['helfer', 'orga', 'admin'];
const PERMISSION_DEFAULTS = {
  'view.aushang': ALL_ROLES,
  'view.login': ALL_ROLES,
  'view.inventar': LOGGED_IN,
  'view.verkauf': LOGGED_IN,
  'view.statistik': ['admin'],
  'view.einkaufsliste': LOGGED_IN,
  'view.verkabelung': LOGGED_IN,
  'view.lagerbestand': LOGGED_IN,
  'view.boxen': LOGGED_IN,
  'view.rezepte': LOGGED_IN,
  'view.admin': ['admin'],
  'inventar.update': LOGGED_IN,
  'inventar.edit': ['orga', 'admin'],
  'kasse.book': LOGGED_IN,
  'boxen.edit': ['orga', 'admin'],
  'finance.edit': ['admin'],
  'kasse.reset': ['admin']
};
const PERMISSION_LABELS = {
  'view.aushang': 'Aushang ansehen',
  'view.inventar': 'Inventar ansehen',
  'view.verkauf': 'Kasse ansehen',
  'view.statistik': 'Statistik ansehen',
  'view.einkaufsliste': 'Einkaufsliste ansehen',
  'view.verkabelung': 'Strom/Verkabelung ansehen',
  'view.lagerbestand': 'Lagerbestand ansehen',
  'view.boxen': 'Boxen ansehen',
  'view.rezepte': 'Rezepte ansehen',
  'view.admin': 'Admin-Panel',
  'inventar.update': 'Inventar: Status, Mengen, Namen eintragen',
  'inventar.edit': 'Inventar: Einträge & Kategorien bearbeiten',
  'kasse.book': 'Kasse: buchen',
  'boxen.edit': 'Boxen anlegen & bearbeiten',
  'finance.edit': 'Preise, Standgebühr, Ausgaben, Spendenente',
  'kasse.reset': 'Kasse: Tag zurücksetzen'
};
window.can = function (perm, role) {
  role = role || window.currentUserRole;
  if (role === 'admin') return true;
  const overrides = lsGet('permOverrides', {});
  const allowed = overrides[perm] || PERMISSION_DEFAULTS[perm] || [];
  return allowed.indexOf(role) >= 0;
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

function newId(prefix) {
  return (prefix || 'n') + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

// Inventar: Kategorien und Eintraege haben feste IDs (gleiche Regeln wie im Google Script)
function withInventarIds(state) {
  const usedCats = {};
  state.forEach((cat, ci) => {
    if (!cat.id || usedCats[cat.id]) cat.id = 'c' + ci;
    while (usedCats[cat.id]) cat.id += 'x';
    usedCats[cat.id] = true;
  });
  state.forEach((cat, ci) => {
    const seen = {};
    cat.items.forEach((it, ii) => {
      if (!it.id || seen[it.id]) it.id = 'i' + ci + '_' + ii;
      while (seen[it.id]) it.id += 'x';
      seen[it.id] = true;
    });
  });
  return state;
}
function hasInventarIds(state) {
  return Array.isArray(state) && state.length > 0 &&
    state.every((c) => c && c.id && Array.isArray(c.items) && c.items.every((i) => i && i.id));
}
window.inventarData = lsGet('inventarData', null);
if (!hasInventarIds(window.inventarData)) {
  window.inventarData = withInventarIds(clone(window.inventarCategories || []));
}
let invPending = lsGet('invPending', []);

// Kasse: jedes Geraet fuehrt eigene Zaehler, angezeigt wird die Summe aller Geraete.
function pickCounts(src) {
  const c = {};
  COUNT_KEYS.forEach((k) => { c[k] = Math.max(0, parseInt(src && src[k], 10) || 0); });
  return c;
}
function defaultKasseConfig() {
  return {
    epochs: { samstag: 0, sonntag: 0 },
    prices: { waffel: DEFAULT_PRICE, kinderpunsch: DEFAULT_PRICE },
    standgebuehr: 0,
    spende: { samstag: 0, sonntag: 0 },
    ts: 0
  };
}
function normalizeKasseConfig(src) {
  const cfg = defaultKasseConfig();
  const num = (v, fb) => { const n = Number(v); return isFinite(n) ? n : fb; };
  KASSE_DAYS.forEach((d) => {
    cfg.epochs[d] = num(src && src.epochs && src.epochs[d], 0);
    cfg.spende[d] = Math.max(0, num(src && src.spende && src.spende[d], 0));
  });
  KASSE_PRODUCTS.forEach((p) => { cfg.prices[p] = Math.max(0, num(src && src.prices && src.prices[p], DEFAULT_PRICE)); });
  cfg.standgebuehr = Math.max(0, num(src && src.standgebuehr, 0));
  cfg.ts = num(src && src.ts, 0);
  return cfg;
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
let kasseServerCfg = normalizeKasseConfig(lsGet('kasse3Cfg', null));
let kassePatch = lsGet('kasse3Patch', {});
let kassePatchInflight = {};
let kasseMine = lsGet('kasse3Mine', null) || { epochs: { samstag: 0, sonntag: 0 }, counts: {} };
kasseMine.counts = pickCounts(kasseMine.counts);
kasseMine.epochs = Object.assign({ samstag: 0, sonntag: 0 }, kasseMine.epochs);
let kasseOthers = lsGet('kasse3Others', {});
let kasseMineVer = parseInt(localStorage.getItem('kasse3Ver'), 10) || 0;
let kasseSentVer = parseInt(localStorage.getItem('kasse3Sent'), 10) || 0;
window.kasseCfg = defaultKasseConfig();
window.kasseTotals = {};
window.kasseDay = localStorage.getItem('kasseDay') === 'sonntag' || localStorage.getItem('kasseDay') === 'samstag'
  ? localStorage.getItem('kasseDay')
  : (new Date().getDay() === 0 ? 'sonntag' : 'samstag');

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
  if (viewName === 'kasse') viewName = 'verkauf';
  const targetId = VIEW_IDS[viewName];
  if (!targetId) return;
  if (!window.can('view.' + viewName)) {
    alert(window.currentUserRole === 'gast'
      ? 'Bitte melde dich an, um auf diesen Bereich zuzugreifen.'
      : 'Für diesen Bereich fehlt dir die Berechtigung.');
    return;
  }
  document.querySelectorAll('main > div[id^="view"]').forEach((v) => v.classList.add('hidden'));
  const target = document.getElementById(targetId);
  if (target) target.classList.remove('hidden');
  window.currentView = viewName;

  if (viewName === 'aushang') {
    window.renderAushangImages();
    window.pullAushang();
  } else if (viewName === 'inventar') {
    window.renderInventar();
    window.syncInventar();
  } else if (viewName === 'verkauf') {
    window.renderKasse();
    window.syncKasse();
  } else if (viewName === 'statistik') {
    window.renderStatistik();
    window.syncKasse();
    expenseStore.sync();
  } else if (viewName === 'einkaufsliste') {
    renderEinkaufsliste();
    window.syncInventar();
  } else if (viewName === 'lagerbestand') {
    renderLagerbestand();
    window.syncInventar();
  } else if (viewName === 'boxen') {
    renderBoxen();
    window.syncInventar();
    boxStore.sync();
  } else if (viewName === 'verkabelung') {
    renderVerkabelung();
    window.syncInventar();
  } else if (viewName === 'rezepte') {
    window.updatePunschRecipe();
  } else if (viewName === 'admin') {
    renderAdmin();
    window.syncKasse();
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
  if (role !== 'gast') {
    window.syncKasse();
    window.syncInventar();
  }
};
function applyNavPermissions() {
  document.querySelectorAll('#navigationModal nav button').forEach((btn) => {
    const m = /switchView\('([a-z]+)'\)/.exec(btn.getAttribute('onclick') || '');
    if (m) btn.classList.toggle('hidden', !window.can('view.' + (m[1] === 'kasse' ? 'verkauf' : m[1])));
  });
}
window.applyRolePermissions = function (role) {
  window.currentUserRole = role;
  const isLoggedIn = role !== 'gast';

  const labels = { admin: '🟢 ADMIN', orga: '🔵 ORGA', helfer: '🟡 HELFER', gast: 'GAST' };
  setText('roleLabel', labels[role] || 'GAST');
  setText('roleIcon', isLoggedIn ? '🔓' : '👁️');

  const burgerBtn = document.getElementById('burgerMenuBtn');
  if (burgerBtn) burgerBtn.classList.toggle('hidden', !isLoggedIn);
  const guestNotice = document.getElementById('guestLockNotice');
  if (guestNotice) guestNotice.classList.toggle('hidden', isLoggedIn);

  const canEdit = window.can('inventar.edit');
  const editBtn = document.getElementById('adminInventarEditBtn');
  if (editBtn) editBtn.classList.toggle('hidden', !canEdit);
  if (!canEdit) window.isEditMode = false;
  const addBoxBtn = document.getElementById('addBoxBtn');
  if (addBoxBtn) addBoxBtn.classList.toggle('hidden', !window.can('boxen.edit'));

  applyNavPermissions();
  window.switchView('aushang');
};

// ------------------------------------------
// 4. KASSE & STATISTIK (lokal zuerst, Abgleich ueber Google Sheets)
// Jedes Geraet bucht auf eigene Zaehler (je Tag/Produkt/bezahlt|Helfer). Angezeigt
// wird die Summe aller Geraete, deshalb geht bei gleichzeitigem Verkauf nichts verloren.
// "Tag zuruecksetzen" erhoeht die gemeinsame Schicht-Nummer (epoch) dieses Tages;
// Zaehler mit alter Nummer werden auf allen Geraeten ignoriert.
// ------------------------------------------
let kasseSyncTimer = null;
let kasseSyncing = false;
let kasseResync = false;

// --- Einstellungen: Server-Stand + noch nicht gesendete Aenderungen ---
function mergePatch(cfg, patch) {
  if (!patch) return cfg;
  KASSE_PRODUCTS.forEach((p) => { if (patch.prices && patch.prices[p] !== undefined) cfg.prices[p] = patch.prices[p]; });
  KASSE_DAYS.forEach((d) => {
    if (patch.spende && patch.spende[d] !== undefined) cfg.spende[d] = patch.spende[d];
    if (patch.epochs && patch.epochs[d] !== undefined) cfg.epochs[d] = Math.max(cfg.epochs[d], patch.epochs[d]);
  });
  if (patch.standgebuehr !== undefined) cfg.standgebuehr = patch.standgebuehr;
  return cfg;
}
function accumulatePatch(older, newer) {
  const out = clone(older || {});
  ['prices', 'spende', 'epochs'].forEach((g) => {
    if (!newer || !newer[g]) return;
    out[g] = out[g] || {};
    Object.keys(newer[g]).forEach((k) => {
      out[g][k] = g === 'epochs' && out[g][k] !== undefined ? Math.max(out[g][k], newer[g][k]) : newer[g][k];
    });
  });
  if (newer && newer.standgebuehr !== undefined) out.standgebuehr = newer.standgebuehr;
  return out;
}
function currentKasseCfg() {
  return mergePatch(mergePatch(clone(kasseServerCfg), kassePatchInflight), kassePatch);
}
function persistKasse() {
  lsSet('kasse3Mine', kasseMine);
  lsSet('kasse3Cfg', kasseServerCfg);
  lsSet('kasse3Patch', kassePatch);
  lsSet('kasse3Others', kasseOthers);
  localStorage.setItem('kasse3Ver', String(kasseMineVer));
  localStorage.setItem('kasse3Sent', String(kasseSentVer));
}
function bumpMine() {
  kasseMineVer++;
}
function reconcileKasseEpochs() {
  const cfg = currentKasseCfg();
  KASSE_DAYS.forEach((d) => {
    if ((kasseMine.epochs[d] || 0) < cfg.epochs[d]) {
      kasseMine.epochs[d] = cfg.epochs[d];
      KASSE_PRODUCTS.forEach((p) => KASSE_TYPES.forEach((t) => { kasseMine.counts[d + '_' + p + '_' + t] = 0; }));
      bumpMine();
    }
  });
}
function recomputeKasse() {
  const cfg = currentKasseCfg();
  window.kasseCfg = cfg;
  const totals = {};
  KASSE_DAYS.forEach((d) => {
    totals[d] = {};
    KASSE_PRODUCTS.forEach((p) => {
      totals[d][p] = {};
      KASSE_TYPES.forEach((t) => {
        const key = d + '_' + p + '_' + t;
        let sum = kasseMine.epochs[d] === cfg.epochs[d] ? kasseMine.counts[key] : 0;
        Object.keys(kasseOthers).forEach((id) => {
          const o = kasseOthers[id];
          if (id === DEVICE_ID || !o || !o.epochs || o.epochs[d] !== cfg.epochs[d]) return;
          sum += Math.max(0, parseInt(o.data && o.data[key], 10) || 0);
        });
        totals[d][p][t] = sum;
      });
    });
  });
  window.kasseTotals = totals;
}
const round2 = (x) => Math.round(x * 100) / 100;
window.getFinance = function () {
  const cfg = window.kasseCfg;
  const t = window.kasseTotals;
  const days = {};
  let revenue = 0;
  KASSE_DAYS.forEach((d) => {
    const sales = round2(KASSE_PRODUCTS.reduce((s, p) => s + t[d][p].paid * cfg.prices[p], 0));
    const spende = cfg.spende[d] || 0;
    days[d] = { sales: sales, spende: spende, total: round2(sales + spende) };
    revenue += days[d].total;
  });
  const expenses = round2(expenseStore.items().reduce((s, e) => s + e.amount, 0));
  revenue = round2(revenue);
  return {
    days: days,
    revenue: revenue,
    standgebuehr: cfg.standgebuehr,
    expenses: expenses,
    profit: round2(revenue - cfg.standgebuehr - expenses)
  };
};

// --- Anzeige "Synchronisiert" ---
function setKasseBadge(state) {
  const styles = {
    loading: ['bg-slate-500/10 text-slate-500 dark:text-slate-300 border-slate-500/30', 'bg-slate-400 animate-pulse', 'Verbinde...'],
    pending: ['bg-sky-500/10 text-sky-600 dark:text-sky-400 border-sky-500/30', 'bg-sky-500 animate-pulse', 'Wird gesendet...'],
    synced: ['bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30', 'bg-emerald-500 animate-pulse', 'Synchronisiert'],
    offline: ['bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30', 'bg-amber-500', 'Offline - lokal gespeichert']
  };
  const s = styles[state] || styles.offline;
  ['kasseSyncBadge', 'statSyncBadge'].forEach((id) => {
    const badge = document.getElementById(id);
    if (!badge) return;
    badge.className = 'text-xs px-3 py-1 rounded-full font-bold border flex items-center gap-1.5 ' + s[0];
    badge.innerHTML = '<span class="w-2.5 h-2.5 rounded-full ' + s[1] + '"></span> ' + s[2];
  });
}

// --- Abgleich ---
window.syncKasse = async function () {
  if (kasseSyncing) {
    kasseResync = true;
    return;
  }
  kasseSyncing = true;
  try {
    if (Object.keys(kassePatch).length) {
      const sent = kassePatch;
      kassePatchInflight = sent;
      kassePatch = {};
      persistKasse();
      const r = await postToSheets({ action: 'kasseConfig', patch: sent });
      kassePatchInflight = {};
      if (!r.ok) {
        kassePatch = accumulatePatch(sent, kassePatch);
        persistKasse();
        return setKasseBadge('offline');
      }
    }
    if (kasseMineVer !== kasseSentVer) {
      const version = kasseMineVer;
      const r = await postToSheets({ action: 'kasse', device: DEVICE_ID, epochs: kasseMine.epochs, data: kasseMine.counts });
      if (!r.ok) return setKasseBadge('offline');
      kasseSentVer = version;
      persistKasse();
    }
    const data = await getFromSheets('kasse');
    if (!data || !data.config) return setKasseBadge('offline');
    kasseServerCfg = normalizeKasseConfig(data.config);
    kasseOthers = {};
    Object.keys(data.devices || {}).forEach((id) => {
      if (id !== DEVICE_ID) kasseOthers[id] = data.devices[id];
    });
    reconcileKasseEpochs();
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

// --- Buchen ---
window.setKasseDay = function (day) {
  if (KASSE_DAYS.indexOf(day) < 0) return;
  window.kasseDay = day;
  localStorage.setItem('kasseDay', day);
  window.renderKasse();
};
window.changeKasseCount = function (item, type, delta) {
  if (!window.can('kasse.book')) return;
  const day = window.kasseDay;
  const key = day + '_' + item + '_' + (type === 'paid' ? 'paid' : 'free');
  if (COUNT_KEYS.indexOf(key) < 0) return;
  reconcileKasseEpochs();
  if (delta < 0 && kasseMine.counts[key] === 0) {
    alert('Auf diesem Gerät wurde hier nichts gebucht. Korrigieren kann man nur am Gerät, das die Buchung erfasst hat.');
    return;
  }
  kasseMine.counts[key] = Math.max(0, kasseMine.counts[key] + delta);
  bumpMine();
  persistKasse();
  recomputeKasse();
  window.renderKasse();
  scheduleKasseSync();
};

// --- Einstellungen aendern (Admin) ---
function parseEuro(text) {
  const n = parseFloat(String(text).replace(/[€\s]/g, '').replace(',', '.'));
  return isNaN(n) || n < 0 || n > 1000000 ? null : round2(n);
}
function euroInputValue(n) {
  return (Number(n) || 0).toFixed(2).replace('.', ',');
}
function applyKassePatch(patch) {
  kassePatch = accumulatePatch(kassePatch, patch);
  reconcileKasseEpochs();
  persistKasse();
  recomputeKasse();
  window.renderKasse();
  window.renderStatistik();
  scheduleKasseSync();
}
window.updatePricesFromAdmin = function () {
  if (!window.can('finance.edit')) return;
  const waffel = parseEuro((document.getElementById('adminPriceWaffel') || {}).value);
  const punsch = parseEuro((document.getElementById('adminPricePunsch') || {}).value);
  const prices = {};
  if (waffel !== null) prices.waffel = waffel;
  if (punsch !== null) prices.kinderpunsch = punsch;
  if (Object.keys(prices).length) applyKassePatch({ prices: prices });
  renderAdmin();
};
window.saveSpende = function (day, value) {
  if (!window.can('finance.edit') || KASSE_DAYS.indexOf(day) < 0) return;
  const n = parseEuro(value);
  if (n !== null) {
    const spende = {};
    spende[day] = n;
    applyKassePatch({ spende: spende });
  }
  window.renderStatistik(true);
};
window.saveStandgebuehr = function (value) {
  if (!window.can('finance.edit')) return;
  const n = parseEuro(value);
  if (n !== null) applyKassePatch({ standgebuehr: n });
  window.renderStatistik(true);
};
window.resetKasseDay = function (day) {
  if (!window.can('kasse.reset') || KASSE_DAYS.indexOf(day) < 0) return;
  const name = day === 'samstag' ? 'Samstag' : 'Sonntag';
  if (!confirm('Die Zähler (verkauft und Helfer) für ' + name + ' werden auf ALLEN Geräten auf 0 gesetzt. Spendenente, Ausgaben und Standgebühr bleiben. Fortfahren?')) return;
  const epochs = {};
  epochs[day] = Math.max(Date.now(), currentKasseCfg().epochs[day] + 1);
  applyKassePatch({ epochs: epochs });
};

// --- Ausgaben (Liste im Sheet) ---
window.addExpense = function () {
  if (!window.can('finance.edit')) return;
  const amountInput = document.getElementById('expenseAmountInput');
  const noteInput = document.getElementById('expenseNoteInput');
  const amount = parseEuro(amountInput ? amountInput.value : '');
  if (amount === null || amount <= 0) {
    alert('Bitte einen Betrag über 0 eintragen, z. B. 12,50.');
    return;
  }
  expenseStore.apply({
    op: 'save',
    item: { id: newId('e'), amount: amount, note: ((noteInput && noteInput.value) || '').trim().slice(0, 120), ts: Date.now() }
  });
  if (amountInput) amountInput.value = '';
  if (noteInput) noteInput.value = '';
  window.renderStatistik(true);
};
window.deleteExpense = function (id) {
  if (!window.can('finance.edit')) return;
  const item = expenseStore.items().find((e) => e.id === id);
  if (!item || !confirm('Ausgabe "' + (item.note || 'ohne Zweck') + '" (' + formatEuro(item.amount) + ') löschen?')) return;
  expenseStore.apply({ op: 'del', id: id });
  window.renderStatistik(true);
};

// --- Darstellung: Kasse ---
window.renderKasse = function () {
  const day = window.kasseDay;
  const totals = window.kasseTotals[day];
  const cfg = window.kasseCfg;
  if (!totals) return;
  setText('countWaffelPaid', totals.waffel.paid);
  setText('countWaffelFree', totals.waffel.free);
  setText('countKinderpunschPaid', totals.kinderpunsch.paid);
  setText('countKinderpunschFree', totals.kinderpunsch.free);
  setText('displayWaffelPrice', formatEuro(cfg.prices.waffel) + ' / Stück');
  setText('displayKinderpunschPrice', formatEuro(cfg.prices.kinderpunsch) + ' / Becher');
  const active = 'py-3 rounded-xl text-sm font-black bg-amber-500 text-slate-950 shadow transition';
  const inactive = 'py-3 rounded-xl text-sm font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-300/60 dark:hover:bg-slate-800 transition';
  KASSE_DAYS.forEach((d) => {
    const tab = document.getElementById('kasseDayTab' + capDay(d));
    if (tab) tab.className = d === day ? active : inactive;
  });
  const statBtn = document.getElementById('kasseStatistikBtn');
  if (statBtn) statBtn.classList.toggle('hidden', !window.can('view.statistik'));
};

// --- Darstellung: Statistik ---
window.renderStatistik = function (force) {
  const f = window.getFinance();
  const t = window.kasseTotals;
  const editable = window.can('finance.edit');
  const setInput = (id, value) => {
    const el = document.getElementById(id);
    if (!el) return;
    el.disabled = !editable;
    if (force || document.activeElement !== el) el.value = value;
  };
  KASSE_DAYS.forEach((d) => {
    const cap = capDay(d);
    const c = window.kasseCfg;
    setText('statWaffel' + cap, t[d].waffel.paid + ' Stk. (' + formatEuro(t[d].waffel.paid * c.prices.waffel) + ')');
    setText('statPunsch' + cap, t[d].kinderpunsch.paid + ' Stk. (' + formatEuro(t[d].kinderpunsch.paid * c.prices.kinderpunsch) + ')');
    setText('statHelfer' + cap, t[d].kinderpunsch.free + ' / ' + t[d].waffel.free);
    setText('statSales' + cap, formatEuro(f.days[d].sales));
    setInput('statSpende' + cap, euroInputValue(f.days[d].spende));
    setText('statDayTotal' + cap, formatEuro(f.days[d].total));
  });
  setText('statTotalRevenue', formatEuro(f.revenue));
  setInput('statStandgebuehrInput', euroInputValue(f.standgebuehr));
  setText('statExpensesTotal', formatEuro(f.expenses));
  const profitEl = document.getElementById('statProfit');
  if (profitEl) {
    profitEl.innerText = formatEuro(f.profit);
    profitEl.className = 'text-3xl font-black ' + (f.profit >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400');
  }
  ['expenseAmountInput', 'expenseNoteInput'].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.disabled = !editable;
  });
  const list = document.getElementById('expenseList');
  if (list) {
    const items = expenseStore.items().slice().sort((a, b) => (a.ts || 0) - (b.ts || 0));
    list.innerHTML = items.length === 0
      ? '<div class="text-xs text-slate-500 dark:text-slate-400 py-2">Noch keine Ausgaben eingetragen.</div>'
      : items.map((e) => `<div class="flex items-center justify-between gap-3 py-2 border-b border-slate-100 dark:border-slate-800/60 text-xs">
          <span class="text-slate-800 dark:text-slate-100 font-semibold">${escapeHtml(e.note || 'ohne Verwendungszweck')}</span>
          <span class="flex items-center gap-2">
            <span class="font-black text-rose-600 dark:text-rose-400">- ${formatEuro(e.amount)}</span>
            ${editable ? `<button onclick="deleteExpense('${escapeHtml(e.id)}')" title="Löschen" class="px-2 py-1 bg-rose-500/10 text-rose-500 border border-rose-500/30 rounded-lg font-bold">🗑️</button>` : ''}
          </span>
        </div>`).join('');
  }
};

// ------------------------------------------
// LISTEN im Sheet (Ausgaben, Boxen): jede Aenderung wird einzeln gesendet
// ------------------------------------------
function createListStore(name, onChange) {
  const key = 'list3_' + name;
  const saved = lsGet(key, null) || {};
  let base = Array.isArray(saved.base) ? saved.base : [];
  let pending = Array.isArray(saved.pending) ? saved.pending : [];
  let syncing = false;
  let resync = false;
  let timer = null;

  function persist() {
    lsSet(key, { base: base, pending: pending });
  }
  function applyOps(list, ops) {
    let out = list.slice();
    ops.forEach((op) => {
      if (op.op === 'save' && op.item) {
        const i = out.findIndex((x) => x.id === op.item.id);
        if (i >= 0) out[i] = op.item;
        else out.push(op.item);
      } else if (op.op === 'del') {
        out = out.filter((x) => x.id !== op.id);
      }
    });
    return out;
  }
  const store = {
    items() {
      return applyOps(base, pending);
    },
    apply(op) {
      pending.push(op);
      persist();
      clearTimeout(timer);
      timer = setTimeout(() => store.sync(), 600);
    },
    async sync() {
      if (syncing) {
        resync = true;
        return;
      }
      syncing = true;
      try {
        if (pending.length) {
          const sent = pending.slice();
          const r = await postToSheets({ action: 'listOps', list: name, ops: sent });
          if (!r.ok) return;
          pending = pending.slice(sent.length);
          persist();
        }
        const res = await getFromSheets('list', { name: name });
        if (res && Array.isArray(res.items)) {
          base = res.items;
          persist();
          if (onChange) onChange();
        }
      } finally {
        syncing = false;
        if (resync) {
          resync = false;
          store.sync();
        }
      }
    }
  };
  return store;
}
const expenseStore = createListStore('expenses', () => window.renderStatistik());
const boxStore = createListStore('boxes', () => { if (window.currentView === 'boxen') renderBoxen(); });

// ------------------------------------------
// 5. INVENTAR: lokal zuerst, Aenderungen werden einzeln an Google Sheets gesendet
// Jede Aenderung ist eine kleine Operation (Feld setzen, Eintrag hinzufuegen ...).
// Der Server wendet sie nacheinander auf den gemeinsamen Stand an. So ueberschreiben
// sich mehrere Personen nicht mehr gegenseitig.
// ------------------------------------------
const INV_FIELDS = ['name', 'sub', 'bedarf', 'lager', 'status', 'wer', 'verantwortlich', 'empfaenger', 'pack', 'box'];

function invCleanField(field, v) {
  if (field === 'bedarf' || field === 'lager') return Math.max(0, Math.floor(Number(v)) || 0);
  if (field === 'pack') return v === true || v === 'true';
  return String(v === undefined || v === null ? '' : v).slice(0, 200);
}
function invCleanItem(it) {
  const out = { id: String(it.id).slice(0, 40) };
  INV_FIELDS.forEach((f) => { if (it[f] !== undefined) out[f] = invCleanField(f, it[f]); });
  if (out.bedarf === undefined) out.bedarf = 1;
  if (out.lager === undefined) out.lager = 0;
  if (!out.status) out.status = 'Offen';
  if (!out.name) out.name = 'Neu';
  return out;
}
function invMove(list, from, to) {
  if (from < 0) return;
  const target = Math.max(0, Math.min(list.length - 1, Math.floor(Number(to)) || 0));
  const moved = list.splice(from, 1)[0];
  list.splice(target, 0, moved);
}
function invApplyOp(state, op) {
  const ci = op.c ? state.findIndex((c) => c.id === op.c) : -1;
  const cat = ci >= 0 ? state[ci] : null;
  switch (op.op) {
    case 'set': {
      if (!cat || INV_FIELDS.indexOf(op.f) < 0) return;
      const item = cat.items.find((i) => i.id === op.i);
      if (item) item[op.f] = invCleanField(op.f, op.v);
      return;
    }
    case 'addItem':
      if (cat && op.item && op.item.id && !cat.items.some((i) => i.id === op.item.id)) cat.items.push(invCleanItem(op.item));
      return;
    case 'delItem':
      if (cat) cat.items = cat.items.filter((i) => i.id !== op.i);
      return;
    case 'moveItem':
      if (cat) invMove(cat.items, cat.items.findIndex((i) => i.id === op.i), op.to);
      return;
    case 'addCat':
      if (op.cat && op.cat.id && !state.some((c) => c.id === op.cat.id)) {
        state.push({ id: String(op.cat.id).slice(0, 40), title: String(op.cat.title || '').slice(0, 80) || 'Neue Kategorie', items: [] });
      }
      return;
    case 'renameCat':
      if (cat && String(op.v || '').slice(0, 80)) cat.title = String(op.v).slice(0, 80);
      return;
    case 'setStatuses':
      if (!cat) return;
      if (Array.isArray(op.v) && op.v.length) cat.statuses = op.v.slice(0, 12).map((s) => String(s).slice(0, 30));
      else delete cat.statuses;
      return;
    case 'delCat':
      if (ci >= 0) state.splice(ci, 1);
      return;
    case 'moveCat':
      invMove(state, ci, op.to);
      return;
    case 'replaceAll':
      if (Array.isArray(op.data) && op.data.length && op.data.every((c) => c && Array.isArray(c.items))) {
        state.length = 0;
        withInventarIds(clone(op.data)).forEach((c) => state.push(c));
      }
      return;
  }
}

let invSyncTimer = null;
let invSyncing = false;
let invResync = false;

function isTypingInInventar() {
  const a = document.activeElement;
  return !!(a && ['INPUT', 'SELECT', 'TEXTAREA'].indexOf(a.tagName) >= 0 && a.type !== 'checkbox' && a.closest && a.closest('#viewInventar'));
}
function refreshCurrentView(force) {
  const v = window.currentView;
  if (v === 'inventar') {
    if (force || !isTypingInInventar()) window.renderInventar();
  } else if (v === 'einkaufsliste') renderEinkaufsliste();
  else if (v === 'lagerbestand') renderLagerbestand();
  else if (v === 'verkabelung') renderVerkabelung();
  else if (v === 'boxen') renderBoxen();
}
function invCommit(ops) {
  ops.forEach((op) => {
    invApplyOp(window.inventarData, op);
    invPending.push(op);
  });
  lsSet('inventarData', window.inventarData);
  lsSet('invPending', invPending);
  refreshCurrentView(true);
  clearTimeout(invSyncTimer);
  invSyncTimer = setTimeout(() => window.syncInventar(), 800);
}
window.syncInventar = async function () {
  if (invSyncing) {
    invResync = true;
    return;
  }
  invSyncing = true;
  try {
    let server = await getFromSheets('inventar');
    if (!server) return;
    if (!server.state) {
      // Erster Start: der lokale Stand wird zur gemeinsamen Grundlage
      const count = invPending.length;
      const r = await postToSheets({ action: 'inventarSeed', data: window.inventarData });
      if (!r.ok) return;
      invPending = invPending.slice(count);
      lsSet('invPending', invPending);
      return;
    }
    if (invPending.length) {
      const sent = invPending.slice();
      const r = await postToSheets({ action: 'inventarOps', ops: sent });
      if (!r.ok) return;
      invPending = invPending.slice(sent.length);
      lsSet('invPending', invPending);
      server = await getFromSheets('inventar');
      if (!server || !server.state) return;
    }
    const merged = clone(server.state);
    invPending.forEach((op) => invApplyOp(merged, op));
    window.inventarData = merged;
    lsSet('inventarData', merged);
    refreshCurrentView(false);
  } finally {
    invSyncing = false;
    if (invResync) {
      invResync = false;
      window.syncInventar();
    }
  }
};
window.loadInventarFromGoogleSheets = () => window.syncInventar();

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
  if (!window.can('inventar.edit')) {
    alert('Für den Bearbeitungsmodus fehlt dir die Berechtigung.');
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
  if (!window.can('inventar.update')) return;
  const cat = window.inventarData[catIdx];
  const item = cat && cat.items[itemIdx];
  if (!item) return;
  const ops = [{ op: 'set', c: cat.id, i: item.id, f: field, v: val }];
  if (field === 'wer' && item.verantwortlich) ops.push({ op: 'set', c: cat.id, i: item.id, f: 'verantwortlich', v: val });
  invCommit(ops);
};
window.addCategory = function () {
  if (!window.can('inventar.edit')) return;
  const name = prompt('Name der neuen Kategorie (z.B. 🍿 SNACKS):');
  if (!name || !name.trim()) return;
  invCommit([{ op: 'addCat', cat: { id: newId('c'), title: name.trim() } }]);
};
window.renameCategory = function (catIdx) {
  if (!window.can('inventar.edit')) return;
  const cat = window.inventarData[catIdx];
  if (!cat) return;
  const name = prompt('Kategoriename ändern:', cat.title);
  if (name && name.trim()) invCommit([{ op: 'renameCat', c: cat.id, v: name.trim() }]);
};
window.deleteCategory = function (catIdx) {
  if (!window.can('inventar.edit')) return;
  const cat = window.inventarData[catIdx];
  if (!cat) return;
  if (confirm(`Möchtest du die Kategorie "${cat.title}" inklusive aller ${cat.items.length} Einträge wirklich löschen?`)) {
    invCommit([{ op: 'delCat', c: cat.id }]);
  }
};
window.moveCategory = function (catIdx, direction) {
  if (!window.can('inventar.edit')) return;
  const cat = window.inventarData[catIdx];
  const to = catIdx + direction;
  if (!cat || to < 0 || to >= window.inventarData.length) return;
  invCommit([{ op: 'moveCat', c: cat.id, to: to }]);
};
window.editCategoryStatuses = function (catIdx) {
  if (!window.can('inventar.edit')) return;
  const cat = window.inventarData[catIdx];
  if (!cat) return;
  const input = prompt(
    `Verfügbare Status-Optionen für "${cat.title}" festlegen (kommagetrennt):\n\nBeispiel: Offen, Vorbereitet, Verteilt, Eingekauft, Erledigt`,
    window.getCategoryStatuses(cat).join(', ')
  );
  if (input === null) return;
  const list = input.split(',').map((s) => s.trim()).filter(Boolean);
  invCommit([{ op: 'setStatuses', c: cat.id, v: list.length ? list : null }]);
};
window.addItem = function (catIdx) {
  if (!window.can('inventar.edit')) return;
  const cat = window.inventarData[catIdx];
  if (!cat) return;
  const name = prompt('Name des neuen Gegenstands:');
  if (!name || !name.trim()) return;
  invCommit([{ op: 'addItem', c: cat.id, item: { id: newId('i'), name: name.trim(), sub: '', bedarf: 1, lager: 0, status: 'Offen', wer: '', pack: false, box: '' } }]);
};
window.deleteItem = function (catIdx, itemIdx) {
  if (!window.can('inventar.edit')) return;
  const cat = window.inventarData[catIdx];
  const item = cat && cat.items[itemIdx];
  if (!item) return;
  if (confirm(`Eintrag "${item.name}" wirklich löschen?`)) invCommit([{ op: 'delItem', c: cat.id, i: item.id }]);
};
window.moveItem = function (catIdx, itemIdx, direction) {
  if (!window.can('inventar.edit')) return;
  const cat = window.inventarData[catIdx];
  const item = cat && cat.items[itemIdx];
  const to = itemIdx + direction;
  if (!item || to < 0 || to >= cat.items.length) return;
  invCommit([{ op: 'moveItem', c: cat.id, i: item.id, to: to }]);
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

  const readonly = !window.can('inventar.update');
  const edit = window.isEditMode && window.can('inventar.edit');
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

// --- Boxen (Liste im Sheet) ---
function normBox(name) {
  return String(name || '').trim().toLowerCase();
}
function renderBoxen() {
  const grid = document.getElementById('boxOverviewGrid');
  if (!grid) return;
  const canEdit = window.can('boxen.edit');
  const boxes = boxStore.items().map((d) => ({ id: d.id, name: d.name, desc: d.desc, items: [] }));
  const unknown = {};
  window.inventarData.forEach((cat) => {
    cat.items.forEach((item) => {
      const key = normBox(item.box);
      if (!key) return;
      let target = boxes.find((b) => normBox(b.name) === key);
      if (!target) target = unknown[key] || (unknown[key] = { id: null, name: String(item.box).trim(), desc: '', items: [] });
      target.items.push(item.name);
    });
  });
  const all = boxes.concat(Object.keys(unknown).map((k) => unknown[k]));
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
  if (!window.can('boxen.edit')) return;
  const def = boxStore.items().find((d) => d.id === id);
  document.getElementById('boxModalId').value = def ? def.id : '';
  document.getElementById('boxModalName').value = def ? def.name : '';
  document.getElementById('boxModalDesc').value = def ? def.desc : '';
  setText('boxModalTitle', def ? '📦 Box bearbeiten' : '📦 Neue Box');
  window.openModal('boxEditModal');
};
window.saveBoxFromModal = function () {
  if (!window.can('boxen.edit')) return;
  const id = document.getElementById('boxModalId').value;
  const name = document.getElementById('boxModalName').value.trim();
  const desc = document.getElementById('boxModalDesc').value.trim();
  if (!name) {
    alert('Bitte einen Namen eingeben.');
    return;
  }
  boxStore.apply({ op: 'save', item: { id: id || newId('b'), name: name.slice(0, 60), desc: desc.slice(0, 120) } });
  window.closeModal('boxEditModal');
  renderBoxen();
};
window.deleteBox = function (id) {
  if (!window.can('boxen.edit')) return;
  if (!confirm('Diese Box wirklich löschen?')) return;
  boxStore.apply({ op: 'del', id: id });
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
  const cfg = window.kasseCfg;
  const waffel = document.getElementById('adminPriceWaffel');
  const punsch = document.getElementById('adminPricePunsch');
  if (waffel && document.activeElement !== waffel) waffel.value = cfg.prices.waffel;
  if (punsch && document.activeElement !== punsch) punsch.value = cfg.prices.kinderpunsch;

  const grid = document.getElementById('adminPermissionsGrid');
  if (grid) {
    const roles = [['gast', 'Gast'], ['helfer', 'Helfer'], ['orga', 'Orga'], ['admin', 'Admin']];
    const rows = Object.keys(PERMISSION_LABELS).map((perm) => `<tr class="border-t border-slate-200 dark:border-slate-800">
        <td class="py-1.5 pr-3 text-slate-700 dark:text-slate-200">${escapeHtml(PERMISSION_LABELS[perm])}</td>
        ${roles.map((r) => `<td class="py-1.5 px-2 text-center ${window.can(perm, r[0]) ? 'text-emerald-600 dark:text-emerald-400 font-black' : 'text-slate-300 dark:text-slate-600'}">${window.can(perm, r[0]) ? '✓' : '–'}</td>`).join('')}
      </tr>`).join('');
    grid.innerHTML = `<div class="text-xs bg-slate-50 dark:bg-slate-950 p-4 rounded-xl border border-slate-200 dark:border-slate-800">
      <h4 class="font-extrabold text-amber-600 dark:text-amber-400 uppercase tracking-wider mb-1">Rollen & Rechte (Übersicht)</h4>
      <p class="text-[11px] text-slate-500 dark:text-slate-400 mb-2">Nur Ansicht. Später können die Haken hier pro Rolle geändert werden.</p>
      <div class="overflow-x-auto"><table class="w-full text-left">
        <thead><tr class="text-[11px] uppercase tracking-wider text-slate-500 dark:text-slate-400"><th class="py-1.5 pr-3">Bereich / Aktion</th>${roles.map((r) => `<th class="py-1.5 px-2 text-center">${r[1]}</th>`).join('')}</tr></thead>
        <tbody>${rows}</tbody>
      </table></div>
    </div>`;
  }
}
window.addNewItemPrompt = function () {
  if (!window.can('inventar.edit')) return;
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
    kasse: { einstellungen: window.kasseCfg, summen: window.kasseTotals, finanzen: window.getFinance() },
    ausgaben: expenseStore.items(),
    boxen: boxStore.items()
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
  if (!window.can('kasse.reset')) return;
  if (!confirm('Saison-Reset: Inventar, Kasse, Spendenente, Standgebühr und Ausgaben auf den Ausgangszustand setzen? Vorher wird ein Backup heruntergeladen.')) return;
  if (prompt('Zur Bestätigung bitte RESET eintippen:') !== 'RESET') return;
  window.downloadBackup();
  invCommit([{ op: 'replaceAll', data: clone(window.inventarCategories || []) }]);
  const now = Date.now();
  const cfg = currentKasseCfg();
  const epochs = {};
  KASSE_DAYS.forEach((d) => { epochs[d] = Math.max(now, cfg.epochs[d] + 1); });
  applyKassePatch({ epochs: epochs, spende: { samstag: 0, sonntag: 0 }, standgebuehr: 0 });
  expenseStore.items().forEach((e) => expenseStore.apply({ op: 'del', id: e.id }));
  window.renderStatistik(true);
  renderAdmin();
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
  reconcileKasseEpochs();
  recomputeKasse();
  persistKasse();
  window.applyRolePermissions(window.currentUserRole);
  window.renderKasse();
  window.renderStatistik();
  window.renderInventar();
  window.renderAushangImages();
  setKasseBadge(kasseMineVer !== kasseSentVer || Object.keys(kassePatch).length ? 'pending' : 'loading');

  window.pullAushang();
  if (window.currentUserRole !== 'gast') {
    window.syncKasse();
    window.syncInventar();
  }

  // Regelmaessiger Abgleich: aktive Ansicht alle 8 s, sonst seltener
  let tick = 0;
  setInterval(() => {
    if (document.hidden) return;
    tick++;
    const view = window.currentView;
    if (window.currentUserRole !== 'gast') {
      const kasseView = view === 'verkauf' || view === 'statistik' || view === 'admin';
      const invView = ['inventar', 'einkaufsliste', 'lagerbestand', 'verkabelung', 'boxen'].indexOf(view) >= 0;
      if (kasseView || tick % 4 === 0) window.syncKasse();
      if (invView || tick % 4 === 0) window.syncInventar();
      if (view === 'statistik') expenseStore.sync();
      if (view === 'boxen') boxStore.sync();
    }
    if (view === 'aushang' && tick % 8 === 0) window.pullAushang();
  }, 8000);
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) return;
    window.pullAushang();
    if (window.currentUserRole !== 'gast') {
      window.syncKasse();
      window.syncInventar();
    }
  });
}
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initApp);
} else {
  initApp();
}
