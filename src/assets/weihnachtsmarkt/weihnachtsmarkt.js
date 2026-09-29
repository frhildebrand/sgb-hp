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
  { name: 'Wasser', menge: 2, einheit: 'l', ohneEinkauf: true },
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
const DEFAULT_STATUSES_EINKAUF = ['Offen', 'Vorbereitet', 'Verteilt', 'Eingekauft'];
const PUNSCH_BECHER_LITER = 0.2;

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
// OBERFLAECHE: Hinweise und Dialoge (statt der Browser-Popups)
// ------------------------------------------
function mk(tag, props, kids) {
  const el = document.createElement(tag);
  const p = props || {};
  Object.keys(p).forEach((k) => {
    if (k === 'class') el.className = p[k];
    else if (k === 'text') el.textContent = p[k];
    else if (k === 'on') Object.keys(p.on).forEach((ev) => el.addEventListener(ev, p.on[ev]));
    else if (k === 'data') Object.keys(p.data).forEach((d) => { el.dataset[d] = p.data[d]; });
    else if (k === 'value' || k === 'checked' || k === 'disabled') el[k] = p[k];
    else el.setAttribute(k, p[k]);
  });
  (kids || []).forEach((c) => { if (c) el.appendChild(c); });
  return el;
}
function notify(message) {
  const old = document.getElementById('uiToast');
  if (old) old.remove();
  const toast = mk('div', {
    id: 'uiToast',
    class: 'fixed left-1/2 -translate-x-1/2 bottom-6 z-[80] max-w-[90vw] px-4 py-3 rounded-xl bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 text-xs font-bold shadow-2xl',
    text: message
  });
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 4000);
}

// Formular-Dialog. Felder: text | password | select | checkbox | statuses.
// Ergebnis: Objekt mit den Werten oder null (abgebrochen).
window.uiForm = function (opts) {
  return new Promise((resolve) => {
    const prev = document.getElementById('uiDialogOverlay');
    if (prev) prev.remove();
    const fields = opts.fields || [];
    const getters = {};
    const errorEls = {};
    const inputBase = 'w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2.5 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-amber-500';
    const labelClass = 'block text-xs font-bold text-slate-500 dark:text-slate-400';
    const body = mk('div', { class: 'space-y-4' });
    let firstInput = null;

    fields.forEach((f) => {
      const wrap = mk('div', { class: 'space-y-1.5' });
      const type = f.type || 'text';
      if (type === 'checkbox') {
        const box = mk('input', { type: 'checkbox', class: 'w-5 h-5 accent-amber-500', checked: !!f.value });
        wrap.appendChild(mk('label', { class: 'flex items-center gap-3 text-sm font-semibold text-slate-800 dark:text-slate-100 cursor-pointer' }, [box, mk('span', { text: f.label })]));
        getters[f.key] = () => !!box.checked;
      } else if (type === 'select') {
        const sel = mk('select', { class: inputBase });
        (f.options || []).forEach((o) => sel.appendChild(mk('option', { value: o.value, text: o.label })));
        sel.value = f.value !== undefined ? f.value : ((f.options && f.options[0]) ? f.options[0].value : '');
        wrap.appendChild(mk('label', { class: labelClass, text: f.label }));
        wrap.appendChild(sel);
        getters[f.key] = () => sel.value;
      } else if (type === 'statuses') {
        let list = (f.value || []).slice();
        const chips = mk('div', { class: 'flex flex-wrap gap-2' });
        const draw = () => {
          chips.textContent = '';
          list.forEach((s, i) => {
            chips.appendChild(mk('span', { class: 'inline-flex items-center gap-1.5 pl-3 pr-1.5 py-1 rounded-full bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-xs font-bold text-slate-800 dark:text-slate-100' }, [
              mk('span', { text: s }),
              mk('button', { type: 'button', class: 'w-5 h-5 rounded-full text-slate-500 hover:bg-rose-500/20 hover:text-rose-500', 'aria-label': s + ' entfernen', text: '✕', data: { act: 'chip-del' }, on: { click: () => { list.splice(i, 1); draw(); } } })
            ]));
          });
        };
        const addInput = mk('input', { type: 'text', class: inputBase, placeholder: 'Neue Option, z. B. Bestellt', maxlength: '30' });
        const addNow = () => {
          const v = addInput.value.trim().slice(0, 30);
          if (v && !list.some((x) => x.toLowerCase() === v.toLowerCase())) list.push(v);
          addInput.value = '';
          draw();
        };
        addInput.addEventListener('keydown', (e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            e.stopPropagation();
            addNow();
          }
        });
        wrap.appendChild(mk('label', { class: labelClass, text: f.label }));
        wrap.appendChild(chips);
        wrap.appendChild(mk('div', { class: 'flex gap-2' }, [
          addInput,
          mk('button', { type: 'button', class: 'shrink-0 px-3 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 text-xs font-black', text: 'Hinzufügen', data: { act: 'chip-add' }, on: { click: addNow } })
        ]));
        if (f.defaults) {
          wrap.appendChild(mk('button', { type: 'button', class: 'text-[11px] font-bold text-slate-500 dark:text-slate-400 underline', text: 'Standard wiederherstellen', data: { act: 'chip-reset' }, on: { click: () => { list = f.defaults.slice(); draw(); } } }));
        }
        draw();
        getters[f.key] = () => {
          if (addInput.value.trim()) addNow();
          return list.slice();
        };
      } else {
        const input = mk('input', { type: type, class: inputBase, placeholder: f.placeholder || '', value: f.value === undefined ? '' : String(f.value) });
        if (f.maxlength) input.setAttribute('maxlength', String(f.maxlength));
        wrap.appendChild(mk('label', { class: labelClass, text: f.label }));
        wrap.appendChild(input);
        getters[f.key] = () => input.value;
        if (!firstInput) firstInput = input;
      }
      if (f.hint) wrap.appendChild(mk('div', { class: 'text-[11px] text-slate-500 dark:text-slate-400', text: f.hint }));
      const err = mk('div', { class: 'hidden text-[11px] font-bold text-rose-500' });
      errorEls[f.key] = err;
      wrap.appendChild(err);
      body.appendChild(wrap);
    });

    const overlay = mk('div', { id: 'uiDialogOverlay', class: 'fixed inset-0 z-[70] bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4' });
    const onKey = (e) => {
      if (e.key === 'Escape') finish(null);
      else if (e.key === 'Enter' && e.target && e.target.tagName === 'INPUT' && e.target.type !== 'checkbox') {
        e.preventDefault();
        submit();
      }
    };
    function finish(result) {
      document.removeEventListener('keydown', onKey);
      overlay.remove();
      resolve(result);
    }
    function submit() {
      const values = {};
      let ok = true;
      fields.forEach((f) => {
        const v = getters[f.key]();
        values[f.key] = v;
        let err = '';
        if (f.required && typeof v === 'string' && !v.trim()) err = 'Bitte ausfüllen.';
        else if (f.validate) err = f.validate(v) || '';
        errorEls[f.key].textContent = err;
        errorEls[f.key].classList.toggle('hidden', !err);
        if (err) ok = false;
      });
      if (ok) finish(values);
    }

    const okClass = opts.danger
      ? 'bg-rose-600 hover:bg-rose-500 text-white'
      : 'bg-amber-500 hover:bg-amber-600 text-slate-950';
    const card = mk('div', {
      role: 'dialog',
      class: 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 rounded-2xl p-6 w-full max-w-md max-h-[90vh] overflow-y-auto space-y-4 shadow-2xl border border-slate-200 dark:border-slate-800'
    }, [
      mk('h3', { class: 'font-extrabold text-base', text: opts.title || '' }),
      opts.message ? mk('p', { class: 'text-sm text-slate-600 dark:text-slate-300 leading-relaxed whitespace-pre-line', text: opts.message }) : null,
      fields.length ? body : null,
      mk('div', { class: 'flex justify-end gap-2 pt-2' }, [
        mk('button', { type: 'button', class: 'px-4 py-2.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold rounded-xl transition', text: opts.cancelText || 'Abbrechen', data: { act: 'cancel' }, on: { click: () => finish(null) } }),
        mk('button', { type: 'button', class: 'px-5 py-2.5 font-extrabold text-xs rounded-xl shadow transition ' + okClass, text: opts.okText || 'OK', data: { act: 'ok' }, on: { click: submit } })
      ])
    ]);
    overlay.appendChild(card);
    overlay.addEventListener('click', (e) => { if (e.target === overlay) finish(null); });
    document.addEventListener('keydown', onKey);
    document.body.appendChild(overlay);
    if (firstInput) {
      setTimeout(() => {
        firstInput.focus();
        if (firstInput.select) firstInput.select();
      }, 30);
    }
  });
};
window.uiConfirm = function (opts) {
  return window.uiForm({
    title: opts.title,
    message: opts.message,
    fields: [],
    okText: opts.okText || 'OK',
    danger: opts.danger !== false
  }).then((v) => v !== null);
};

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
    waffelnProTeig: 15,
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
  cfg.waffelnProTeig = Math.max(0, Math.floor(num(src && src.waffelnProTeig, 15)));
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
    notify(window.currentUserRole === 'gast'
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
    notify('Falsches Passwort.');
    return;
  }
  input.value = '';
  window.closeLoginModal();
  window.setRole(role);
};
window.selectRoleWithPassword = async function (role) {
  window.closeModal('roleModal');
  if (role === 'betrachter' || role === 'gast') {
    window.setRole('gast');
    return;
  }
  const v = await window.uiForm({
    title: 'Anmelden als ' + role,
    fields: [{ key: 'pw', label: 'Passwort', type: 'password', required: true }],
    okText: 'Anmelden'
  });
  if (!v) return;
  if (ROLE_PASSWORDS[v.pw.trim()] === role) window.setRole(role);
  else notify('Falsches Passwort.');
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
  if (patch.waffelnProTeig !== undefined) cfg.waffelnProTeig = patch.waffelnProTeig;
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
  if (newer && newer.waffelnProTeig !== undefined) out.waffelnProTeig = newer.waffelnProTeig;
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
    notify('Auf diesem Gerät wurde hier nichts gebucht. Korrigieren kann man nur am Gerät, das die Buchung erfasst hat.');
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
window.resetKasseDay = async function (day) {
  if (!window.can('kasse.reset') || KASSE_DAYS.indexOf(day) < 0) return;
  const name = day === 'samstag' ? 'Samstag' : 'Sonntag';
  const ok = await window.uiConfirm({
    title: name + ' zurücksetzen?',
    message: 'Die Zähler (verkauft und Helfer) für ' + name + ' werden auf ALLEN Geräten auf 0 gesetzt. Spendenente, Ausgaben und Standgebühr bleiben erhalten.',
    okText: 'Zurücksetzen'
  });
  if (!ok) return;
  const epochs = {};
  epochs[day] = Math.max(Date.now(), currentKasseCfg().epochs[day] + 1);
  applyKassePatch({ epochs: epochs });
};
window.saveWaffelnProTeig = function (value) {
  if (!window.can('finance.edit')) return;
  const text = String(value).trim();
  const n = text === '' ? 0 : parseInt(text, 10);
  if (!isNaN(n) && n >= 0 && n <= 1000) applyKassePatch({ waffelnProTeig: n });
  window.renderStatistik(true);
};

// --- Ausgaben (Liste im Sheet) ---
window.addExpense = function () {
  if (!window.can('finance.edit')) return;
  const amountInput = document.getElementById('expenseAmountInput');
  const noteInput = document.getElementById('expenseNoteInput');
  const amount = parseEuro(amountInput ? amountInput.value : '');
  if (amount === null || amount <= 0) {
    notify('Bitte einen Betrag über 0 eintragen, z. B. 12,50.');
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
window.deleteExpense = async function (id) {
  if (!window.can('finance.edit')) return;
  const item = expenseStore.items().find((e) => e.id === id);
  if (!item) return;
  const ok = await window.uiConfirm({
    title: 'Ausgabe löschen?',
    message: '"' + (item.note || 'ohne Verwendungszweck') + '" (' + formatEuro(item.amount) + ') wird gelöscht.',
    okText: 'Löschen'
  });
  if (!ok) return;
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
  const sumOf = (p, ty) => KASSE_DAYS.reduce((n, d) => n + t[d][p][ty], 0);
  const punschAll = sumOf('kinderpunsch', 'paid') + sumOf('kinderpunsch', 'free');
  const waffelAll = sumOf('waffel', 'paid') + sumOf('waffel', 'free');
  const liter = (x) => x.toLocaleString('de-DE', { minimumFractionDigits: 1, maximumFractionDigits: 2 }) + ' Liter';
  setText('statPunschTotal', punschAll + ' Becher');
  setText('statPunschLiters', liter(punschAll * PUNSCH_BECHER_LITER));
  setText('statWaffelTotal', waffelAll + ' Stück');
  const perTeig = window.kasseCfg.waffelnProTeig;
  setText('statWaffelTeige', perTeig > 0
    ? '≈ ' + (waffelAll / perTeig).toLocaleString('de-DE', { maximumFractionDigits: 1 }) + ' Teige'
    : 'Waffeln pro Teig eintragen, dann wird der Teigverbrauch berechnet');
  setInput('statWaffelnProTeig', perTeig > 0 ? String(perTeig) : '');
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
const INV_FIELDS = ['name', 'sub', 'bedarf', 'lager', 'status', 'wer', 'verantwortlich', 'empfaenger', 'pack', 'box', 'einheit', 'packung', 'laden', 'preis', 'einkauf'];

function invCleanField(field, v) {
  if (field === 'bedarf' || field === 'lager' || field === 'preis') {
    const n = parseFloat(String(v).replace(',', '.'));
    return Math.min(1000000, Math.max(0, Math.round((isNaN(n) ? 0 : n) * 100) / 100));
  }
  if (field === 'pack' || field === 'einkauf') return v === true || v === 'true';
  if (field === 'einheit') return String(v === undefined || v === null ? '' : v).slice(0, 12);
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
    case 'editCat':
      if (!cat) return;
      if (op.title !== undefined && String(op.title).trim().slice(0, 80)) cat.title = String(op.title).trim().slice(0, 80);
      if (op.statuses !== undefined) {
        if (Array.isArray(op.statuses) && op.statuses.length) cat.statuses = op.statuses.slice(0, 12).map((x) => String(x).slice(0, 30));
        else delete cat.statuses;
      }
      if (op.noStock !== undefined) cat.noStock = op.noStock === true;
      if (op.itemLabel !== undefined) {
        if (String(op.itemLabel).trim().slice(0, 30)) cat.itemLabel = String(op.itemLabel).trim().slice(0, 30);
        else delete cat.itemLabel;
      }
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

function isTypingIn(selector) {
  const a = document.activeElement;
  return !!(a && ['INPUT', 'SELECT', 'TEXTAREA'].indexOf(a.tagName) >= 0 && a.type !== 'checkbox' && a.closest && a.closest(selector));
}
function refreshCurrentView(force) {
  const v = window.currentView;
  if (v === 'inventar') {
    if (force || !isTypingIn('#viewInventar')) window.renderInventar();
  } else if (v === 'einkaufsliste') {
    if (force || !isTypingIn('#viewEinkaufsliste')) renderEinkaufsliste();
  } else if (v === 'lagerbestand') renderLagerbestand();
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

// --- Kategorie-Eigenschaften (Standardwerte, falls nichts gespeichert ist) ---
function isOrgaCat(cat) {
  return /orga/i.test((cat && cat.title) || '');
}
window.catNoStock = function (cat) {
  return cat.noStock !== undefined ? cat.noStock === true : isOrgaCat(cat);
};
function defaultItemLabel(cat) {
  return isOrgaCat(cat) ? 'Details' : 'Gegenstand';
}
window.catItemLabel = function (cat) {
  return (cat.itemLabel && String(cat.itemLabel).trim()) || defaultItemLabel(cat);
};
function defaultStatusesFor(cat) {
  const title = (cat.title || '').toLowerCase();
  return ['zutat', 'einkauf', 'einkäuf', 'lebensmittel', 'verpflegung'].some((w) => title.includes(w))
    ? DEFAULT_STATUSES_EINKAUF
    : DEFAULT_STATUSES_STANDARD;
}
window.getCategoryStatuses = function (cat) {
  return Array.isArray(cat.statuses) && cat.statuses.length > 0 ? cat.statuses : defaultStatusesFor(cat);
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
    notify('Für den Bearbeitungsmodus fehlt dir die Berechtigung.');
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
// --- Bearbeiten: Kategorien und Eintraege (Dialoge statt Browser-Popups) ---
window.addCategory = async function () {
  if (!window.can('inventar.edit')) return;
  const v = await window.uiForm({
    title: 'Neue Kategorie',
    fields: [
      { key: 'title', label: 'Name', type: 'text', placeholder: 'z. B. 🍿 Snacks', required: true, maxlength: 80 },
      { key: 'stock', label: 'Bedarf und Lager anzeigen', type: 'checkbox', value: true }
    ],
    okText: 'Anlegen'
  });
  if (!v) return;
  const id = newId('c');
  const ops = [{ op: 'addCat', cat: { id: id, title: v.title.trim() } }];
  if (!v.stock) ops.push({ op: 'editCat', c: id, noStock: true });
  invCommit(ops);
};
window.editCategory = async function (catIdx) {
  if (!window.can('inventar.edit')) return;
  const cat = window.inventarData[catIdx];
  if (!cat) return;
  const v = await window.uiForm({
    title: 'Kategorie bearbeiten',
    fields: [
      { key: 'title', label: 'Name', type: 'text', value: cat.title, required: true, maxlength: 80 },
      { key: 'itemLabel', label: 'Titel der ersten Spalte', type: 'text', value: window.catItemLabel(cat), hint: 'z. B. Gegenstand oder Details', maxlength: 30 },
      { key: 'stock', label: 'Bedarf und Lager anzeigen', type: 'checkbox', value: !window.catNoStock(cat) },
      { key: 'statuses', label: 'Status-Optionen', type: 'statuses', value: window.getCategoryStatuses(cat), defaults: defaultStatusesFor(cat) }
    ],
    okText: 'Speichern'
  });
  if (!v) return;
  const defaults = defaultStatusesFor(cat);
  const isDefault = !v.statuses.length || (v.statuses.length === defaults.length && v.statuses.every((s, i) => s === defaults[i]));
  const label = v.itemLabel.trim();
  invCommit([{
    op: 'editCat',
    c: cat.id,
    title: v.title.trim(),
    itemLabel: label === defaultItemLabel(cat) ? '' : label,
    noStock: !v.stock,
    statuses: isDefault ? null : v.statuses
  }]);
};
window.renameCategory = window.editCategory;
window.editCategoryStatuses = window.editCategory;
window.deleteCategory = async function (catIdx) {
  if (!window.can('inventar.edit')) return;
  const cat = window.inventarData[catIdx];
  if (!cat) return;
  const ok = await window.uiConfirm({
    title: 'Kategorie löschen?',
    message: '"' + cat.title + '" wird mit allen ' + cat.items.length + ' Einträgen gelöscht.',
    okText: 'Löschen'
  });
  if (ok) invCommit([{ op: 'delCat', c: cat.id }]);
};
window.moveCategory = function (catIdx, direction) {
  if (!window.can('inventar.edit')) return;
  const cat = window.inventarData[catIdx];
  const to = catIdx + direction;
  if (!cat || to < 0 || to >= window.inventarData.length) return;
  invCommit([{ op: 'moveCat', c: cat.id, to: to }]);
};
window.addItem = async function (catIdx) {
  if (!window.can('inventar.edit')) return;
  const cat = window.inventarData[catIdx];
  if (!cat) return;
  const v = await window.uiForm({
    title: 'Neuer Eintrag in ' + cat.title,
    fields: [
      { key: 'name', label: 'Name', type: 'text', required: true, maxlength: 200 },
      { key: 'sub', label: 'Beschreibung (optional)', type: 'text', maxlength: 200 }
    ],
    okText: 'Hinzufügen'
  });
  if (!v) return;
  invCommit([{ op: 'addItem', c: cat.id, item: { id: newId('i'), name: v.name.trim(), sub: v.sub.trim(), bedarf: 1, lager: 0, status: 'Offen', wer: '', pack: false, box: '' } }]);
};
window.deleteItem = async function (catIdx, itemIdx) {
  if (!window.can('inventar.edit')) return;
  const cat = window.inventarData[catIdx];
  const item = cat && cat.items[itemIdx];
  if (!item) return;
  const ok = await window.uiConfirm({ title: 'Eintrag löschen?', message: '"' + item.name + '" wird gelöscht.', okText: 'Löschen' });
  if (ok) invCommit([{ op: 'delItem', c: cat.id, i: item.id }]);
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
function thCell(label, width) {
  return `<th class="${TH} ${width}" style="text-align:center">${label}</th>`;
}

function renderItemRow(item, catIdx, itemIdx, cat, edit, readonly) {
  const stock = !window.catNoStock(cat);
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

  const cartBtn = (stock && !isShoppingCat(cat) && window.can('inventar.update'))
    ? `<button type="button" onclick="window.toggleEinkauf(${ref})" title="${item.einkauf ? 'Von der Einkaufsliste entfernen' : 'Auf die Einkaufsliste setzen'}" class="shrink-0 w-7 h-7 rounded-lg text-sm border ${item.einkauf ? 'bg-orange-500/20 border-orange-500/60' : 'bg-slate-100 dark:bg-slate-800 border-slate-300 dark:border-slate-700 opacity-50 hover:opacity-100'}">🛒</button>`
    : '';
  const actions = edit
    ? `<td class="py-2.5 px-2 text-center" style="text-align:center"><div class="flex items-center justify-center gap-1">
         <button onclick="window.moveItem(${ref}, -1)" ${itemIdx === 0 ? 'disabled' : ''} title="Nach oben" class="p-1 text-[10px] bg-slate-200 dark:bg-slate-800 rounded disabled:opacity-30">⬆️</button>
         <button onclick="window.moveItem(${ref}, 1)" ${itemIdx === cat.items.length - 1 ? 'disabled' : ''} title="Nach unten" class="p-1 text-[10px] bg-slate-200 dark:bg-slate-800 rounded disabled:opacity-30">⬇️</button>
         <button onclick="window.deleteItem(${ref})" title="Löschen" class="p-1 text-[10px] bg-rose-500/20 text-rose-500 border border-rose-500/30 rounded font-bold">🗑️</button>
       </div></td>`
    : '';

  return `<tr class="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition">
    <td class="py-2.5 px-4 min-w-[11rem] text-slate-900 dark:text-slate-100" style="text-align:left"><div class="flex items-center gap-2"><div class="min-w-0 flex-1">${nameCell}</div>${cartBtn}</div></td>
    ${stock ? `<td class="py-2.5 px-2 text-center" style="text-align:center"><input type="number" step="any" inputmode="decimal" ${dis} value="${Number(item.bedarf) || 0}" onchange="window.updateInventarItem(${ref}, 'bedarf', this.value)" class="w-16 text-center ${inputBase} py-1 px-1 font-bold" /></td>` : ''}
    ${stock ? `<td class="py-2.5 px-2 text-center" style="text-align:center"><input type="number" step="any" inputmode="decimal" ${dis} value="${Number(item.lager) || 0}" onchange="window.updateInventarItem(${ref}, 'lager', this.value)" class="w-16 text-center ${inputBase} py-1 px-1 font-black text-emerald-600 dark:text-emerald-400" /></td>` : ''}
    <td class="py-2.5 px-2 text-center" style="text-align:center"><select ${dis} onchange="window.updateInventarItem(${ref}, 'status', this.value)" class="w-full bg-white dark:bg-slate-950 border rounded-md py-1 px-2 text-xs focus:border-amber-500 focus:outline-none disabled:opacity-60 ${statusStyleClass(status)}">
      ${options.map((s) => `<option value="${escapeHtml(s)}" ${s === status ? 'selected' : ''} class="bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100">${escapeHtml(s)}</option>`).join('')}
    </select></td>
    <td class="py-2.5 px-2 text-center" style="text-align:center"><input type="text" ${dis} value="${escapeHtml(item.wer || item.verantwortlich || '')}" placeholder="Name..." onchange="window.updateInventarItem(${ref}, 'wer', this.value)" class="w-full min-w-[7rem] ${inputBase} py-1 px-2 text-xs" /></td>
    <td class="py-2.5 px-2 text-center" style="text-align:center"><input type="checkbox" ${dis} ${item.pack ? 'checked' : ''} onchange="window.updateInventarItem(${ref}, 'pack', this.checked)" class="w-4 h-4 accent-amber-500" /></td>
    <td class="py-2.5 px-2 text-center" style="text-align:center"><input type="text" ${dis} value="${escapeHtml(item.box || '')}" onchange="window.updateInventarItem(${ref}, 'box', this.value)" class="w-20 ${inputBase} py-1 px-2 text-xs" /></td>
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
           <button onclick="window.editCategory(${catIdx})" title="Kategorie bearbeiten (Name, Status-Optionen, Spalten)" class="p-1.5 text-xs bg-slate-200 dark:bg-slate-800 rounded-lg">✏️</button>
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
            <th class="py-3 px-4 min-w-[11rem] text-[11px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400" style="text-align:left">${escapeHtml(window.catItemLabel(cat))}</th>
            ${window.catNoStock(cat) ? '' : thCell('Bedarf', 'w-20') + thCell('Lager', 'w-20')}
            ${thCell('Status', 'w-36')}
            ${thCell('Verantwortlich', 'w-44')}
            ${thCell('Eingepackt', 'w-24')}
            ${thCell('Box', 'w-24')}
            ${edit ? thCell('Aktionen', 'w-28') : ''}
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
// --- Einkaufsliste: Zutaten, Einkaeufe und im Inventar markierte Artikel ---
const DEFAULT_STORES = ['E-Center', 'REWE', 'Lidl', 'Aldi', 'Penny', 'Netto', 'Kaufland', 'Metro', 'Online', 'Sonstiges'];
const THS = 'py-3 px-3 text-[11px] font-black uppercase tracking-wider text-slate-600 dark:text-slate-300';

function isShoppingCat(cat) {
  return /zutat|einkauf|einkäuf/i.test((cat && cat.title) || '');
}
function fmtNum(n) {
  return Number(n || 0).toLocaleString('de-DE', { maximumFractionDigits: 2 });
}
function fmtQty(n, unit) {
  return fmtNum(n) + (unit ? ' ' + unit : '');
}
function parseNum(v) {
  const n = parseFloat(String(v).replace(',', '.'));
  return isNaN(n) ? 0 : n;
}
function storeOptions() {
  const set = DEFAULT_STORES.slice();
  window.inventarData.forEach((c) => c.items.forEach((i) => {
    if (i.laden && set.indexOf(i.laden) < 0) set.push(i.laden);
  }));
  return set;
}
function shoppingEntries() {
  const out = [];
  window.inventarData.forEach((cat, catIdx) => {
    cat.items.forEach((item, itemIdx) => {
      const auto = isShoppingCat(cat);
      if (auto || item.einkauf === true) out.push({ cat: cat, catIdx: catIdx, item: item, itemIdx: itemIdx, auto: auto });
    });
  });
  return out;
}
window.shoppingOnlyMissing = localStorage.getItem('shopOnlyMissing') === '1';
window.toggleShoppingFilter = function () {
  window.shoppingOnlyMissing = !window.shoppingOnlyMissing;
  localStorage.setItem('shopOnlyMissing', window.shoppingOnlyMissing ? '1' : '0');
  renderEinkaufsliste();
};
window.toggleEinkauf = function (catIdx, itemIdx) {
  const cat = window.inventarData[catIdx];
  const item = cat && cat.items[itemIdx];
  if (!item || isShoppingCat(cat)) return;
  window.updateInventarItem(catIdx, itemIdx, 'einkauf', !item.einkauf);
};
window.toggleGekauft = function (catIdx, itemIdx, checked) {
  window.updateInventarItem(catIdx, itemIdx, 'status', checked ? 'Eingekauft' : 'Offen');
};
window.setItemLaden = async function (catIdx, itemIdx, value) {
  if (value === '__new__') {
    const v = await window.uiForm({
      title: 'Anderer Laden',
      fields: [{ key: 'name', label: 'Name des Ladens', type: 'text', required: true, maxlength: 40 }],
      okText: 'Übernehmen'
    });
    if (!v) {
      renderEinkaufsliste();
      return;
    }
    value = v.name.trim();
  }
  window.updateInventarItem(catIdx, itemIdx, 'laden', value);
};
window.addShoppingItem = async function () {
  if (!window.can('inventar.update')) return;
  const v = await window.uiForm({
    title: 'Artikel zur Einkaufsliste hinzufügen',
    fields: [
      { key: 'name', label: 'Artikel', type: 'text', required: true, maxlength: 200 },
      { key: 'bedarf', label: 'Menge', type: 'text', value: '1' },
      { key: 'einheit', label: 'Einheit (optional)', type: 'text', placeholder: 'z. B. Btl., l, Stk.', maxlength: 12 },
      { key: 'laden', label: 'Laden (optional)', type: 'select', options: [{ value: '', label: '-- Wählen --' }].concat(storeOptions().map((s) => ({ value: s, label: s }))) }
    ],
    okText: 'Hinzufügen'
  });
  if (!v) return;
  const ops = [];
  let cat = window.inventarData.find((c) => /sonstige einkäufe/i.test(c.title));
  let catId;
  if (cat) {
    catId = cat.id;
  } else {
    catId = newId('c');
    ops.push({ op: 'addCat', cat: { id: catId, title: '🛒 SONSTIGE EINKÄUFE' } });
    ops.push({ op: 'editCat', c: catId, noStock: false });
  }
  ops.push({ op: 'addItem', c: catId, item: { id: newId('i'), name: v.name.trim(), sub: '', bedarf: parseNum(v.bedarf) || 1, lager: 0, status: 'Offen', einheit: v.einheit.trim(), laden: v.laden, wer: '', pack: false, box: '' } });
  invCommit(ops);
};

function renderEinkaufsliste() {
  const box = document.getElementById('einkaufslisteContainer');
  if (!box) return;
  const editable = window.can('inventar.update');
  const dis = editable ? '' : 'disabled';
  const stores = storeOptions();
  const inputBase = 'bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-600 text-slate-900 dark:text-slate-100 focus:border-amber-500 focus:outline-none rounded-md disabled:opacity-60';
  const entries = shoppingEntries();

  let missingCount = 0;
  let costOpen = 0;
  let costDone = 0;
  entries.forEach((e) => {
    const missing = Math.max(0, round2(Number(e.item.bedarf) - Number(e.item.lager)));
    const done = e.item.status === 'Eingekauft';
    if (missing > 0 && !done) missingCount++;
    if (done) costDone += Number(e.item.preis) || 0;
    else costOpen += Number(e.item.preis) || 0;
  });
  setText('einkaufCountAll', entries.length);
  setText('einkaufCountMissing', missingCount);
  setText('einkaufCostOpen', formatEuro(round2(costOpen)));
  setText('einkaufCostDone', formatEuro(round2(costDone)));
  const filterBtn = document.getElementById('einkaufFilterBtn');
  if (filterBtn) {
    filterBtn.innerText = window.shoppingOnlyMissing ? '✓ Nur Fehlendes' : 'Nur Fehlendes';
    filterBtn.className = 'px-3.5 py-2 text-xs font-bold rounded-xl border transition ' + (window.shoppingOnlyMissing
      ? 'bg-amber-500 text-slate-950 border-amber-500'
      : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 border-slate-300 dark:border-slate-700 hover:bg-slate-200 dark:hover:bg-slate-700');
  }

  const groups = [];
  entries.forEach((e) => {
    const missing = Math.max(0, round2(Number(e.item.bedarf) - Number(e.item.lager)));
    if (window.shoppingOnlyMissing && (missing <= 0 || e.item.status === 'Eingekauft')) return;
    let g = groups.find((x) => x.catIdx === e.catIdx);
    if (!g) {
      g = { catIdx: e.catIdx, cat: e.cat, rows: [] };
      groups.push(g);
    }
    g.rows.push({ e: e, missing: missing });
  });

  box.innerHTML = groups.map((g) => `<div class="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
    <div class="px-5 py-3.5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-2">
      <h3 class="text-xs sm:text-sm font-black tracking-wide text-orange-600 dark:text-orange-400 uppercase">${escapeHtml(g.cat.title)}</h3>
      <span class="text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-300 dark:border-slate-700">${g.rows.length} Artikel</span>
    </div>
    <div class="overflow-x-auto">
    <table class="w-full text-xs">
      <thead class="bg-slate-100 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700">
        <tr>
          <th class="${THS}" style="text-align:center">Gekauft</th>
          <th class="${THS} min-w-[10rem]" style="text-align:left">Artikel</th>
          <th class="${THS}" style="text-align:center">Bedarf</th>
          <th class="${THS}" style="text-align:center">Lager</th>
          <th class="${THS}" style="text-align:center">Fehlt</th>
          <th class="${THS}" style="text-align:center">Status</th>
          <th class="${THS}" style="text-align:center">Packung</th>
          <th class="${THS}" style="text-align:center">Laden</th>
          <th class="${THS}" style="text-align:center">Preis (€)</th>
          <th class="${THS}" style="text-align:center"></th>
        </tr>
      </thead>
      <tbody class="divide-y divide-slate-200 dark:divide-slate-800/60">
      ${g.rows.map((r) => {
        const it = r.e.item;
        const ref = r.e.catIdx + ', ' + r.e.itemIdx;
        const done = it.status === 'Eingekauft';
        const statuses = DEFAULT_STATUSES_EINKAUF.slice();
        if (it.status && statuses.indexOf(it.status) < 0) statuses.push(it.status);
        const shops = stores.slice();
        if (it.laden && shops.indexOf(it.laden) < 0) shops.push(it.laden);
        const fehlt = done
          ? '<span class="text-emerald-600 dark:text-emerald-400 font-black">✓</span>'
          : (r.missing > 0
            ? `<span class="font-black text-orange-600 dark:text-orange-400">${escapeHtml(fmtQty(r.missing, it.einheit))}</span>`
            : '<span class="text-emerald-600 dark:text-emerald-400 font-bold">ok</span>');
        return `<tr class="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition ${done ? 'opacity-60' : ''}">
          <td class="py-2.5 px-3" style="text-align:center"><input type="checkbox" ${dis} ${done ? 'checked' : ''} onchange="window.toggleGekauft(${ref}, this.checked)" class="w-4 h-4 accent-emerald-500" /></td>
          <td class="py-2.5 px-3 font-bold text-slate-900 dark:text-slate-100" style="text-align:left">${escapeHtml(it.name)}${it.sub ? `<div class="text-[10px] font-normal text-slate-500 dark:text-slate-400">${escapeHtml(it.sub)}</div>` : ''}</td>
          <td class="py-2.5 px-3 whitespace-nowrap" style="text-align:center"><input type="number" step="any" inputmode="decimal" ${dis} value="${Number(it.bedarf) || 0}" onchange="window.updateInventarItem(${ref}, 'bedarf', this.value)" class="w-16 text-center ${inputBase} py-1 px-1 font-bold text-amber-600 dark:text-amber-400" />${it.einheit ? `<span class="ml-1 text-[11px] text-slate-500 dark:text-slate-400">${escapeHtml(it.einheit)}</span>` : ''}</td>
          <td class="py-2.5 px-3" style="text-align:center"><input type="number" step="any" inputmode="decimal" ${dis} value="${Number(it.lager) || 0}" onchange="window.updateInventarItem(${ref}, 'lager', this.value)" class="w-16 text-center ${inputBase} py-1 px-1 font-black text-emerald-600 dark:text-emerald-400" /></td>
          <td class="py-2.5 px-3 whitespace-nowrap" style="text-align:center">${fehlt}</td>
          <td class="py-2.5 px-3" style="text-align:center"><select ${dis} onchange="window.updateInventarItem(${ref}, 'status', this.value)" class="bg-white dark:bg-slate-950 border rounded-md py-1 px-2 text-xs focus:border-amber-500 focus:outline-none disabled:opacity-60 ${statusStyleClass(it.status || 'Offen')}">${statuses.map((s) => `<option value="${escapeHtml(s)}" ${s === (it.status || 'Offen') ? 'selected' : ''}>${escapeHtml(s)}</option>`).join('')}</select></td>
          <td class="py-2.5 px-3" style="text-align:center"><input type="text" ${dis} value="${escapeHtml(it.packung || '')}" placeholder="z. B. 20 Btl." maxlength="40" onchange="window.updateInventarItem(${ref}, 'packung', this.value)" class="w-24 ${inputBase} py-1 px-2 text-xs" /></td>
          <td class="py-2.5 px-3" style="text-align:center"><select ${dis} onchange="window.setItemLaden(${ref}, this.value)" class="w-32 ${inputBase} py-1 px-2 text-xs"><option value="">-- Wählen --</option>${shops.map((s) => `<option value="${escapeHtml(s)}" ${s === it.laden ? 'selected' : ''}>${escapeHtml(s)}</option>`).join('')}<option value="__new__">➕ Anderer Laden…</option></select></td>
          <td class="py-2.5 px-3 whitespace-nowrap" style="text-align:center"><input type="text" inputmode="decimal" ${dis} value="${(Number(it.preis) || 0).toFixed(2).replace('.', ',')}" onchange="window.updateInventarItem(${ref}, 'preis', this.value)" class="w-20 text-right ${inputBase} py-1 px-2 text-xs font-bold" /><span class="ml-1 text-slate-500">€</span></td>
          <td class="py-2.5 px-3" style="text-align:center">${!r.e.auto && editable ? `<button type="button" onclick="window.toggleEinkauf(${ref})" title="Von der Einkaufsliste entfernen" class="w-7 h-7 rounded-lg text-xs bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-500 hover:text-rose-500">✕</button>` : ''}</td>
        </tr>`;
      }).join('')}
      </tbody>
    </table>
    </div>
  </div>`).join('') || `<div class="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-8 text-center text-xs text-slate-500 dark:text-slate-400">${window.shoppingOnlyMissing ? 'Es fehlt nichts mehr. 🎉' : 'Noch keine Artikel. Füge oben einen Artikel hinzu oder markiere im Inventar Einträge mit 🛒.'}</div>`;
}

// --- Lagerbestand: nur Artikel, die wirklich auf Lager sind ---
function renderLagerbestand() {
  const box = document.getElementById('lagerbestandContainer');
  if (!box) return;
  const rows = [];
  window.inventarData.forEach((cat) => {
    if (window.catNoStock(cat)) return;
    cat.items.forEach((item) => {
      if ((Number(item.lager) || 0) > 0) rows.push({ cat: cat, item: item });
    });
  });
  setText('lagerCount', rows.length + (rows.length === 1 ? ' Artikel' : ' Artikel') + ' auf Lager');
  if (!rows.length) {
    box.innerHTML = '<div class="p-8 text-center text-xs text-slate-500 dark:text-slate-400">Noch nichts auf Lager eingetragen. Trage im Inventar bei „Lager“ die vorhandenen Mengen ein.</div>';
    return;
  }
  box.innerHTML = `<div class="overflow-x-auto"><table class="w-full text-xs">
    <thead class="bg-slate-100 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700">
      <tr>
        <th class="${THS}" style="text-align:left">Kategorie</th>
        <th class="${THS} min-w-[10rem]" style="text-align:left">Gegenstand</th>
        <th class="${THS}" style="text-align:center">Bedarf</th>
        <th class="${THS}" style="text-align:center">Vorhanden</th>
        <th class="${THS}" style="text-align:center">Status</th>
        <th class="${THS}" style="text-align:center">Box</th>
      </tr>
    </thead>
    <tbody class="divide-y divide-slate-200 dark:divide-slate-800/60">
    ${rows.map((r) => {
      const need = Number(r.item.bedarf) || 0;
      const have = Number(r.item.lager) || 0;
      const enough = have >= need;
      return `<tr class="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition">
        <td class="py-2.5 px-3 text-slate-600 dark:text-slate-300" style="text-align:left">${escapeHtml(r.cat.title)}</td>
        <td class="py-2.5 px-3 font-bold text-slate-900 dark:text-slate-100" style="text-align:left">${escapeHtml(r.item.name)}</td>
        <td class="py-2.5 px-3 font-bold text-amber-600 dark:text-amber-400" style="text-align:center">${escapeHtml(fmtQty(need, r.item.einheit))}</td>
        <td class="py-2.5 px-3 font-black text-emerald-600 dark:text-emerald-400" style="text-align:center">${escapeHtml(fmtQty(have, r.item.einheit))}</td>
        <td class="py-2.5 px-3" style="text-align:center">${enough
          ? '<span class="px-2 py-0.5 rounded-md text-[11px] font-bold bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30">Ausreichend</span>'
          : `<span class="px-2 py-0.5 rounded-md text-[11px] font-bold bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/30">Zu wenig (fehlt ${escapeHtml(fmtQty(round2(need - have), r.item.einheit))})</span>`}</td>
        <td class="py-2.5 px-3 text-slate-600 dark:text-slate-300" style="text-align:center">${escapeHtml(r.item.box || '–')}</td>
      </tr>`;
    }).join('')}
    </tbody></table></div>`;
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
    notify('Bitte einen Namen eingeben.');
    return;
  }
  boxStore.apply({ op: 'save', item: { id: id || newId('b'), name: name.slice(0, 60), desc: desc.slice(0, 120) } });
  window.closeModal('boxEditModal');
  renderBoxen();
};
window.deleteBox = async function (id) {
  if (!window.can('boxen.edit')) return;
  const box = boxStore.items().find((b) => b.id === id);
  const ok = await window.uiConfirm({ title: 'Box löschen?', message: box ? '"' + box.name + '" wird gelöscht. Die Einträge im Inventar behalten ihren Boxnamen.' : '', okText: 'Löschen' });
  if (!ok) return;
  boxStore.apply({ op: 'del', id: id });
  renderBoxen();
};

// --- Rezept-Rechner (Kinderpunsch) ---
function computePunsch(liters) {
  const factor = liters / PUNSCH_BASIS_LITER;
  return PUNSCH_ZUTATEN.map((z) => {
    let amount = z.menge * factor;
    if (z.aufrunden) amount = Math.ceil(amount - 1e-9);
    else if (z.schritt) amount = Math.round(amount / z.schritt) * z.schritt;
    else amount = Math.round(amount * 100) / 100;
    return { name: z.name, unit: z.einheit, amount: amount, ohneEinkauf: !!z.ohneEinkauf };
  });
}
function punschLiters() {
  const input = document.getElementById('punschCalcInput');
  return Math.max(1, parseFloat(String((input && input.value) || PUNSCH_BASIS_LITER).replace(',', '.')) || PUNSCH_BASIS_LITER);
}
window.updatePunschRecipe = function () {
  const list = document.getElementById('recipeIngredientsList');
  if (!list) return;
  list.innerHTML = computePunsch(punschLiters()).map((r) =>
    `<li><span class="font-bold">${fmtNum(r.amount)} ${escapeHtml(r.unit)}</span> ${escapeHtml(r.name)}</li>`
  ).join('');
};
function findInventarItem(name) {
  const norm = (x) => String(x).toLowerCase().replace(/\s*\(.*?\)\s*/g, '').trim();
  const target = norm(name);
  let found = null;
  window.inventarData.forEach((cat) => cat.items.forEach((item) => {
    if (norm(item.name) === target && (!found || (isShoppingCat(cat) && !isShoppingCat(found.cat)))) found = { cat: cat, item: item };
  }));
  return found;
}
// Setzt den Bedarf der Zutaten im Inventar auf die Rechner-Werte (ueberschreibt)
window.applyPunschToShopping = async function () {
  if (!window.can('inventar.update')) {
    notify('Dafür fehlt dir die Berechtigung.');
    return;
  }
  const liters = punschLiters();
  const rows = computePunsch(liters).filter((r) => !r.ohneEinkauf);
  const plan = rows.map((r) => ({ row: r, found: findInventarItem(r.name) }));
  const lines = plan.map((p) => {
    const old = p.found ? fmtQty(p.found.item.bedarf, p.found.item.einheit) : 'neu';
    return p.row.name + ': ' + old + ' → ' + fmtQty(p.row.amount, p.row.unit);
  });
  const ok = await window.uiConfirm({
    title: 'Zutaten für ' + fmtNum(liters) + ' Liter übernehmen?',
    message: 'Der Bedarf im Inventar wird überschrieben:\n' + lines.join('\n'),
    okText: 'Übernehmen',
    danger: false
  });
  if (!ok) return;
  const ops = [];
  let zutatenCat = window.inventarData.find((c) => /zutat/i.test(c.title));
  let zutatenId = zutatenCat ? zutatenCat.id : null;
  plan.forEach((p) => {
    if (p.found) {
      ops.push({ op: 'set', c: p.found.cat.id, i: p.found.item.id, f: 'bedarf', v: p.row.amount });
      ops.push({ op: 'set', c: p.found.cat.id, i: p.found.item.id, f: 'einheit', v: p.row.unit });
    } else {
      if (!zutatenId) {
        zutatenId = newId('c');
        ops.push({ op: 'addCat', cat: { id: zutatenId, title: '🍎 ZUTATEN' } });
        ops.push({ op: 'editCat', c: zutatenId, noStock: false });
      }
      ops.push({ op: 'addItem', c: zutatenId, item: { id: newId('i'), name: p.row.name, sub: '', bedarf: p.row.amount, einheit: p.row.unit, lager: 0, status: 'Offen', wer: '', pack: false, box: '' } });
    }
  });
  invCommit(ops);
  notify('Einkaufsliste aktualisiert (' + plan.length + ' Zutaten).');
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
window.addNewItemPrompt = async function () {
  if (!window.can('inventar.edit')) return;
  const v = await window.uiForm({
    title: 'Neuen Eintrag anlegen',
    fields: [
      { key: 'cat', label: 'Kategorie', type: 'select', options: window.inventarData.map((c) => ({ value: c.id, label: c.title })) },
      { key: 'name', label: 'Name', type: 'text', required: true, maxlength: 200 },
      { key: 'sub', label: 'Beschreibung (optional)', type: 'text', maxlength: 200 }
    ],
    okText: 'Hinzufügen'
  });
  if (!v) return;
  invCommit([{ op: 'addItem', c: v.cat, item: { id: newId('i'), name: v.name.trim(), sub: v.sub.trim(), bedarf: 1, lager: 0, status: 'Offen', wer: '', pack: false, box: '' } }]);
  notify('Eintrag angelegt.');
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
window.resetSeasonPrompt = async function () {
  if (!window.can('kasse.reset')) return;
  const v = await window.uiForm({
    title: 'Saison-Reset',
    message: 'Setzt Inventar, Kasse, Spendenente, Standgebühr und Ausgaben zurück. Vorher wird automatisch ein Backup heruntergeladen. Das kann nicht rückgängig gemacht werden.',
    fields: [{ key: 'word', label: 'Zur Bestätigung RESET eintippen', type: 'text', validate: (x) => (String(x).trim() === 'RESET' ? '' : 'Bitte RESET eintippen.') }],
    okText: 'Zurücksetzen',
    danger: true
  });
  if (!v) return;
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
