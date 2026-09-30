// ==========================================================
// SG BARNSTORF WEIHNACHTSMARKT - MAIN ENGINE (Version 4)
// Prinzip: Alles wird zuerst lokal gespeichert und sofort
// angezeigt. Danach wird im Hintergrund mit Google Sheets
// synchronisiert.
// ==========================================================
const GOOGLE_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbz5_j65a248FUib9POAAWryFHFh6-613bhVpXUaBuTIpDEHx_kUOrOnh-NVhBduT8Ks/exec';
const APP_VERSION = 11;            // Stand dieser Dateien
const SCRIPT_VERSION_NEEDED = 11;   // so neu muss das Google-Script mindestens sein
window.syncTimes = {};
function markSync(key) {
  window.syncTimes[key] = Date.now();
}

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
const COUNT_KEY_RE = /^(samstag|sonntag)_([A-Za-z0-9]+)_(paid|free)$/;

// ------------------------------------------
// RECHTE: alle Einzelrechte (Schluessel, Beschriftung, Standard-Rollen g=Gast h=Helfer o=Orga a=Admin).
// Die Liste muss zur Liste im Google Script (PERM_DEFS) passen. Welche Rolle was darf, steht im Sheet
// (Blatt "Zugang") und wird im Admin-Panel unter "Rollen & Benutzer" geaendert.
// ------------------------------------------
const PERMISSION_GROUPS = [
  {
    id: 'view', title: 'Seiten ansehen', perms: [
      ['view.aushang', 'Aushang', 'ghoa'],
      ['view.inventar', 'Inventar', 'hoa'],
      ['view.verkauf', 'Kasse', 'hoa'],
      ['view.statistik', 'Statistik', 'a'],
      ['view.einkaufsliste', 'Einkaufsliste', 'hoa'],
      ['view.verkabelung', 'Strom / Verkabelung', 'hoa'],
      ['view.lagerbestand', 'Lagerbestand', 'hoa'],
      ['view.boxen', 'Boxen', 'hoa'],
      ['view.rezepte', 'Rezepte', 'hoa'],
      ['view.aufbau', 'Aufbau', 'hoa'],
      ['view.admin', 'Admin-Panel', 'a'],
      ['view.status', 'Systemstatus', 'oa'],
      ['view.protokoll', 'Änderungsprotokoll', 'a']
    ]
  },
  {
    id: 'aushang', title: 'Aushang', perms: [
      ['aushang.signup', 'Sich in Listen eintragen', 'ghoa'],
      ['aushang.unsignOthers', 'Fremde Einträge austragen', 'oa'],
      ['aushang.editRows', 'Zeilen anlegen, bearbeiten, löschen, sortieren', 'oa'],
      ['aushang.editTitle', 'Titel und Datum ändern', 'oa'],
      ['aushang.editTeig', 'Teig-Plätze hinzufügen / entfernen', 'oa'],
      ['aushang.print', 'Aushang drucken (Druckknöpfe sehen)', 'oa'],
      ['aushang.upload', 'Zusatz-Aushang (Scan) hochladen', 'a']
    ]
  },
  {
    id: 'inventar', title: 'Inventar', perms: [
      ['inventar.editBedarf', 'Bedarf ändern', 'hoa'],
      ['inventar.editLager', 'Lager ändern', 'hoa'],
      ['inventar.editStatus', 'Status ändern', 'hoa'],
      ['inventar.editName', 'Name und Beschreibung ändern', 'oa'],
      ['inventar.editMeta', 'Verantwortlich, Eingepackt und Box ändern', 'hoa'],
      ['inventar.cart', 'Artikel auf die Einkaufsliste setzen / entfernen', 'hoa'],
      ['inventar.addItem', 'Einträge anlegen', 'oa'],
      ['inventar.deleteItem', 'Einträge löschen', 'oa'],
      ['inventar.moveItem', 'Einträge verschieben', 'oa'],
      ['inventar.catAdd', 'Kategorien anlegen', 'oa'],
      ['inventar.catEdit', 'Kategorien bearbeiten und sortieren', 'oa'],
      ['inventar.catDelete', 'Kategorien löschen', 'oa']
    ]
  },
  {
    id: 'einkauf', title: 'Einkaufsliste', perms: [
      ['einkauf.check', 'Abhaken', 'hoa'],
      ['einkauf.editPack', 'Packungsgröße ändern', 'hoa'],
      ['einkauf.editPreis', 'Preis ändern', 'hoa'],
      ['einkauf.editLaden', 'Laden ändern', 'hoa'],
      ['einkauf.addItem', 'Artikel hinzufügen', 'hoa'],
      ['einkauf.removeItem', 'Artikel von der Liste nehmen', 'hoa']
    ]
  },
  {
    id: 'rezepte', title: 'Rezepte', perms: [
      ['rezepte.calc', 'Rechner benutzen', 'hoa'],
      ['rezepte.toShopping', 'Rechner-Mengen in die Einkaufsliste übernehmen', 'hoa'],
      ['rezepte.add', 'Rezepte anlegen', 'oa'],
      ['rezepte.edit', 'Rezepte und Zutaten bearbeiten', 'oa'],
      ['rezepte.delete', 'Rezepte löschen', 'oa']
    ]
  },
  {
    id: 'boxen', title: 'Boxen', perms: [
      ['boxen.add', 'Boxen anlegen', 'oa'],
      ['boxen.edit', 'Boxen bearbeiten', 'oa'],
      ['boxen.delete', 'Boxen löschen', 'oa']
    ]
  },
  {
    id: 'strom', title: 'Strom', perms: [
      ['strom.steckerAdd', 'Stecker anlegen', 'oa'],
      ['strom.steckerEdit', 'Stecker umbenennen und Dose wählen', 'oa'],
      ['strom.steckerDelete', 'Stecker löschen', 'oa'],
      ['strom.plan', 'Karten verplanen (ziehen)', 'oa'],
      ['strom.watt', 'Watt, Belastbarkeit und Steckplätze je Karte', 'oa'],
      ['strom.verteiler', 'Verteiler einstellen', 'oa'],
      ['strom.print', 'Stromplan drucken', 'hoa']
    ]
  },
  {
    id: 'aufbau', title: 'Aufbau', perms: [
      ['aufbau.check', 'Schritte abhaken', 'hoa'],
      ['aufbau.stepAdd', 'Schritte anlegen', 'oa'],
      ['aufbau.stepEdit', 'Schritte bearbeiten', 'oa'],
      ['aufbau.stepDelete', 'Schritte löschen', 'oa'],
      ['aufbau.noteAdd', 'Hinweise anlegen', 'oa'],
      ['aufbau.noteEdit', 'Hinweise bearbeiten', 'oa'],
      ['aufbau.noteDelete', 'Hinweise löschen', 'oa'],
      ['aufbau.imageAdd', 'Bilder anlegen', 'oa'],
      ['aufbau.imageEdit', 'Bilder bearbeiten', 'oa'],
      ['aufbau.imageDelete', 'Bilder löschen', 'oa'],
      ['aufbau.sort', 'Einträge sortieren', 'oa'],
      ['aufbau.print', 'Aufbauplan drucken', 'hoa']
    ]
  },
  {
    id: 'kasse', title: 'Kasse', perms: [
      ['kasse.book', 'Buchen (inklusive Rückgängig)', 'hoa'],
      ['kasse.correct', 'Verkaufszahlen korrigieren', 'a'],
      ['kasse.reset', 'Tag zurücksetzen', 'a'],
      ['kasse.sturz', 'Kassensturz erfassen', 'oa'],
      ['kasse.close', 'Tag abschließen', 'oa'],
      ['kasse.reopen', 'Abgeschlossenen Tag wieder öffnen', 'a'],
      ['kasse.practice', 'Übungsmodus benutzen', 'hoa']
    ]
  },
  {
    id: 'finance', title: 'Finanzen', perms: [
      ['finance.expenseAdd', 'Ausgaben anlegen', 'a'],
      ['finance.expenseDelete', 'Ausgaben löschen', 'a'],
      ['finance.spende', 'Spendenente eintragen', 'a'],
      ['finance.standgebuehr', 'Standgebühr eintragen', 'a'],
      ['finance.prices', 'Verkaufspreise ändern', 'a'],
      ['finance.productAdd', 'Produkte anlegen', 'a'],
      ['finance.productEdit', 'Produkte bearbeiten', 'a'],
      ['finance.productDelete', 'Produkte löschen', 'a'],
      ['finance.teig', 'Waffeln pro Teig ändern', 'a'],
      ['finance.receipt', 'Belege zu Ausgaben anhängen und entfernen', 'a'],
      ['finance.export', 'Abrechnung als CSV oder PDF ausgeben', 'a']
    ]
  },
  {
    id: 'system', title: 'System', perms: [
      ['system.roles', 'Rollen anlegen, umbenennen, löschen', 'a'],
      ['system.rechte', 'Rechte von Rollen ändern', 'a'],
      ['system.users', 'Benutzer anlegen, bearbeiten, löschen', 'a'],
      ['system.passwords', 'Passwörter ändern', 'a'],
      ['system.backup', 'Backup herunterladen und Sicherung erstellen', 'a'],
      ['system.restore', 'Sicherung wiederherstellen', 'a'],
      ['system.kiosk', 'Kiosk-Modus ein- und ausschalten', 'oa'],
      ['system.reset', 'Saison-Reset', 'a']
    ]
  }
];
const PERMISSION_LIST = [];
const PERMISSION_LABELS = {};
PERMISSION_GROUPS.forEach((g) => g.perms.forEach((p) => {
  PERMISSION_LIST.push(p[0]);
  PERMISSION_LABELS[p[0]] = p[1];
}));
// Diese Rechte behaelt der Administrator immer (Schutz vor dem Aussperren); muss zum Script (ADMIN_CORE) passen
const ADMIN_CORE_PERMS = ['view.admin', 'system.roles', 'system.rechte', 'system.users', 'system.passwords'];
const ROLE_LETTER = { gast: 'g', helfer: 'h', orga: 'o', admin: 'a' };
const DEFAULT_ROLE_META = [
  { id: 'admin', name: 'Administrator', desc: 'Vollzugriff', builtin: true, hasPw: true },
  { id: 'orga', name: 'Orga-Team', desc: 'Inventar, Einkäufe, Strom', builtin: false, hasPw: true },
  { id: 'helfer', name: 'Helfer', desc: 'Kasse, Rezepte, Lager', builtin: false, hasPw: true },
  { id: 'gast', name: 'Gast', desc: 'Aushänge ansehen und sich eintragen', builtin: true, hasPw: false }
];
// Rang: oben steht die hoechste Rolle (Reihenfolge stellt der Admin in der Zugangsverwaltung ein)
function sortRoles(list) {
  return list.slice().sort((a, b) => (typeof a.rank === 'number' ? a.rank : 99) - (typeof b.rank === 'number' ? b.rank : 99));
}
function defaultRoles() {
  return DEFAULT_ROLE_META.map((m, i) => Object.assign({}, m, {
    rank: i,
    perms: [].concat.apply([], PERMISSION_GROUPS.map((g) => g.perms.filter((p) => p[2].indexOf(ROLE_LETTER[m.id]) >= 0).map((p) => p[0])))
  }));
}
function validRoles(list) {
  return Array.isArray(list) && list.length > 0 && list.every((r) => r && typeof r.id === 'string' && typeof r.name === 'string' && Array.isArray(r.perms));
}
window.rolesData = (() => {
  try {
    const saved = JSON.parse(localStorage.getItem('rolesData4'));
    if (validRoles(saved)) return sortRoles(saved);
  } catch (e) { /* ignorieren */ }
  return defaultRoles();
})();
// Kiosk-Modus: dieses Geraet zeigt nur die Kasse (Buchen und Rueckgaengig)
const KIOSK_ALLOWED = ['view.verkauf', 'kasse.book', 'kasse.practice'];
window.kioskActive = (() => { try { return localStorage.getItem('kiosk') === '1'; } catch (e) { return false; } })();
window.roleById = function (id) {
  return window.rolesData.find((r) => r.id === id) || null;
};
// angemeldet = eine Rolle ausser Gast, oder ein persoenliches Konto (das auch nur die Rolle Gast haben kann)
window.isLoggedIn = function () { return 'gast' !== window.currentUserRole || !!window.currentUserName; };
window.can = function (perm, roleId) {
  if (perm === 'view.login') return true;
  if (window.kioskActive && KIOSK_ALLOWED.indexOf(perm) < 0) return false;
  if (!roleId && Array.isArray(window.currentPerms)) return window.currentPerms.indexOf(perm) >= 0;   // persoenliche Anmeldung: Rechte aller Rollen plus Sonderrechte
  roleId = roleId || window.currentUserRole;
  const role = window.roleById(roleId);
  return !!(role && role.perms.indexOf(perm) >= 0);
};
window.canAny = function (perms) {
  return perms.some((p) => window.can(p));
};
window.canEditInventarStructure = function () {
  return window.canAny(['inventar.addItem', 'inventar.deleteItem', 'inventar.moveItem', 'inventar.catAdd', 'inventar.catEdit', 'inventar.catDelete', 'inventar.editName']);
};
const DEFAULT_STATUSES_STANDARD = ['Offen', 'Vorbereitet', 'Verteilt', 'Erledigt'];
const DEFAULT_STATUSES_EINKAUF = ['Offen', 'Vorbereitet', 'Verteilt', 'Eingekauft'];
const PUNSCH_BECHER_LITER = 0.2;

const VIEW_IDS = {
  aushang: 'viewAushang',
  login: 'viewLogin',
  status: 'viewStatus',
  protokoll: 'viewProtokoll',
  inventar: 'viewInventar',
  verkauf: 'viewVerkauf',
  kasse: 'viewVerkauf',
  statistik: 'viewStatistik',
  einkaufsliste: 'viewEinkaufsliste',
  verkabelung: 'viewVerkabelung',
  lagerbestand: 'viewLagerbestand',
  boxen: 'viewBoxenuebersicht',
  rezepte: 'viewRezepte',
  admin: 'viewAdminpanel',
  aufbau: 'viewAufbau'
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
// Wer macht die Aenderung? (steht im Aenderungsprotokoll; Angabe des Geraets, nicht ueberprueft)
function actorInfo() {
  const def = window.roleById ? window.roleById(window.currentUserRole) : null;
  const top = window.currentUserRole === 'gast' ? 'Gast' : (def ? def.name : window.currentUserRole);
  let name = window.currentUserName || '';
  if (!name) { try { name = localStorage.getItem('signupName') || ''; } catch (e) { name = ''; } }
  return { n: name, r: top, d: String(typeof DEVICE_ID === 'undefined' ? '' : DEVICE_ID).slice(0, 12) };
}
// --- Sammelabfrage beim Start: eine Anfrage statt vieler einzelner ---
// Die Antwort wird kurz vorgehalten; die bekannten Einzelabfragen (Rollen, Kasse, Inventar, Listen, eigene Rechte)
// bekommen ihre Daten daraus, statt einzeln ins Netz zu gehen. Geht es schief, laufen die Einzelabfragen wie bisher.
let primed = {};
let primeInflight = null;
let primeLastAt = 0;
let noStartApi = false;
let primeEpoch = 0;   // zaehlt Schreibvorgaenge: eine Startantwort, die davor losging, ist veraltet
window.startTiming = null;
const PRIMABLE = { roles: 1, kasse: 1, inventar: 1, list: 1, me: 1 };
function primeKey(action, params) {
  return action + '|' + ((params && (params.name || params.token)) || '');
}
async function takePrimed(action, params) {
  if (!PRIMABLE[action]) return undefined;
  if (primeInflight) await Promise.race([primeInflight, new Promise((r) => setTimeout(r, 12000))]);
  const k = primeKey(action, params);
  const e = primed[k];
  if (!e) return undefined;
  delete primed[k];
  return Date.now() - e.t < 15000 ? e.data : undefined;
}
window.primeStart = function () {
  if (primeInflight || noStartApi || Date.now() - primeLastAt < 4000) return primeInflight;
  primeLastAt = Date.now();
  const t0 = Date.now();
  const epoch = primeEpoch;
  const token = window.session && window.session.token;
  primeInflight = (async () => {
    try {
      const qs = new URLSearchParams(Object.assign({ action: 'start' }, token ? { token: token } : {}));
      const res = await fetch(GOOGLE_SCRIPT_URL + '?' + qs.toString(), { cache: 'no-store' });
      const r = res.ok ? await res.json() : null;
      if (epoch !== primeEpoch) return;   // dazwischen wurde gespeichert: Antwort ist veraltet
      if (!r || r.status !== 'success' || !r.lists) { noStartApi = true; return; }   // altes Script: Einzelabfragen wie bisher
      const t = Date.now();
      primed[primeKey('roles')] = { t: t, data: { roles: r.roles } };
      primed[primeKey('kasse')] = { t: t, data: r.kasse };
      primed[primeKey('inventar')] = { t: t, data: { state: r.inventar } };
      Object.keys(r.lists).forEach((n) => { primed[primeKey('list', { name: n })] = { t: t, data: { items: r.lists[n] } }; });
      if (token && r.me) primed[primeKey('me', { token: token })] = { t: t, data: r.me };
      window.startTiming = { ms: Date.now() - t0 };
      updateNavVersion();
    } catch (e) { /* egal: die Einzelabfragen folgen */ } finally { primeInflight = null; }
  })();
  return primeInflight;
};
async function getFromSheets(action, params) {
  const pr = await takePrimed(action, params);
  if (pr !== undefined) {
    if (pr && pr.status !== 'error') markSync(params && params.name ? action + ':' + params.name : action);
    return pr && pr.status === 'error' ? null : pr;
  }
  try {
    const qs = new URLSearchParams(Object.assign({ action: action }, params || {}));
    const res = await fetch(GOOGLE_SCRIPT_URL + '?' + qs.toString(), { cache: 'no-store' });
    if (!res.ok) return null;
    const data = await res.json();
    if (data && data.status !== 'error') markSync(params && params.name ? action + ':' + params.name : action);
    return data && data.status === 'error' ? null : data;
  } catch (e) {
    return null;
  }
}
// Gibt { ok, verified } zurueck. Alle Schreibvorgaenge sind so gebaut, dass
// doppeltes Senden unschaedlich ist (immer kompletter Zustand, keine Zaehler-Deltas).
async function postToSheets(payload) {
  primed = {};   // nach jedem Schreiben zaehlt die vorgehaltene Startantwort nicht mehr
  primeEpoch++;
  const body = JSON.stringify(Object.assign({ actor: actorInfo() }, payload));
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

// Wie postToSheets, liefert aber die Antwort des Scripts (oder null ohne Verbindung)
// Antwort des Scripts samt Fehlerantwort (getFromSheets wirft Fehlerantworten weg)
async function getJson(action, params) {
  const pr = await takePrimed(action, params);
  if (pr !== undefined) return pr;
  try {
    const qs = new URLSearchParams(Object.assign({ action: action }, params || {}));
    const res = await fetch(GOOGLE_SCRIPT_URL + '?' + qs.toString(), { cache: 'no-store' });
    if (!res.ok) return null;
    return await res.json();
  } catch (e) {
    return null;
  }
}
async function postJson(payload) {
  primed = {};
  primeEpoch++;
  try {
    const res = await fetch(GOOGLE_SCRIPT_URL, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify(Object.assign({ actor: actorInfo() }, payload)) });
    if (!res.ok) return null;
    return await res.json();
  } catch (e) {
    return null;
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
      } else if (type === 'checklist') {
        const sel = {};
        (f.value || []).forEach((v) => { sel[v] = true; });
        const cbs = {};
        const list = mk('div', { class: 'space-y-1' });
        (f.options || []).forEach((o) => {
          const cb = mk('input', { type: 'checkbox', class: 'w-5 h-5 mt-0.5 shrink-0 accent-amber-500', checked: !!sel[o.value] });
          cbs[o.value] = cb;
          list.appendChild(mk('label', { class: 'flex items-start gap-3 py-1 text-sm text-slate-800 dark:text-slate-100 cursor-pointer' }, [
            cb,
            mk('span', {}, [mk('span', { text: o.label, class: 'font-semibold' }), o.hint ? mk('span', { class: 'block text-[11px] text-slate-500 dark:text-slate-400', text: o.hint }) : null])
          ]));
        });
        if (!(f.options || []).length) list.appendChild(mk('div', { class: 'text-[11px] text-slate-500 dark:text-slate-400', text: f.empty || 'Nichts vorhanden.' }));
        wrap.appendChild(mk('label', { class: labelClass, text: f.label }));
        wrap.appendChild(list);
        getters[f.key] = () => Object.keys(cbs).filter((k) => cbs[k].checked);
      } else if (type === 'permissions') {
        // Aufklappbare Gruppen mit Haken je Recht ("n von m")
        const selected = {};
        (f.value || []).forEach((k) => { selected[k] = true; });
        const locked = !!f.locked;
        const holder = mk('div', { class: f.grid ? 'grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3 items-start' : 'space-y-2' });
        const openers = [];
        const boxes = {};
        const counters = {};
        (f.groups || []).forEach((g) => {
          const head = mk('button', { type: 'button', class: 'w-full flex items-center justify-between gap-2 px-3 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-left text-sm font-bold' });
          const arrow = mk('span', { text: '▸', class: 'text-slate-500' });
          const count = mk('span', { class: 'text-xs font-semibold text-slate-500 dark:text-slate-400' });
          head.appendChild(mk('span', { class: 'flex items-center gap-2' }, [arrow, mk('span', { text: g.title })]));
          head.appendChild(count);
          const panel = mk('div', { class: 'hidden pl-2 pr-1 py-1 space-y-1' });
          if (!locked) {
            panel.appendChild(mk('div', { class: 'flex gap-3 pb-1' }, [
              mk('button', { type: 'button', class: 'text-[11px] font-bold underline text-slate-500 dark:text-slate-400', text: 'alle an', on: { click: () => { g.perms.forEach((p) => { boxes[p[0]].checked = true; }); refresh(); } } }),
              mk('button', { type: 'button', class: 'text-[11px] font-bold underline text-slate-500 dark:text-slate-400', text: 'alle aus', on: { click: () => { g.perms.forEach((p) => { if ((f.forced || []).indexOf(p[0]) < 0) boxes[p[0]].checked = false; }); refresh(); } } })
            ]));
          }
          g.perms.forEach((p) => {
            const isForced = (f.forced || []).indexOf(p[0]) >= 0;
            const cb = mk('input', { type: 'checkbox', class: 'w-5 h-5 shrink-0 accent-amber-500', checked: isForced || !!f.lockAll || !!selected[p[0]], disabled: locked || isForced });
            cb.dataset.perm = p[0];
            cb.addEventListener('change', refresh);
            boxes[p[0]] = cb;
            panel.appendChild(mk('label', { class: 'flex items-start gap-3 py-1 text-sm text-slate-800 dark:text-slate-100 cursor-pointer' }, [cb, mk('span', { text: p[1] + (isForced ? ' (immer an)' : '') })]));
          });
          const setOpen = (open) => {
            panel.classList.toggle('hidden', !open);
            arrow.textContent = open ? '▾' : '▸';
          };
          openers.push(setOpen);
          head.addEventListener('click', () => setOpen(panel.classList.contains('hidden')));
          counters[g.id] = { count: count, g: g };
          holder.appendChild(mk('div', { class: 'space-y-1' }, [head, panel]));
        });
        function refresh() {
          Object.keys(counters).forEach((id) => {
            const c = counters[id];
            const n = c.g.perms.filter((p) => boxes[p[0]].checked).length;
            c.count.textContent = '(' + n + ' von ' + c.g.perms.length + ')';
          });
        }
        refresh();
        wrap.appendChild(mk('label', { class: labelClass, text: f.label }));
        if (locked) wrap.appendChild(mk('div', { class: 'text-[11px] text-slate-500 dark:text-slate-400', text: f.lockedText || 'Die Rechte sind gesperrt.' }));
        else if ((f.forced || []).length) wrap.appendChild(mk('div', { class: 'text-[11px] text-slate-500 dark:text-slate-400', text: f.forcedText || '' }));
        wrap.appendChild(mk('div', { class: 'flex gap-4' }, [
          mk('button', { type: 'button', class: 'text-[11px] font-bold underline text-slate-500 dark:text-slate-400', text: 'alle aufklappen', on: { click: () => openers.forEach((o) => o(true)) } }),
          mk('button', { type: 'button', class: 'text-[11px] font-bold underline text-slate-500 dark:text-slate-400', text: 'alle zuklappen', on: { click: () => openers.forEach((o) => o(false)) } })
        ]));
        wrap.appendChild(holder);
        getters[f.key] = () => Object.keys(boxes).filter((k) => boxes[k].checked);
      } else if (type === 'textarea') {
        const ta = mk('textarea', { class: inputBase + ' min-h-[7rem]', rows: '5', placeholder: f.placeholder || '' });
        ta.value = f.value === undefined ? '' : String(f.value);
        if (f.maxlength) ta.setAttribute('maxlength', String(f.maxlength));
        wrap.appendChild(mk('label', { class: labelClass, text: f.label }));
        wrap.appendChild(ta);
        getters[f.key] = () => ta.value;
        if (!firstInput) firstInput = ta;
      } else if (type === 'file') {
        const fi = mk('input', { type: 'file', class: 'block w-full text-xs text-slate-500 dark:text-slate-400 cursor-pointer' });
        if (f.accept) fi.setAttribute('accept', f.accept);
        wrap.appendChild(mk('label', { class: labelClass, text: f.label }));
        wrap.appendChild(fi);
        getters[f.key] = () => (fi.files && fi.files[0]) || null;
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
        if (f.required && (v === null || (typeof v === 'string' && !v.trim()))) err = (f.type === 'file') ? 'Bitte auswählen.' : 'Bitte ausfüllen.';
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
      class: 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 rounded-2xl p-6 w-full ' + (opts.full ? 'max-w-[96vw]' : (opts.wide ? 'max-w-lg' : 'max-w-md')) + ' max-h-[90vh] overflow-y-auto space-y-4 shadow-2xl border border-slate-200 dark:border-slate-800'
    }, [
      mk('h3', { class: 'font-extrabold text-base', text: opts.title || '' }),
      opts.message ? mk('p', { class: 'text-sm text-slate-600 dark:text-slate-300 leading-relaxed whitespace-pre-line', text: opts.message }) : null,
      fields.length ? body : null,
      mk('div', { class: 'flex flex-wrap justify-end gap-2 pt-2' }, (opts.extraButtons || []).map((b) => mk('button', {
        type: 'button',
        class: 'mr-auto px-4 py-2.5 text-xs font-bold rounded-xl transition ' + (b.danger ? 'bg-rose-500/10 text-rose-500 border border-rose-500/30' : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200'),
        text: b.text,
        data: { act: b.value },
        on: { click: () => finish({ __action: b.value }) }
      })).concat([
        mk('button', { type: 'button', class: 'px-4 py-2.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold rounded-xl transition', text: opts.cancelText || 'Abbrechen', data: { act: 'cancel' }, on: { click: () => finish(null) } }),
        mk('button', { type: 'button', class: 'px-5 py-2.5 font-extrabold text-xs rounded-xl shadow transition ' + okClass, text: opts.okText || 'OK', data: { act: 'ok' }, on: { click: submit } })
      ]))
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
if (!window.roleById(savedRole)) savedRole = 'gast';
window.currentUserRole = savedRole;
window.session = lsGet('session4', null) || { token: '', user: '' };
window.currentUserName = window.session.user || '';
window.currentPerms = window.session.user && Array.isArray(window.session.perms) ? window.session.perms.slice() : null;
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

// Kasse (Zaehler zaehlen nur noch einmal im Sheet; dieses Geraet sendet seine Buchungen einzeln)
function pickCounts(src) {
  const c = {};
  KASSE_DAYS.forEach((d) => KASSE_PRODUCTS.forEach((p) => KASSE_TYPES.forEach((t) => { c[d + '_' + p + '_' + t] = 0; })));
  Object.keys(src || {}).forEach((k) => { if (COUNT_KEY_RE.test(k)) c[k] = Math.max(0, parseInt(src[k], 10) || 0); });
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
  cfg.closed = {};
  KASSE_DAYS.forEach((d) => {
    const c = src && src.closed && src.closed[d];
    cfg.closed[d] = c && Number(c.ts) > 0 ? { ts: Number(c.ts), by: String(c.by || '') } : null;
  });
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
// Gemeinsamer Zaehler: Stand vom Server + noch nicht gesendete Buchungen dieses Geraets
let kasseBase = lsGet('kasse4Base', null) || { counts: {} };
let kasseOps = lsGet('kasse4Ops', []);
if (!Array.isArray(kasseOps)) kasseOps = [];
['kasse3Mine', 'kasse3Cfg', 'kasse3Patch', 'kasse3Others', 'kasse3Ver', 'kasse3Sent'].forEach((k) => {
  if (k === 'kasse3Cfg' || k === 'kasse3Patch') return;
  localStorage.removeItem(k);   // Altlast: Zaehler je Geraet
});
window.kasseEditMode = false;
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
function permLabelOf(key) {
  for (const g of PERMISSION_GROUPS) {
    const e = g.perms.find((x) => x[0] === key);
    if (e) return e[1];
  }
  return '';
}
window.switchView = function (viewName) {
  if (viewName === 'kasse') viewName = 'verkauf';
  if (window.kioskActive) viewName = 'verkauf';
  const targetId = VIEW_IDS[viewName];
  if (!targetId) return;
  if (!window.can('view.' + viewName)) {
    notify(!window.isLoggedIn()
      ? 'Bitte melde dich an, um auf diesen Bereich zuzugreifen.'
      : 'Für diesen Bereich fehlt dir die Berechtigung' + (permLabelOf('view.' + viewName) ? ' (' + permLabelOf('view.' + viewName) + ')' : '') + '.');
    return;
  }
  document.querySelectorAll('main > div[id^="view"]').forEach((v) => v.classList.add('hidden'));
  const target = document.getElementById(targetId);
  if (target) target.classList.remove('hidden');
  window.currentView = viewName;
  updateNavActive();

  if (viewName === 'aushang') {
    window.renderAushangImages();
    renderAushangLists();
    window.pullAushang();
  } else if (viewName === 'inventar') {
    window.renderInventar();
    window.syncInventar();
  } else if (viewName === 'verkauf') {
    window.renderKasse();
    window.syncKasse();
    kassensturzStore.sync();
  } else if (viewName === 'statistik') {
    window.renderStatistik();
    window.syncKasse();
    expenseStore.sync();
    window.loadHourly();
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
  } else if (viewName === 'aufbau') {
    renderAufbau();
    window.syncAufbau();
  } else if (viewName === 'verkabelung') {
    renderVerkabelung();
    window.syncInventar();
    stromStore.sync();
  } else if (viewName === 'rezepte') {
    renderRezepte();
    rezepteStore.sync();
  } else if (viewName === 'status') {
    renderStatus();
    window.runStatusCheck();
  } else if (viewName === 'protokoll') {
    window.loadProtokoll(true);
  } else if (viewName === 'login') {
    renderLogin();
    window.refreshRoles();
  } else if (viewName === 'admin') {
    renderAdmin();
    window.syncKasse();
    produkteStore.sync();
    if (window.adminTab !== 'verwaltung') loadAccessData();
    loadBackups();
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

// Anmeldung: das Script prueft das Passwort und gibt eine Sitzung zurueck
async function loginWith(payload, errorId) {
  const showError = (text) => {
    const box = document.getElementById('loginErrorMessage');
    if (box) box.classList.toggle('hidden', !text);
    if (text) setText('loginErrorText', text);
  };
  showError('');
  const res = await postJson(Object.assign({ action: 'login' }, payload));
  if (!res) {
    showError('Keine Verbindung. Zum Anmelden wird Internet gebraucht.');
    return false;
  }
  if (res.status !== 'success') {
    showError(res.message || 'Falsche Anmeldedaten.');
    return false;
  }
  window.session = { token: res.token, user: res.user || '', roles: res.roles || [], perms: res.user ? res.perms : [] };
  lsSet('session4', window.session);
  if (!window.roleById(res.role.id)) window.rolesData.push({ id: res.role.id, name: res.role.name, desc: '', perms: res.perms, hasPw: true, builtin: false });
  window.setRole(res.role.id, { user: res.user || '', perms: res.perms });
  window.refreshRoles();
  return true;
}
window.tryLogin = async function (role, inputId) {
  const input = document.getElementById(inputId);
  const ok = await loginWith({ kind: 'role', role: role, password: input ? input.value : '' });
  if (ok && input) input.value = '';
};
window.tryUserLogin = async function () {
  const nameEl = document.getElementById('loginUserName');
  const pwEl = document.getElementById('loginUserPw');
  const ok = await loginWith({ kind: 'user', name: nameEl ? nameEl.value : '', password: pwEl ? pwEl.value : '' });
  if (ok) {
    if (nameEl) nameEl.value = '';
    if (pwEl) pwEl.value = '';
  }
};
window.logout = function () {
  if (window.session && window.session.token) postJson({ action: 'logout', token: window.session.token });
  window.session = { token: '', user: '' };
  lsSet('session4', window.session);
  window.currentUserName = '';
  window.setRole('gast');
};
window.setRole = function (role, opts) {
  if (role === 'betrachter') role = 'gast';
  if (!window.roleById(role)) role = 'gast';
  opts = opts || {};
  window.currentUserRole = role;
  window.currentPerms = opts.user && Array.isArray(opts.perms) ? opts.perms.slice() : null;
  window.currentUserName = opts.user ? opts.user : '';
  if (role === 'gast' && !opts.user) {
    if (window.session && window.session.token) {
      window.session = { token: '', user: '' };
      lsSet('session4', window.session);
    }
  } else if (!opts.user && window.session && window.session.user) {
    window.session = { token: window.session.token, user: '' };
    lsSet('session4', window.session);
  }
  localStorage.setItem('userRole', role);
  window.applyRolePermissions(role);
  if (window.isLoggedIn()) {
    window.primeStart();
    window.syncKasse();
    window.syncInventar();
    produkteStore.sync();
    rezepteStore.sync();
    window.ensureBoxMigration();
  }
};
// Rollen und die eigenen Rechte (Rollen + Sonderrechte) vom Script holen: alle Geraete sehen dasselbe
window.refreshRoles = async function () {
  const res = await getFromSheets('roles');
  if (!res || !validRoles(res.roles)) return false;
  window.rolesData = sortRoles(res.roles);
  lsSet('rolesData4', window.rolesData);
  const gone = (text) => {
    window.logout();
    notify(text);
    return true;
  };
  const hasUser = !!(window.session && window.session.user);
  if (!hasUser && !window.roleById(window.currentUserRole)) return gone('Deine Rolle wurde gelöscht. Du bist jetzt Gast.');
  if (window.session && window.session.token) {
    const me = await getJson('me', { token: window.session.token });
    if (me && me.code === 'auth') return gone('Deine Anmeldung ist nicht mehr gültig. Du bist jetzt Gast.');
    if (me && me.status === 'success' && hasUser) {
      if (me.role.id === 'gast' && window.currentUserRole !== 'gast') return gone('Deine Rolle wurde gelöscht. Du bist jetzt Gast.');
      window.session.perms = me.perms;
      window.session.roles = me.roles;
      lsSet('session4', window.session);
      window.currentPerms = me.perms.slice();
      window.currentUserRole = me.role.id;
      window.currentUserName = me.user;
      localStorage.setItem('userRole', me.role.id);
    }
  }
  if (!window.roleById(window.currentUserRole)) return gone('Deine Rolle wurde gelöscht. Du bist jetzt Gast.');
  window.applyPermissionUi();
  if (window.currentView && !window.can('view.' + window.currentView)) window.switchView('aushang');
  else if (window.currentView === 'admin') renderAdmin();
  else if (window.currentView === 'login') renderLogin();
  else refreshCurrentView(false);
  return true;
};
const ROLE_BTN = { helfer: 'bg-amber-500 hover:bg-amber-600 text-slate-950', orga: 'bg-sky-500 hover:bg-sky-600 text-white', admin: 'bg-purple-600 hover:bg-purple-700 text-white' };
function renderLogin() {
  const box = document.getElementById('loginRoleCards');
  if (!box) return;
  const cardBase = 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-3 shadow-sm flex flex-col gap-2 text-center';
  const inputCls = 'w-full px-2 py-1.5 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:border-amber-500';
  box.innerHTML = window.rolesData.map((r) => {
    const head = `<div class="text-2xl leading-none">${roleIcon(r.id)}</div><div><h3 class="font-bold text-xs text-slate-800 dark:text-slate-100">${escapeHtml(r.name)}</h3><p class="text-[10px] text-slate-500 dark:text-slate-400 leading-snug">${escapeHtml(r.desc || '')}</p></div>`;
    if (r.id === 'gast') return `<div class="${cardBase}">${head}<div class="mt-auto"><button type="button" onclick="setRole('gast')" class="w-full py-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold rounded-lg">Als Gast ansehen</button></div></div>`;
    if (!r.hasPw) return '';
    return `<div class="${cardBase}">${head}<div class="space-y-1.5 mt-auto"><input type="password" id="pw_${escapeHtml(r.id)}" placeholder="Passwort" autocomplete="off" class="${inputCls}" /><button type="button" onclick="tryLogin('${escapeHtml(r.id)}', 'pw_${escapeHtml(r.id)}')" class="w-full py-1.5 ${ROLE_BTN[r.id] || 'bg-emerald-600 hover:bg-emerald-700 text-white'} text-xs font-bold rounded-lg transition-colors">Anmelden</button></div></div>`;
  }).join('');
  const st = document.getElementById('loginStatus');
  if (st) {
    const loggedIn = window.isLoggedIn();
    st.classList.toggle('hidden', !loggedIn);
    const def = window.roleById(window.currentUserRole);
    setText('loginStatusText', 'Angemeldet als ' + (window.currentUserName ? window.currentUserName + ' (' : '') + (def ? def.name : '') + (window.currentUserName ? ')' : ''));
  }
}
window.renderLogin = renderLogin;
function navViewOf(btn) {
  const m = /switchView\('([a-z]+)'\)/.exec(btn.getAttribute('onclick') || '');
  return m ? (m[1] === 'kasse' ? 'verkauf' : m[1]) : '';
}
function applyNavPermissions() {
  document.querySelectorAll('#navigationModal nav button').forEach((btn) => {
    const v = navViewOf(btn);
    if (v) btn.classList.toggle('hidden', !window.can('view.' + v));
  });
  // Gruppen ohne sichtbaren Eintrag ausblenden
  document.querySelectorAll('#navigationModal [data-nav-group]').forEach((g) => {
    const any = Array.prototype.some.call(g.querySelectorAll('button'), (b) => !b.classList.contains('hidden'));
    g.classList.toggle('hidden', !any);
  });
  applyNavCollapsed();
  updateNavActive();
}
// Aktuelle Seite im Menue markieren
function navCollapsedList() {
  const l = lsGet('navCollapsed', []);
  return Array.isArray(l) ? l : [];
}
function applyNavCollapsed() {
  const list = navCollapsedList();
  document.querySelectorAll('#navigationModal [data-nav-group]').forEach((g) => {
    const coll = list.indexOf(g.getAttribute('data-nav-group')) >= 0;
    const items = g.querySelector('[data-nav-items]');
    if (items) items.classList.toggle('hidden', coll);
    const ch = g.querySelector('[data-nav-chev]');
    if (ch) ch.innerText = coll ? '▸' : '▾';
    const head = g.querySelector('[data-nav-head]');
    if (head) head.setAttribute('aria-expanded', coll ? 'false' : 'true');
  });
}
window.toggleNavGroup = function (head) {
  const g = head && head.closest ? head.closest('[data-nav-group]') : null;
  if (!g) return;
  const name = g.getAttribute('data-nav-group');
  const list = navCollapsedList();
  const at = list.indexOf(name);
  if (at >= 0) list.splice(at, 1); else list.push(name);
  lsSet('navCollapsed', list);
  applyNavCollapsed();
};
function updateNavActive() {
  document.querySelectorAll('#navigationModal nav button').forEach((btn) => {
    const on = navViewOf(btn) === window.currentView;
    if (on && btn.closest) {
      const grp = btn.closest('[data-nav-group]');
      const name = grp ? grp.getAttribute('data-nav-group') : '';
      const list = navCollapsedList();
      if (name && list.indexOf(name) >= 0) { lsSet('navCollapsed', list.filter((x) => x !== name)); applyNavCollapsed(); }
    }
    ['bg-amber-500/15', 'text-amber-700', 'dark:text-amber-300', 'ring-1', 'ring-amber-500/40'].forEach((c) => btn.classList.toggle(c, on));
  });
}
// Beschriftungen, Knoepfe und Menue passend zu den Rechten (ohne die Ansicht zu wechseln)
window.applyPermissionUi = function () {
  const role = window.currentUserRole;
  const vis = (id, on) => { const el = document.getElementById(id); if (el) el.classList.toggle('hidden', !on); };
  vis('aushangPrintAll', window.can('aushang.print'));
  vis('aushangPrintHint', window.can('aushang.print'));
  vis('aufbauPrintBtn', window.can('aufbau.print'));
  vis('stromPrintBtn', window.can('strom.print'));
  try { renderAushangLists(); } catch (e) { /* egal */ }
  const isLoggedIn = role !== 'gast' || !!window.currentUserName;
  const def = window.roleById(role);
  const name = def ? def.name : 'Gast';
  const names = window.currentUserName && window.session && Array.isArray(window.session.roles) && window.session.roles.length ? window.session.roles.map((r) => r.name) : [name];
  setText('roleLabel', (isLoggedIn ? String(names[0] || name).toUpperCase() : 'GAST') + (window.currentUserName ? ' · ' + window.currentUserName : ''));
  setText('navUserName', window.currentUserName || (isLoggedIn ? String(names[0] || name) : 'Gast'));
  setText('navUserRole', isLoggedIn ? String(names[0] || name) + (names.length > 1 ? ' (+' + (names.length - 1) + ')' : '') : 'nicht angemeldet');
  const navOut = document.getElementById('navLogoutBtn');
  if (navOut) navOut.classList.toggle('hidden', !isLoggedIn);
  setText('roleIcon', isLoggedIn ? '🔓' : '👁️');

  const burgerBtn = document.getElementById('burgerMenuBtn');
  if (burgerBtn) burgerBtn.classList.toggle('hidden', !isLoggedIn);
  const guestNotice = document.getElementById('guestLockNotice');
  if (guestNotice) guestNotice.classList.toggle('hidden', isLoggedIn);

  const canEdit = window.canEditInventarStructure();
  const editBtn = document.getElementById('adminInventarEditBtn');
  if (editBtn) editBtn.classList.toggle('hidden', !canEdit);
  if (!canEdit) window.isEditMode = false;
  const addBoxBtn = document.getElementById('addBoxBtn');
  if (addBoxBtn) addBoxBtn.classList.toggle('hidden', !window.can('boxen.add'));
  const kasseEdit = document.getElementById('kasseEditBtn');
  if (kasseEdit) kasseEdit.classList.toggle('hidden', !window.can('kasse.correct'));
  if (!window.can('kasse.correct')) window.kasseEditMode = false;

  applyNavPermissions();
  applyKioskUi();
};
window.applyRolePermissions = function (role) {
  window.currentUserRole = role;
  window.applyPermissionUi();
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
  lsSet('kasse4Base', kasseBase);
  lsSet('kasse4Ops', kasseOps);
  lsSet('kasse3Cfg', kasseServerCfg);
  lsSet('kasse3Patch', kassePatch);
}
function newOpId() {
  return 'o' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}
function recomputeKasse() {
  const cfg = currentKasseCfg();
  window.kasseCfg = cfg;
  const ids = kasseProductIds();
  const totals = {};
  KASSE_DAYS.forEach((d) => {
    totals[d] = {};
    ids.forEach((p) => {
      const b = (kasseBase.counts && kasseBase.counts[d] && kasseBase.counts[d][p]) || {};
      totals[d][p] = { paid: Math.max(0, parseInt(b.paid, 10) || 0), free: Math.max(0, parseInt(b.free, 10) || 0) };
    });
  });
  // Eigene, noch nicht gesendete Buchungen sofort dazurechnen (Buchungen aus einer frueheren Schicht zaehlen nicht)
  kasseOps.forEach((op) => {
    if (op.e < cfg.epochs[op.day]) return;
    const c = totals[op.day] && totals[op.day][op.p];
    if (!c) return;
    if (op.set !== undefined) c[op.t] = Math.max(0, op.set);
    else c[op.t] = Math.max(0, c[op.t] + op.d);
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
    const sales = round2(kasseProducts().reduce((s, p) => s + (t[d][p.id] ? t[d][p.id].paid : 0) * productPrice(p, cfg), 0));
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
// Warum klappt das Senden nicht? (kein Internet, altes Script, Fehler im Script)
window.kasseProblem = '';
async function kasseFailed(reply) {
  let text = reply && reply.status === 'error' ? 'Das Google-Script meldet: ' + (reply.message || 'Fehler') + '.' : '';
  const ping = await getJson('ping');
  if (!ping) text = 'Keine Verbindung zum Google-Script. Ist am Stand Internet da?';
  else if (Number(ping.version) < 9) text = 'Das Google-Script ist noch Version ' + ping.version + '. Bitte Code.gs als Version 9 bereitstellen (Bereitstellen, Bereitstellungen verwalten, Neue Version).';
  else if (!text) text = 'Das Google-Script hat nicht wie erwartet geantwortet.';
  window.kasseProblem = text;
  setKasseBadge('offline');
}
window.showKasseStatus = function () {
  const n = kasseOps.length;
  notify((window.kasseProblem ? window.kasseProblem + ' ' : '') + (n ? n + (n === 1 ? ' Buchung ist' : ' Buchungen sind') + ' auf diesem Gerät gespeichert und werden gesendet, sobald es klappt.' : 'Es wartet nichts auf das Senden.'));
  window.syncKasse();
};
function setKasseBadge(state) {
  const styles = {
    loading: ['bg-slate-500/10 text-slate-500 dark:text-slate-300 border-slate-500/30', 'bg-slate-400 animate-pulse', 'Verbinde...'],
    pending: ['bg-sky-500/10 text-sky-600 dark:text-sky-400 border-sky-500/30', 'bg-sky-500 animate-pulse', 'Wird gesendet...'],
    synced: ['bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30', 'bg-emerald-500 animate-pulse', 'Synchronisiert'],
    offline: ['bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30', 'bg-amber-500', (window.kasseProblem && window.kasseProblem.indexOf('Keine Verbindung') !== 0 ? 'Script-Problem' : 'Offline') + ' - lokal gespeichert' + (kasseOps.length ? ' (' + kasseOps.length + (kasseOps.length === 1 ? ' Buchung)' : ' Buchungen)') : '')]
  };
  const s = styles[state] || styles.offline;
  ['kasseSyncBadge', 'statSyncBadge'].forEach((id) => {
    const badge = document.getElementById(id);
    if (!badge) return;
    badge.className = 'text-xs px-3 py-1 rounded-full font-bold border flex items-center gap-1.5 ' + s[0];
    badge.innerHTML = '<span class="w-2.5 h-2.5 rounded-full ' + s[1] + '"></span> ' + s[2];
    badge.style.cursor = 'pointer';
    badge.onclick = window.showKasseStatus;
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
        return kasseFailed(null);
      }
    }
    if (kasseOps.length) {
      const sent = kasseOps.slice();
      const r = await postJson({ action: 'kasseOps', ops: sent });
      if (!r || r.status !== 'success') return kasseFailed(r);
      const done = {};
      sent.forEach((o) => { done[o.id] = true; });
      kasseOps = kasseOps.filter((o) => !done[o.id]);
      if (r.counts) kasseBase.counts = r.counts;
      if (r.closedRejected && r.closedRejected.length) notify(r.closedRejected.length + (r.closedRejected.length === 1 ? ' Buchung wurde' : ' Buchungen wurden') + ' nicht gezählt, weil der Tag inzwischen abgeschlossen ist.');
      if (r.config) kasseServerCfg = normalizeKasseConfig(r.config);
      persistKasse();
    }
    const data = await getFromSheets('kasse');
    if (!data || !data.config) return kasseFailed(null);
    kasseServerCfg = normalizeKasseConfig(data.config);
    if (data.counts && !kasseOps.length) kasseBase.counts = data.counts;
    else if (data.counts) kasseBase.counts = data.counts;
    persistKasse();
    recomputeKasse();
    window.renderKasse();
    window.renderStatistik();
    window.kasseProblem = '';
    markSync('kasse');
    setKasseBadge(kasseOps.length ? 'pending' : 'synced');
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
let kasseLast = null;
let kasseUndoTimer = null;
function pushKasseOp(day, item, type, extra) {
  const cfg = currentKasseCfg();
  kasseOps.push(Object.assign({ id: newOpId(), day: day, p: item, t: type === 'paid' ? 'paid' : 'free', e: cfg.epochs[day] || 0, ts: Date.now() }, extra));
  persistKasse();
  recomputeKasse();
  window.renderKasse();
  window.renderStatistik();
  scheduleKasseSync();
}
function kasseCount(day, item, type) {
  if (window.practiceMode) return practiceCounts[day + '_' + item + '_' + (type === 'paid' ? 'paid' : 'free')] || 0;
  const t = window.kasseTotals[day] && window.kasseTotals[day][item];
  return t ? t[type === 'paid' ? 'paid' : 'free'] : 0;
}
function bookKasse(day, item, type, delta) {
  const key = day + '_' + item + '_' + (type === 'paid' ? 'paid' : 'free');
  if (!isCountKey(key)) return false;
  if (delta < 0 && !(kasseCount(day, item, type) > 0)) return false;
  if (window.practiceMode) {
    practiceCounts[key] = Math.max(0, (practiceCounts[key] || 0) + delta);
    window.renderKasse();
    return true;
  }
  pushKasseOp(day, item, type, { d: delta });
  return true;
}
// Admin: Zahl direkt setzen (Korrektur)
window.setKasseCount = function (item, type, value) {
  if (!window.can('kasse.correct') || window.practiceMode) return;
  const day = window.kasseDay;
  if (dayClosedNow(day)) {
    notify('Der Tag ist abgeschlossen. Erst wieder öffnen, dann korrigieren.');
    window.renderKasse();
    return;
  }
  const key = day + '_' + item + '_' + (type === 'paid' ? 'paid' : 'free');
  if (!isCountKey(key)) return;
  const text = String(value).trim();
  const n = text === '' ? NaN : parseInt(text, 10);
  if (isNaN(n) || n < 0 || n > 100000) {
    notify('Bitte eine ganze Zahl ab 0 eintragen.');
    window.renderKasse();
    return;
  }
  pushKasseOp(day, item, type, { set: n });
};
window.toggleKasseEdit = function () {
  if (!window.can('kasse.correct')) return;
  window.kasseEditMode = !window.kasseEditMode;
  window.renderKasse();
};
function popCount(item, type) {
  const el = document.getElementById('count-' + item + '-' + (type === 'paid' ? 'paid' : 'free'));
  if (!el) return;
  el.classList.remove('kasse-pop');
  void el.offsetWidth;
  el.classList.add('kasse-pop');
  if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate(12);
}
function hideKasseUndo() {
  clearTimeout(kasseUndoTimer);
  const bar = document.getElementById('kasseUndoBar');
  if (bar) bar.classList.add('hidden');
}
function showKasseUndo() {
  const bar = document.getElementById('kasseUndoBar');
  if (!bar || !kasseLast) return;
  const l = kasseLast;
  const prod = kasseProducts().find((x) => x.id === l.item);
  setText('kasseUndoText', (l.delta > 0 ? '+1 ' : '−1 ') + (l.type === 'paid' ? '' : 'Helfer-') + (prod ? prod.short : 'Produkt') + ' gebucht (' + (l.day === 'samstag' ? 'Samstag' : 'Sonntag') + ')');
  bar.classList.remove('hidden');
  clearTimeout(kasseUndoTimer);
  kasseUndoTimer = setTimeout(hideKasseUndo, 8000);
}
window.changeKasseCount = function (item, type, delta) {
  if (!window.can('kasse.book')) return;
  const day = window.kasseDay;
  if (!window.practiceMode && dayClosedNow(day)) {
    notify('Der Tag ist abgeschlossen. Nur ein Administrator kann ihn wieder öffnen.');
    return;
  }
  const key = day + '_' + item + '_' + (type === 'paid' ? 'paid' : 'free');
  if (!isCountKey(key)) return;
  if (delta < 0 && !(kasseCount(day, item, type) > 0)) {
    notify('Hier steht schon 0. Weniger geht nicht.');
    return;
  }
  if (!bookKasse(day, item, type, delta)) return;
  popCount(item, type);
  kasseLast = { day: day, item: item, type: type, delta: delta };
  showKasseUndo();
};
// Macht die letzte Buchung dieses Geraets rueckgaengig
window.undoKasse = function () {
  if (!kasseLast || !window.can('kasse.book')) return;
  if (!window.practiceMode && dayClosedNow(kasseLast.day)) {
    hideKasseUndo();
    kasseLast = null;
    notify('Der Tag ist inzwischen abgeschlossen. Rückgängig ist nicht mehr möglich.');
    return;
  }
  const l = kasseLast;
  kasseLast = null;
  hideKasseUndo();
  if (bookKasse(l.day, l.item, l.type, -l.delta)) popCount(l.item, l.type);
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
  persistKasse();
  recomputeKasse();
  window.renderKasse();
  window.renderStatistik();
  scheduleKasseSync();
}
window.setProductPrice = function (id, value) {
  if (!window.can('finance.prices')) return;
  const n = parseEuro(value);
  if (n === null) {
    renderAdmin();
    return;
  }
  if (KASSE_PRODUCTS.indexOf(id) >= 0) {
    const prices = {};
    prices[id] = n;
    applyKassePatch({ prices: prices });
  } else {
    const p = customProducts().find((x) => x.id === id);
    if (p) produkteStore.apply({ op: 'save', item: Object.assign({}, p, { price: n }) });
    refreshProducts();
  }
  renderAdmin();
};
function refreshProducts() {
  recomputeKasse();
  window.renderKasse();
  window.renderStatistik();
  if (window.currentView === 'admin') renderAdmin();
}
async function productForm(title, p, okText) {
  return window.uiForm({
    title: title,
    fields: [
      { key: 'name', label: 'Name', type: 'text', value: p ? p.name : '', required: true, maxlength: 30, placeholder: 'z. B. Bratwurst' },
      { key: 'emoji', label: 'Symbol (ein Emoji)', type: 'text', value: p ? p.emoji : '🛍️', maxlength: 4 },
      { key: 'price', label: 'Preis in €', type: 'text', value: p ? euroInputValue(p.price) : '', required: true, validate: (x) => (parseEuro(x) === null ? 'Bitte einen Preis eintragen.' : '') },
      { key: 'unit', label: 'Einheit', type: 'text', value: p ? p.unit : 'Stück', maxlength: 12, placeholder: 'Stück, Becher, Portion' }
    ],
    okText: okText
  });
}
window.addProduct = async function () {
  if (!window.can('finance.productAdd')) return;
  const custom = customProducts();
  if (custom.length >= 12) {
    notify('Es sind höchstens 12 eigene Produkte möglich.');
    return;
  }
  const v = await productForm('Neues Produkt', null, 'Anlegen');
  if (!v) return;
  const used = custom.map((x) => x.color);
  const color = PRODUCT_COLOR_ORDER.find((c) => used.indexOf(c) < 0) || PRODUCT_COLOR_ORDER[custom.length % PRODUCT_COLOR_ORDER.length];
  produkteStore.apply({ op: 'save', item: { id: newId('p'), name: v.name.trim(), emoji: v.emoji.trim() || '🛍️', unit: v.unit.trim() || 'Stück', price: parseEuro(v.price), color: color } });
  refreshProducts();
  notify('Produkt angelegt. Es steht jetzt in Kasse und Statistik.');
};
window.editProduct = async function (id) {
  if (!window.can('finance.productEdit')) return;
  const p = customProducts().find((x) => x.id === id);
  if (!p) return;
  const v = await productForm('Produkt bearbeiten', p, 'Speichern');
  if (!v) return;
  produkteStore.apply({ op: 'save', item: Object.assign({}, p, { name: v.name.trim(), emoji: v.emoji.trim() || '🛍️', unit: v.unit.trim() || 'Stück', price: parseEuro(v.price) }) });
  refreshProducts();
};
window.deleteProduct = async function (id) {
  if (!window.can('finance.productDelete')) return;
  const p = customProducts().find((x) => x.id === id);
  if (!p) return;
  const sold = KASSE_DAYS.reduce((n, d) => n + ((window.kasseTotals[d] && window.kasseTotals[d][id]) ? window.kasseTotals[d][id].paid + window.kasseTotals[d][id].free : 0), 0);
  const ok = await window.uiConfirm({
    title: 'Produkt löschen?',
    message: '„' + p.name + '“ verschwindet aus Kasse und Statistik.' + (sold > 0 ? ' Bisher gebucht: ' + sold + ' Stück. Der Umsatz dieses Produkts zählt danach nicht mehr mit.' : ''),
    okText: 'Löschen'
  });
  if (!ok) return;
  produkteStore.apply({ op: 'del', id: id });
  refreshProducts();
};
window.saveSpende = function (day, value) {
  if (!window.can('finance.spende') || KASSE_DAYS.indexOf(day) < 0) return;
  const n = parseEuro(value);
  if (n !== null) {
    const spende = {};
    spende[day] = n;
    applyKassePatch({ spende: spende });
  }
  window.renderStatistik(true);
};
window.saveStandgebuehr = function (value) {
  if (!window.can('finance.standgebuehr')) return;
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
  const ok2 = await resetKasseOnServer([day]);
  if (!ok2) notify(window.resetClosed ? 'Der Tag ist abgeschlossen. Bitte zuerst in der Kasse wieder öffnen.' : 'Zurücksetzen nicht möglich: keine Verbindung zum Sheet. Bitte später noch einmal versuchen.');
};
// Setzt die gemeinsamen Zaehler auf 0 (nur online moeglich, damit alle Geraete dasselbe sehen)
async function resetKasseOnServer(days) {
  const r = await postJson({ action: 'kasseReset', days: days });
  window.resetClosed = !!(r && r.code === 'closed');
  if (!r || r.status !== 'success') return false;
  kasseOps = kasseOps.filter((o) => days.indexOf(o.day) < 0);
  kasseBase.counts = r.counts;
  if (r.config) kasseServerCfg = normalizeKasseConfig(r.config);
  persistKasse();
  recomputeKasse();
  window.renderKasse();
  window.renderStatistik();
  if (window.currentView === 'admin') renderAdmin();
  return true;
}
window.saveWaffelnProTeig = function (value) {
  if (!window.can('finance.teig')) return;
  const text = String(value).trim();
  const n = text === '' ? 0 : parseInt(text, 10);
  if (!isNaN(n) && n >= 0 && n <= 1000) applyKassePatch({ waffelnProTeig: n });
  window.renderStatistik(true);
};

// --- Ausgaben (Liste im Sheet) ---
window.addExpense = function () {
  if (!window.can('finance.expenseAdd')) return;
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
  if (!window.can('finance.expenseDelete')) return;
  const item = expenseStore.items().find((e) => e.id === id);
  if (!item) return;
  const ok = await window.uiConfirm({
    title: 'Ausgabe löschen?',
    message: '"' + (item.note || 'ohne Verwendungszweck') + '" (' + formatEuro(item.amount) + ') wird gelöscht.',
    okText: 'Löschen'
  });
  if (!ok) return;
  expenseStore.apply({ op: 'del', id: id });
  if (item.beleg && window.session && window.session.token) postJson({ action: 'imageDelete', token: window.session.token, name: item.beleg });
  window.renderStatistik(true);
};

// --- Produkte: Waffeln und Punsch sind fest eingebaut, weitere legt der Admin an ---
const BUILTIN_PRODUCTS = [
  { id: 'kinderpunsch', name: 'Kinderpunsch', short: 'Punsch', emoji: '☕', unit: 'Becher', color: 'rose', builtin: true },
  { id: 'waffel', name: 'Belgische Waffeln', short: 'Waffeln', emoji: '🧇', unit: 'Stück', color: 'amber', builtin: true }
];
const PRODUCT_COLOR_ORDER = ['emerald', 'sky', 'violet', 'orange', 'teal', 'fuchsia'];
const PRODUCT_COLORS = {
  amber: { border: 'border-amber-400', num: 'text-amber-600 dark:text-amber-400', btn: 'bg-amber-500 hover:bg-amber-400 text-slate-950', bg: 'bg-amber-500/10', tile: 'border-amber-500/40' },
  rose: { border: 'border-rose-400', num: 'text-rose-600 dark:text-rose-400', btn: 'bg-rose-500 hover:bg-rose-400 text-white', bg: 'bg-rose-500/10', tile: 'border-rose-500/40' },
  emerald: { border: 'border-emerald-400', num: 'text-emerald-600 dark:text-emerald-400', btn: 'bg-emerald-500 hover:bg-emerald-400 text-slate-950', bg: 'bg-emerald-500/10', tile: 'border-emerald-500/40' },
  sky: { border: 'border-sky-400', num: 'text-sky-600 dark:text-sky-400', btn: 'bg-sky-500 hover:bg-sky-400 text-white', bg: 'bg-sky-500/10', tile: 'border-sky-500/40' },
  violet: { border: 'border-violet-400', num: 'text-violet-600 dark:text-violet-400', btn: 'bg-violet-500 hover:bg-violet-400 text-white', bg: 'bg-violet-500/10', tile: 'border-violet-500/40' },
  orange: { border: 'border-orange-400', num: 'text-orange-600 dark:text-orange-400', btn: 'bg-orange-500 hover:bg-orange-400 text-slate-950', bg: 'bg-orange-500/10', tile: 'border-orange-500/40' },
  teal: { border: 'border-teal-400', num: 'text-teal-600 dark:text-teal-400', btn: 'bg-teal-500 hover:bg-teal-400 text-slate-950', bg: 'bg-teal-500/10', tile: 'border-teal-500/40' },
  fuchsia: { border: 'border-fuchsia-400', num: 'text-fuchsia-600 dark:text-fuchsia-400', btn: 'bg-fuchsia-500 hover:bg-fuchsia-400 text-white', bg: 'bg-fuchsia-500/10', tile: 'border-fuchsia-500/40' }
};
function customProducts() {
  return produkteStore.items().filter((x) => x && /^p[A-Za-z0-9]{2,30}$/.test(x.id));
}
function kasseProducts() {
  return BUILTIN_PRODUCTS.concat(customProducts().map((x) => ({
    id: x.id, name: x.name, short: x.name, emoji: x.emoji || '🛍️', unit: x.unit || 'Stück', color: x.color || 'emerald', price: Number(x.price) || 0, builtin: false
  })));
}
function kasseProductIds() {
  return kasseProducts().map((p) => p.id);
}
function productPrice(p, cfg) {
  return p.builtin ? (cfg.prices[p.id] || 0) : (p.price || 0);
}
function isCountKey(key) {
  const m = COUNT_KEY_RE.exec(key);
  return !!m && kasseProductIds().indexOf(m[2]) >= 0;
}

// --- Darstellung: Kasse ---
function productCardHtml(p, price, edit) {
  const c = PRODUCT_COLORS[p.color] || PRODUCT_COLORS.emerald;
  return `<div class="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 border-t-4 ${c.border} rounded-2xl p-5 shadow-sm space-y-4">
    <div class="flex items-start justify-between gap-3">
      <div class="flex items-center gap-3 min-w-0">
        <span class="text-4xl w-14 h-14 shrink-0 flex items-center justify-center rounded-2xl ${c.bg}">${escapeHtml(p.emoji)}</span>
        <div class="min-w-0">
          <h3 class="font-black text-lg text-slate-900 dark:text-slate-100 truncate">${escapeHtml(p.name)}</h3>
          <div id="price-${p.id}" class="text-sm font-bold ${c.num}">${escapeHtml(formatEuro(price) + ' / ' + p.unit)}</div>
        </div>
      </div>
      <div class="text-right shrink-0">
        <div class="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Verkauft</div>
        ${edit
    ? `<input id="count-${p.id}-paid" type="number" min="0" inputmode="numeric" onchange="setKasseCount('${p.id}', 'paid', this.value)" class="w-28 text-right text-4xl font-black ${c.num} bg-white dark:bg-slate-950 border-2 border-amber-400 rounded-xl px-2 py-1" />`
    : `<div id="count-${p.id}-paid" class="text-5xl font-black ${c.num} leading-none">0</div>`}
      </div>
    </div>
    <button type="button" onclick="changeKasseCount('${p.id}', 'paid', 1)" class="w-full h-16 ${c.btn} rounded-xl font-black text-3xl transition active:scale-95 shadow">+1</button>
    <div class="flex items-center justify-between gap-3 bg-indigo-500/10 border border-indigo-500/30 rounded-xl px-3 py-2">
      <div class="text-xs font-bold text-indigo-600 dark:text-indigo-300">🎁 Helfer: ${edit
    ? `<input id="count-${p.id}-free" type="number" min="0" inputmode="numeric" onchange="setKasseCount('${p.id}', 'free', this.value)" class="w-20 text-right font-black text-base bg-white dark:bg-slate-950 border-2 border-amber-400 rounded-lg px-2 py-0.5" />`
    : `<span id="count-${p.id}-free" class="font-black text-base">0</span>`}</div>
      <div class="flex gap-1.5">
        <button type="button" onclick="changeKasseCount('${p.id}', 'free', -1)" class="w-9 h-9 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 rounded-lg font-black transition active:scale-95">−</button>
        <button type="button" onclick="changeKasseCount('${p.id}', 'free', 1)" class="w-9 h-9 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg font-black transition active:scale-95">+</button>
      </div>
    </div>
  </div>`;
}
window.renderKasse = function () {
  const day = window.kasseDay;
  const totals = window.practiceMode ? practiceTotalsFor(day) : window.kasseTotals[day];
  const cfg = window.kasseCfg;
  if (!totals) return;
  const products = kasseProducts();
  const box = document.getElementById('kasseProducts');
  if (box) {
    // Karten nur neu aufbauen, wenn sich Produkte/Preise aendern (sonst nur Zahlen austauschen)
    const editMode = !!window.kasseEditMode && window.can('kasse.correct');
    const sig = JSON.stringify([editMode, products.map((p) => [p.id, p.name, p.emoji, p.unit, p.color, productPrice(p, cfg)])]);
    if (box.dataset.sig !== sig) {
      box.innerHTML = products.map((p) => productCardHtml(p, productPrice(p, cfg), editMode)).join('');
      box.dataset.sig = sig;
    }
  }
  products.forEach((p) => {
    const t = totals[p.id] || { paid: 0, free: 0 };
    ['paid', 'free'].forEach((ty) => {
      const el = document.getElementById('count-' + p.id + '-' + ty);
      if (el && el.tagName === 'INPUT') {
        if (document.activeElement !== el) el.value = t[ty];
      } else setText('count-' + p.id + '-' + ty, t[ty]);
    });
  });
  const editBtn = document.getElementById('kasseEditBtn');
  if (editBtn) {
    editBtn.classList.toggle('hidden', !window.can('kasse.correct'));
    editBtn.innerText = window.kasseEditMode ? '✓ Fertig' : '✏️ Zahlen korrigieren';
  }
  const active = 'py-3 rounded-xl text-sm font-black bg-amber-500 text-slate-950 shadow transition';
  const inactive = 'py-3 rounded-xl text-sm font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-300/60 dark:hover:bg-slate-800 transition';
  KASSE_DAYS.forEach((d) => {
    const tab = document.getElementById('kasseDayTab' + capDay(d));
    if (tab) tab.className = d === day ? active : inactive;
  });
  const statBtn = document.getElementById('kasseStatistikBtn');
  if (statBtn) statBtn.classList.toggle('hidden', !window.can('view.statistik'));
  renderKasseExtras();
};

// --- Darstellung: Statistik ---
window.renderStatistik = function (force) {
  renderHourly();
  const exCard = document.getElementById('statExportCard');
  if (exCard) exCard.classList.toggle('hidden', !window.can('finance.export'));
  const f = window.getFinance();
  const t = window.kasseTotals;
  const setInput = (id, value, perm) => {
    const el = document.getElementById(id);
    if (!el) return;
    el.disabled = !window.can(perm);
    if (force || document.activeElement !== el) el.value = value;
  };
  KASSE_DAYS.forEach((d) => {
    const cap = capDay(d);
    const c = window.kasseCfg;
    const products = kasseProducts();
    const tiles = document.getElementById('statProducts' + cap);
    if (tiles) {
      tiles.innerHTML = '<div class="grid grid-cols-2 gap-2">' + products.map((p) => {
        const col = PRODUCT_COLORS[p.color] || PRODUCT_COLORS.emerald;
        const paid = t[d][p.id] ? t[d][p.id].paid : 0;
        return `<div class="rounded-xl border ${col.tile} ${col.bg} p-3"><div class="text-[11px] font-bold ${col.num}">${escapeHtml(p.emoji + ' ' + p.short)}</div><div class="text-3xl font-black ${col.num} leading-tight">${paid}<span class="text-xs font-bold ml-1 opacity-70">${escapeHtml(p.unit)}</span></div><div class="text-[11px] font-semibold text-slate-600 dark:text-slate-300">${escapeHtml(formatEuro(paid * productPrice(p, c)))}</div></div>`;
      }).join('') + '</div>';
    }
    setText('statHelfer' + cap, '🎁 Helfer: ' + products.map((p) => p.emoji + ' ' + (t[d][p.id] ? t[d][p.id].free : 0)).join('  ·  '));
    setText('statSales' + cap, formatEuro(f.days[d].sales));
    setInput('statSpende' + cap, euroInputValue(f.days[d].spende), 'finance.spende');
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
  setInput('statWaffelnProTeig', perTeig > 0 ? String(perTeig) : '', 'finance.teig');
  const custom = document.getElementById('statCustomTotals');
  if (custom) {
    custom.innerHTML = customProducts().map((x) => {
      const col = PRODUCT_COLORS[x.color] || PRODUCT_COLORS.emerald;
      const all = KASSE_DAYS.reduce((n, d) => n + (t[d][x.id] ? t[d][x.id].paid + t[d][x.id].free : 0), 0);
      return `<div class="rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 p-4 space-y-1"><div class="text-xs font-bold text-slate-500 dark:text-slate-400">${escapeHtml(x.emoji || '🛍️')} ${escapeHtml(x.name)} gesamt (inkl. Helfer)</div><div class="text-3xl font-black ${col.num}">${all} ${escapeHtml(x.unit || 'Stück')}</div></div>`;
    }).join('');
  }
  setText('statTotalRevenue', formatEuro(f.revenue));
  setInput('statStandgebuehrInput', euroInputValue(f.standgebuehr), 'finance.standgebuehr');
  setText('statExpensesTotal', formatEuro(f.expenses));
  const profitEl = document.getElementById('statProfit');
  if (profitEl) {
    profitEl.innerText = formatEuro(f.profit);
    profitEl.className = 'text-3xl font-black ' + (f.profit >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400');
  }
  ['expenseAmountInput', 'expenseNoteInput'].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.disabled = !window.can('finance.expenseAdd');
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
            ${belegButtonsHtml(e)}
            ${window.can('finance.expenseDelete') ? `<button onclick="deleteExpense('${escapeHtml(e.id)}')" title="Löschen" class="px-2 py-1 bg-rose-500/10 text-rose-500 border border-rose-500/30 rounded-lg font-bold">🗑️</button>` : ''}
          </span>
        </div>`).join('');
  }
};

// ------------------------------------------
// LISTEN im Sheet (Ausgaben, Boxen, Strom, Aufbau, Aushang): jede Aenderung wird einzeln gesendet
// ------------------------------------------
function applyListOp(list, op) {
  const idx = list.findIndex((x) => x.id === op.id);
  const it = idx >= 0 ? list[idx] : null;
  switch (op.op) {
    case 'save': {
      if (!op.item) return list;
      const i = list.findIndex((x) => x.id === op.item.id);
      if (i >= 0) list[i] = op.item;
      else list.push(op.item);
      return list;
    }
    case 'del':
      return list.filter((x) => x.id !== op.id);
    case 'move': {
      if (!it) return list;
      const to = Math.max(0, Math.min(list.length - 1, Math.floor(Number(op.to)) || 0));
      list.splice(idx, 1);
      list.splice(to, 0, it);
      return list;
    }
    case 'addName': {
      if (!it || it.kind !== 'slot' || !op.entry) return list;
      const n = String(op.entry.n || '').trim().slice(0, 40);
      if (!n) return list;
      const fld = op.f === 'aufsicht' ? 'aufsicht' : 'names';
      it[fld] = it[fld] || [];
      if (it[fld].length >= 20 || it[fld].some((e) => e.n.toLowerCase() === n.toLowerCase())) return list;
      it[fld].push({ n: n, d: String(op.entry.d || '').slice(0, 40) });
      return list;
    }
    case 'delName': {
      if (!it || it.kind !== 'slot' || !op.entry) return list;
      const fld = op.f === 'aufsicht' ? 'aufsicht' : 'names';
      const n = String(op.entry.n || '').toLowerCase();
      const d = String(op.entry.d || '');
      const at = (it[fld] || []).findIndex((e) => e.n.toLowerCase() === n && e.d === d);
      if (at >= 0) it[fld].splice(at, 1);
      return list;
    }
    case 'claim': {
      if (!it || it.kind !== 'teig' || it.name) return list;
      const who = String(op.name || '').trim().slice(0, 40);
      if (who) {
        it.name = who;
        it.d = String(op.d || '').slice(0, 40);
      }
      return list;
    }
    case 'clear':
      if (it && it.kind === 'teig') {
        it.name = '';
        it.d = '';
      }
      return list;
  }
  return list;
}
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
  const store = {
    pendingCount() {
      return pending.length;
    },
    items() {
      let out = clone(base);
      pending.forEach((op) => { out = applyListOp(out, op); });
      return out;
    },
    apply(op) {
      pending.push(op);
      persist();
      if (onChange) onChange();
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
const stromStore = createListStore('strom', () => { if (window.currentView === 'verkabelung') renderVerkabelung(); });
const aufbauStore = createListStore('aufbau', () => { if (window.currentView === 'aufbau') renderAufbau(); });
const produkteStore = createListStore('produkte', () => refreshProducts());
const rezepteStore = createListStore('rezepte', () => { if (window.currentView === 'rezepte') renderRezepte(); });
const kassensturzStore = createListStore('kassensturz', () => { renderSturz(); });
const aushangStore = createListStore('aushang', () => { if (window.currentView === 'aushang') renderAushangLists(); });
window.produkteStore = produkteStore;
window.rezepteStore = rezepteStore;
window.stromStore = stromStore;
window.boxStore = boxStore;
window.aufbauStore = aufbauStore;
window.aushangStore = aushangStore;

// ------------------------------------------
// 5. INVENTAR: lokal zuerst, Aenderungen werden einzeln an Google Sheets gesendet
// Jede Aenderung ist eine kleine Operation (Feld setzen, Eintrag hinzufuegen ...).
// Der Server wendet sie nacheinander auf den gemeinsamen Stand an. So ueberschreiben
// sich mehrere Personen nicht mehr gegenseitig.
// ------------------------------------------
const INV_FIELDS = ['name', 'sub', 'bedarf', 'lager', 'status', 'wer', 'verantwortlich', 'empfaenger', 'pack', 'box', 'einheit', 'packung', 'laden', 'preis', 'einkauf', 'watt', 'wattMax', 'dosen', 'kaufPackungen'];
const INV_NUM_FIELDS = ['bedarf', 'lager', 'preis', 'packung', 'watt', 'wattMax', 'dosen', 'kaufPackungen'];

function invCleanField(field, v) {
  if (INV_NUM_FIELDS.indexOf(field) >= 0) {
    const n = parseFloat(String(v).replace(',', '.'));
    const num = Math.min(1000000, Math.max(0, Math.round((isNaN(n) ? 0 : n) * 100) / 100));
    return field === 'dosen' ? Math.floor(num) : num;
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
  if (!window.canEditInventarStructure()) {
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
// Welches Recht zu welchem Feld gehoert
const INV_FIELD_PERMS = {
  bedarf: ['inventar.editBedarf'], lager: ['inventar.editLager'], status: ['inventar.editStatus'],
  name: ['inventar.editName'], sub: ['inventar.editName'],
  wer: ['inventar.editMeta'], verantwortlich: ['inventar.editMeta'], empfaenger: ['inventar.editMeta'], pack: ['inventar.editMeta'], box: ['inventar.editMeta'],
  einheit: ['inventar.editBedarf', 'einkauf.editPack'],
  packung: ['einkauf.editPack'], preis: ['einkauf.editPreis'], laden: ['einkauf.editLaden'], kaufPackungen: ['einkauf.check'],
  einkauf: ['inventar.cart', 'einkauf.removeItem'],
  watt: ['strom.watt'], wattMax: ['strom.watt'], dosen: ['strom.watt']
};
window.canEditField = function (field) {
  return window.canAny(INV_FIELD_PERMS[field] || ['inventar.editName']);
};
window.updateInventarItem = function (catIdx, itemIdx, field, val) {
  if (!window.canEditField(field)) return;
  const cat = window.inventarData[catIdx];
  const item = cat && cat.items[itemIdx];
  if (!item) return;
  const ops = [{ op: 'set', c: cat.id, i: item.id, f: field, v: val }];
  if (field === 'wer' && item.verantwortlich) ops.push({ op: 'set', c: cat.id, i: item.id, f: 'verantwortlich', v: val });
  invCommit(ops);
};
// --- Bearbeiten: Kategorien und Eintraege (Dialoge statt Browser-Popups) ---
window.addCategory = async function () {
  if (!window.can('inventar.catAdd')) return;
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
  if (!window.can('inventar.catEdit')) return;
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
  if (!window.can('inventar.catDelete')) return;
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
  if (!window.can('inventar.catEdit')) return;
  const cat = window.inventarData[catIdx];
  const to = catIdx + direction;
  if (!cat || to < 0 || to >= window.inventarData.length) return;
  invCommit([{ op: 'moveCat', c: cat.id, to: to }]);
};
window.addItem = async function (catIdx) {
  if (!window.can('inventar.addItem')) return;
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
  if (!window.can('inventar.deleteItem')) return;
  const cat = window.inventarData[catIdx];
  const item = cat && cat.items[itemIdx];
  if (!item) return;
  const ok = await window.uiConfirm({ title: 'Eintrag löschen?', message: '"' + item.name + '" wird gelöscht.', okText: 'Löschen' });
  if (ok) invCommit([{ op: 'delItem', c: cat.id, i: item.id }]);
};
window.moveItem = function (catIdx, itemIdx, direction) {
  if (!window.can('inventar.moveItem')) return;
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

// Box-Namen vergleicht man locker: "3", "Box3" und "box 3" meinen Box 3
function boxKey(name) {
  return String(name || '').toLowerCase().replace(/[^a-z0-9äöüß]/g, '').replace(/^box/, '');
}
function boxSelectHtml(item, ref, disabledAttr, inputBase) {
  const boxes = boxStore.items();
  const cur = String(item.box || '').trim();
  const match = cur ? boxes.find((b) => boxKey(b.name) === boxKey(cur)) : null;
  let opts = '<option value="">–</option>' + boxes.map((b) => `<option value="${escapeHtml(b.name)}" ${match && match.id === b.id ? 'selected' : ''}>${escapeHtml(b.name)}</option>`).join('');
  if (cur && !match) opts += `<option value="${escapeHtml(cur)}" selected>${escapeHtml(cur)} (nicht angelegt)</option>`;
  return `<select ${disabledAttr} onchange="window.updateInventarItem(${ref}, 'box', this.value)" class="w-28 ${inputBase} py-1 px-2 text-xs">${opts}</select>`;
}
function renderItemRow(item, catIdx, itemIdx, cat, edit, readonly) {
  const stock = !window.catNoStock(cat);
  const status = item.status || 'Offen';
  const options = window.getCategoryStatuses(cat).slice();
  if (!options.includes(status)) options.push(status);
  const dis = readonly ? 'disabled' : '';
  const dF = (field) => (window.canEditField(field) ? '' : 'disabled');
  const ref = `${catIdx}, ${itemIdx}`;
  const inputBase = 'bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 focus:border-amber-500 focus:outline-none rounded-md disabled:opacity-60';

  const nameCell = edit && window.can('inventar.editName')
    ? `<input type="text" value="${escapeHtml(item.name)}" placeholder="Name..." onchange="window.updateInventarItem(${ref}, 'name', this.value)" class="w-full font-bold ${inputBase} py-0.5 px-1.5 text-xs mb-1" />
       <input type="text" value="${escapeHtml(item.sub || '')}" placeholder="Beschreibung..." onchange="window.updateInventarItem(${ref}, 'sub', this.value)" class="w-full text-[10px] ${inputBase} py-0.5 px-1.5" />`
    : `<div class="leading-tight font-bold">${escapeHtml(item.name)}${item.sub ? `<div class="text-[10px] font-normal text-slate-500 dark:text-slate-400 mt-0.5">${escapeHtml(item.sub)}</div>` : ''}</div>`;

  const onList = onShoppingList(cat, item);
  const cartBtn = (stock && window.can('inventar.cart'))
    ? `<button type="button" onclick="window.toggleEinkauf(${ref})" title="${onList ? 'Von der Einkaufsliste entfernen' : 'Auf die Einkaufsliste setzen'}" class="shrink-0 w-7 h-7 rounded-lg text-sm border ${onList ? 'bg-orange-500/20 border-orange-500/60' : 'bg-slate-100 dark:bg-slate-800 border-slate-300 dark:border-slate-700 opacity-50 hover:opacity-100'}">🛒</button>`
    : '';
  const actions = edit
    ? `<td class="py-2.5 px-2 text-center" style="text-align:center"><div class="flex items-center justify-center gap-1">
         ${window.can('inventar.moveItem') ? `<button onclick="window.moveItem(${ref}, -1)" ${itemIdx === 0 ? 'disabled' : ''} title="Nach oben" class="p-1 text-[10px] bg-slate-200 dark:bg-slate-800 rounded disabled:opacity-30">⬆️</button>
         <button onclick="window.moveItem(${ref}, 1)" ${itemIdx === cat.items.length - 1 ? 'disabled' : ''} title="Nach unten" class="p-1 text-[10px] bg-slate-200 dark:bg-slate-800 rounded disabled:opacity-30">⬇️</button>` : ''}
         ${window.can('inventar.deleteItem') ? `<button onclick="window.deleteItem(${ref})" title="Löschen" class="p-1 text-[10px] bg-rose-500/20 text-rose-500 border border-rose-500/30 rounded font-bold">🗑️</button>` : ''}
       </div></td>`
    : '';

  return `<tr class="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition">
    <td class="py-2.5 px-4 min-w-[11rem] text-slate-900 dark:text-slate-100" style="text-align:left"><div class="flex items-center gap-2"><div class="min-w-0 flex-1">${nameCell}</div>${cartBtn}</div></td>
    ${stock ? `<td class="py-2.5 px-2 text-center" style="text-align:center"><input type="number" step="any" inputmode="decimal" ${dF('bedarf')} value="${Number(item.bedarf) || 0}" onchange="window.updateInventarItem(${ref}, 'bedarf', this.value)" class="w-16 text-center ${inputBase} py-1 px-1 font-bold" /></td>` : ''}
    ${stock ? `<td class="py-2.5 px-2 text-center" style="text-align:center"><input type="number" step="any" inputmode="decimal" ${dF('lager')} value="${Number(item.lager) || 0}" onchange="window.updateInventarItem(${ref}, 'lager', this.value)" class="w-16 text-center ${inputBase} py-1 px-1 font-black text-emerald-600 dark:text-emerald-400" /></td>` : ''}
    <td class="py-2.5 px-2 text-center" style="text-align:center"><select ${dF('status')} onchange="window.updateInventarItem(${ref}, 'status', this.value)" class="w-full bg-white dark:bg-slate-950 border rounded-md py-1 px-2 text-xs focus:border-amber-500 focus:outline-none disabled:opacity-60 ${statusStyleClass(status)}">
      ${options.map((s) => `<option value="${escapeHtml(s)}" ${s === status ? 'selected' : ''} class="bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100">${escapeHtml(s)}</option>`).join('')}
    </select></td>
    <td class="py-2.5 px-2 text-center" style="text-align:center"><input type="text" ${dF('wer')} value="${escapeHtml(item.wer || item.verantwortlich || '')}" placeholder="Name..." onchange="window.updateInventarItem(${ref}, 'wer', this.value)" class="w-full min-w-[7rem] ${inputBase} py-1 px-2 text-xs" /></td>
    <td class="py-2.5 px-2 text-center" style="text-align:center"><input type="checkbox" ${dF('pack')} ${item.pack ? 'checked' : ''} onchange="window.updateInventarItem(${ref}, 'pack', this.checked)" class="w-4 h-4 accent-amber-500" /></td>
    <td class="py-2.5 px-2 text-center" style="text-align:center">${boxSelectHtml(item, ref, dF('box'), inputBase)}</td>
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

  const readonly = false;
  const edit = window.isEditMode && window.canEditInventarStructure();
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
const DEFAULT_STORES = ['Kruber', 'E-Center', 'REWE', 'Lidl', 'Aldi', 'Penny', 'Netto', 'Kaufland', 'Metro', 'Online', 'Sonstiges'];
const THS = 'py-3 px-3 text-[11px] font-black uppercase tracking-wider text-slate-600 dark:text-slate-300';

function isShoppingCat(cat) {
  return /zutat|einkauf|einkäuf/i.test((cat && cat.title) || '');
}
// Standard: Zutaten und Einkaeufe stehen auf der Liste. Der Warenkorb-Knopf im Inventar kann jeden Artikel
// ausdruecklich hinzufuegen oder wegnehmen.
function onShoppingList(cat, item) {
  return item.einkauf !== undefined ? item.einkauf === true : isShoppingCat(cat);
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
    if (window.catNoStock(cat) && !cat.items.some((i) => i.einkauf === true)) return;
    cat.items.forEach((item, itemIdx) => {
      if (onShoppingList(cat, item)) out.push({ cat: cat, catIdx: catIdx, item: item, itemIdx: itemIdx });
    });
  });
  return out;
}
// Fehlende Menge, benoetigte Packungen (Packungsgroesse in der Einheit des Artikels) und Gesamtpreis.
// Ohne Packungsgroesse gilt der Preis je Einheit.
function calcShopping(item) {
  const missing = Math.max(0, round2((Number(item.bedarf) || 0) - (Number(item.lager) || 0)));
  const size = Number(item.packung) || 0;
  const packs = missing <= 0 ? 0 : (size > 0 ? Math.ceil(missing / size - 1e-9) : missing);
  const done = item.status === 'Eingekauft';
  const shown = done && Number(item.kaufPackungen) > 0 ? Number(item.kaufPackungen) : packs;
  const price = Number(item.preis) || 0;
  return { missing: missing, size: size, packs: packs, shownPacks: shown, price: price, done: done, total: round2(shown * price) };
}
window.shoppingOnlyMissing = false;   // den Filter "Nur Fehlendes" gibt es nicht mehr (die Spalte "Fehlt" zeigt es)
window.toggleEinkauf = function (catIdx, itemIdx, fromList) {
  const cat = window.inventarData[catIdx];
  const item = cat && cat.items[itemIdx];
  if (!item || !window.can(fromList ? 'einkauf.removeItem' : 'inventar.cart')) return;
  window.updateInventarItem(catIdx, itemIdx, 'einkauf', !onShoppingList(cat, item));
};
window.toggleGekauft = function (catIdx, itemIdx, checked) {
  if (!window.can('einkauf.check')) return;
  const cat = window.inventarData[catIdx];
  const item = cat && cat.items[itemIdx];
  if (!item) return;
  const calc = calcShopping(item);
  invCommit([
    { op: 'set', c: cat.id, i: item.id, f: 'status', v: checked ? 'Eingekauft' : 'Offen' },
    { op: 'set', c: cat.id, i: item.id, f: 'kaufPackungen', v: checked ? calc.packs : 0 }
  ]);
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
  if (!window.can('einkauf.addItem')) return;
  const v = await window.uiForm({
    title: 'Artikel zur Einkaufsliste hinzufügen',
    fields: [
      { key: 'name', label: 'Artikel', type: 'text', required: true, maxlength: 200 },
      { key: 'bedarf', label: 'Menge', type: 'text', value: '1' },
      { key: 'einheit', label: 'Einheit (optional)', type: 'text', placeholder: 'z. B. Btl., l, Stk.', maxlength: 12 },
      { key: 'packung', label: 'Packungsgröße (optional)', type: 'text', placeholder: 'z. B. 20', hint: 'Menge pro Packung, in derselben Einheit' },
      { key: 'preis', label: 'Preis je Packung in € (optional)', type: 'text', placeholder: 'z. B. 3,49' },
      { key: 'laden', label: 'Laden (optional)', type: 'select', options: [{ value: '', label: '-- Wählen --' }].concat(storeOptions().map((s) => ({ value: s, label: s }))) }
    ],
    okText: 'Hinzufügen'
  });
  if (!v) return;
  const ops = [];
  const cat = window.inventarData.find((c) => /einkäufe/i.test(c.title));
  let catId;
  if (cat) {
    catId = cat.id;
  } else {
    catId = newId('c');
    ops.push({ op: 'addCat', cat: { id: catId, title: '🧹 EINKÄUFE & VERBRAUCHSMATERIAL' } });
    ops.push({ op: 'editCat', c: catId, noStock: false });
  }
  ops.push({
    op: 'addItem',
    c: catId,
    item: {
      id: newId('i'), name: v.name.trim(), sub: '', bedarf: parseNum(v.bedarf) || 1, lager: 0, status: 'Offen',
      einheit: v.einheit.trim(), packung: parseNum(v.packung), preis: parseNum(v.preis), laden: v.laden, wer: '', pack: false, box: ''
    }
  });
  invCommit(ops);
};

function renderEinkaufsliste() {
  const box = document.getElementById('einkaufslisteContainer');
  if (!box) return;
  const dCheck = window.can('einkauf.check') ? '' : 'disabled';
  const dF2 = (f) => (window.canEditField(f) ? '' : 'disabled');
  const canRemove = window.can('einkauf.removeItem');
  const stores = storeOptions();
  const inputBase = 'bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-600 text-slate-900 dark:text-slate-100 focus:border-amber-500 focus:outline-none rounded-md disabled:opacity-60';
  const entries = shoppingEntries();

  let missingCount = 0;
  let costOpen = 0;
  let costDone = 0;
  entries.forEach((e) => {
    const c = calcShopping(e.item);
    if (c.done) costDone += c.total;
    else {
      if (c.missing > 0) missingCount++;
      costOpen += c.total;
    }
  });
  setText('einkaufCountAll', entries.length);
  setText('einkaufCountMissing', missingCount);
  setText('einkaufCostOpen', formatEuro(round2(costOpen)));
  setText('einkaufCostDone', formatEuro(round2(costDone)));
  setText('einkaufCostTotal', formatEuro(round2(costOpen + costDone)));

  const groups = [];
  entries.forEach((e) => {
    const c = calcShopping(e.item);
    if (window.shoppingOnlyMissing && (c.done || c.missing <= 0)) return;
    let g = groups.find((x) => x.catIdx === e.catIdx);
    if (!g) {
      g = { catIdx: e.catIdx, cat: e.cat, rows: [] };
      groups.push(g);
    }
    g.rows.push({ e: e, c: c });
  });

  const packsText = (n) => (n === 1 ? '1 Packung' : fmtNum(n) + ' Packungen');
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
          <th class="${THS}" style="text-align:center">Packungsgröße</th>
          <th class="${THS}" style="text-align:center">Preis je Packung</th>
          <th class="${THS}" style="text-align:center">Laden</th>
          <th class="${THS}" style="text-align:center">Gesamt</th>
          <th class="${THS}" style="text-align:center"></th>
        </tr>
      </thead>
      <tbody class="divide-y divide-slate-200 dark:divide-slate-800/60">
      ${g.rows.map((r) => {
        const it = r.e.item;
        const c = r.c;
        const ref = r.e.catIdx + ', ' + r.e.itemIdx;
        const shops = stores.slice();
        if (it.laden && shops.indexOf(it.laden) < 0) shops.push(it.laden);
        const fehlt = c.done
          ? `<span class="text-emerald-600 dark:text-emerald-400 font-black">✓ gekauft</span>${c.shownPacks > 0 ? `<div class="text-[10px] text-slate-500 dark:text-slate-400">${escapeHtml(packsText(c.shownPacks))}</div>` : ''}`
          : (c.missing > 0
            ? (c.size > 0
              ? `<span class="font-black text-orange-600 dark:text-orange-400">${escapeHtml(packsText(c.packs))}</span><div class="text-[10px] text-slate-500 dark:text-slate-400">fehlt: ${escapeHtml(fmtQty(c.missing, it.einheit))}</div>`
              : `<span class="font-black text-orange-600 dark:text-orange-400">${escapeHtml(fmtQty(c.missing, it.einheit))}</span>`)
            : '<span class="text-emerald-600 dark:text-emerald-400 font-bold">ok</span>');
        return `<tr class="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition ${c.done ? 'opacity-60' : ''}">
          <td class="py-2.5 px-3" style="text-align:center"><input type="checkbox" ${dCheck} ${c.done ? 'checked' : ''} onchange="window.toggleGekauft(${ref}, this.checked)" class="w-5 h-5 accent-emerald-500" /></td>
          <td class="py-2.5 px-3 font-bold text-slate-900 dark:text-slate-100" style="text-align:left">${escapeHtml(it.name)}${it.sub ? `<div class="text-[10px] font-normal text-slate-500 dark:text-slate-400">${escapeHtml(it.sub)}</div>` : ''}</td>
          <td class="py-2.5 px-3 whitespace-nowrap" style="text-align:center"><input type="number" step="any" inputmode="decimal" ${dF2('bedarf')} value="${Number(it.bedarf) || 0}" onchange="window.updateInventarItem(${ref}, 'bedarf', this.value)" class="w-16 text-center ${inputBase} py-1 px-1 font-bold text-amber-600 dark:text-amber-400" />${it.einheit ? `<span class="ml-1 text-[11px] text-slate-500 dark:text-slate-400">${escapeHtml(it.einheit)}</span>` : ''}</td>
          <td class="py-2.5 px-3" style="text-align:center"><input type="number" step="any" inputmode="decimal" ${dF2('lager')} value="${Number(it.lager) || 0}" onchange="window.updateInventarItem(${ref}, 'lager', this.value)" class="w-16 text-center ${inputBase} py-1 px-1 font-black text-emerald-600 dark:text-emerald-400" /></td>
          <td class="py-2.5 px-3 whitespace-nowrap" style="text-align:center">${fehlt}</td>
          <td class="py-2.5 px-3 whitespace-nowrap" style="text-align:center"><input type="number" step="any" inputmode="decimal" ${dF2('packung')} value="${c.size || ''}" placeholder="–" onchange="window.updateInventarItem(${ref}, 'packung', this.value)" class="w-16 text-center ${inputBase} py-1 px-1" />${it.einheit ? `<span class="ml-1 text-[11px] text-slate-500 dark:text-slate-400">${escapeHtml(it.einheit)}</span>` : ''}</td>
          <td class="py-2.5 px-3 whitespace-nowrap" style="text-align:center"><input type="text" inputmode="decimal" ${dF2('preis')} value="${c.price.toFixed(2).replace('.', ',')}" onchange="window.updateInventarItem(${ref}, 'preis', this.value)" class="w-20 text-right ${inputBase} py-1 px-2 font-bold" /><span class="ml-1 text-slate-500">€</span></td>
          <td class="py-2.5 px-3" style="text-align:center"><select ${dF2('laden')} onchange="window.setItemLaden(${ref}, this.value)" class="w-32 ${inputBase} py-1 px-2 text-xs"><option value="">-- Wählen --</option>${shops.map((s) => `<option value="${escapeHtml(s)}" ${s === it.laden ? 'selected' : ''}>${escapeHtml(s)}</option>`).join('')}<option value="__new__">➕ Anderer Laden…</option></select></td>
          <td class="py-2.5 px-3 whitespace-nowrap font-black text-slate-900 dark:text-slate-100" style="text-align:center">${escapeHtml(formatEuro(c.total))}</td>
          <td class="py-2.5 px-3" style="text-align:center">${canRemove ? `<button type="button" onclick="window.toggleEinkauf(${ref}, true)" title="Von der Einkaufsliste entfernen" class="w-7 h-7 rounded-lg text-xs bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-500 hover:text-rose-500">✕</button>` : ''}</td>
        </tr>`;
      }).join('')}
      </tbody>
    </table>
    </div>
  </div>`).join('') || `<div class="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-8 text-center text-xs text-slate-500 dark:text-slate-400">${window.shoppingOnlyMissing ? 'Es fehlt nichts mehr. 🎉' : 'Noch keine Artikel. Füge oben einen Artikel hinzu oder setze im Inventar mit dem 🛒 Artikel auf die Liste.'}</div>`;
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
  setText('lagerCount', rows.length + ' Artikel auf Lager');
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

// ------------------------------------------
// STROM & VERKABELUNG: Karten per Drag & Drop auf "Stecker" ziehen, alles wird verrechnet
// Verteiler (z. B. 16 A) -> Dosen -> Stecker (Verkabelung + Geraete)
// ------------------------------------------
const STROM_VOLT = 230;
window.stromSelected = null;
window.stromDragging = false;
window.stromNeedsRender = false;

function defaultOutlets(name) {
  const m = /(\d+)\s*er\b/i.exec(name || '');
  return m ? Math.max(1, parseInt(m[1], 10)) : 1;
}
function stromKind(item) {
  return /kabel|mehrfach|steckdosenleiste|verteiler|leiste/i.test(item.name || '') ? 'kabel' : 'geraet';
}
function stromSpecs() {
  const out = {};
  stromStore.items().forEach((x) => { if (x.kind === 'karte') out[x.card] = x; });
  return out;
}
// "2.000" und "1.800" sind Tausenderpunkte, "2,5" ist eine Kommazahl
function parseWatt(v) {
  const t = String(v === undefined || v === null ? '' : v).trim();
  return /^\d{1,3}(\.\d{3})+$/.test(t) ? parseNum(t.replace(/\./g, '')) : parseNum(t);
}
function stromCards() {
  const cards = {};
  const specs = stromSpecs();
  window.inventarData.forEach((cat, catIdx) => {
    if (!/elektrik|licht|geräte/i.test(cat.title)) return;
    cat.items.forEach((item, itemIdx) => {
      const count = Math.floor(Number(item.lager) || 0);
      const kind = stromKind(item);
      for (let n = 1; n <= count; n++) {
        const id = item.id + '~' + n;
        const sp = specs[id] || {};
        cards[id] = {
          id: id, item: item, catIdx: catIdx, itemIdx: itemIdx, n: n, count: count, kind: kind, name: item.name,
          label: item.name + (count > 1 ? ' #' + n : ''),
          variant: sp.variant || '',
          watt: sp.watt > 0 ? sp.watt : (Number(item.watt) || 0),
          rating: kind === 'kabel' ? (sp.wattMax > 0 ? sp.wattMax : (Number(item.wattMax) > 0 ? Number(item.wattMax) : 16 * STROM_VOLT)) : 0,
          outlets: kind === 'kabel' ? (sp.dosen > 0 ? sp.dosen : (Number(item.dosen) > 0 ? Math.floor(Number(item.dosen)) : defaultOutlets(item.name))) : 0
        };
      }
    });
  });
  return cards;
}
function stromConfig() {
  const v = stromStore.items().find((x) => x.id === 'verteiler');
  return { dosen: (v && v.dosen) || 6, ampGesamt: (v && v.ampGesamt) || 16, ampDose: (v && v.ampDose) || 16 };
}
function stromSteckers() {
  return stromStore.items().filter((x) => x.kind === 'stecker');
}
function computeStecker(st, cards, cfg) {
  const kabel = st.kabel.map((id) => cards[id]).filter(Boolean);
  const geraete = st.geraete.map((id) => cards[id]).filter(Boolean);
  const doseLimit = cfg.ampDose * STROM_VOLT;
  const limit = Math.min.apply(null, [doseLimit].concat(kabel.map((c) => c.rating)));
  const load = geraete.reduce((s, c) => s + c.watt, 0);
  const outlets = 1 + kabel.reduce((s, c) => s + Math.max(0, c.outlets - 1), 0);
  let status = 'ok';
  if (load > limit) status = 'over';
  else if (geraete.length > outlets) status = 'outlets';
  else if (load > limit * 0.8) status = 'warn';
  return { kabel: kabel, geraete: geraete, limit: limit, load: load, free: Math.max(0, limit - load), outlets: outlets, used: geraete.length, status: status };
}
function stromModel() {
  const cfg = stromConfig();
  const cards = stromCards();
  const steckers = stromSteckers().map((st) => ({ st: st, calc: computeStecker(st, cards, cfg) }));
  const perDose = {};
  let total = 0;
  steckers.forEach((s) => {
    if (s.st.dose > 0) {
      total += s.calc.load;
      perDose[s.st.dose] = (perDose[s.st.dose] || 0) + s.calc.load;
    }
  });
  const used = {};
  steckers.forEach((s) => s.st.kabel.concat(s.st.geraete).forEach((id) => { used[id] = true; }));
  return { cfg: cfg, cards: cards, steckers: steckers, perDose: perDose, total: total, totalLimit: cfg.ampGesamt * STROM_VOLT, doseLimit: cfg.ampDose * STROM_VOLT, used: used };
}
const STROM_COLORS = { ok: '#22c55e', warn: '#f59e0b', over: '#ef4444', outlets: '#ef4444' };
const STROM_TEXT = { ok: 'in Ordnung', warn: 'fast voll', over: 'ÜBERLASTET', outlets: 'zu wenig Steckplätze' };

// --- Karten verschieben ---
window.movePlanCard = function (cardId, zone) {
  if (!window.can('strom.plan')) return false;
  const card = stromCards()[cardId];
  if (!card) return false;
  let field = null;
  let targetId = null;
  if (zone !== 'pool') {
    const parts = String(zone).split(':');
    field = parts[0];
    targetId = parts[1];
    if (field !== (card.kind === 'kabel' ? 'kabel' : 'geraete')) {
      notify(card.kind === 'kabel' ? 'Kabel und Mehrfachstecker gehören ins Feld „Verkabelung“.' : 'Geräte gehören ins Feld „Geräte“.');
      return false;
    }
  }
  const steckers = stromSteckers();
  if (targetId && !steckers.some((s) => s.id === targetId)) return false;
  const changed = {};
  steckers.forEach((st) => {
    ['kabel', 'geraete'].forEach((f) => {
      const i = st[f].indexOf(cardId);
      if (i >= 0) {
        st[f].splice(i, 1);
        changed[st.id] = st;
      }
    });
  });
  if (targetId) {
    const st = steckers.find((s) => s.id === targetId);
    st[field].push(cardId);
    changed[st.id] = st;
  }
  Object.keys(changed).forEach((id) => stromStore.apply({ op: 'save', item: changed[id] }));
  window.stromSelected = null;
  renderVerkabelung();
  return true;
};
window.setStromField = function (catIdx, itemIdx, field, value) {
  if (!window.can('strom.watt')) return;
  window.updateInventarItem(catIdx, itemIdx, field, value);
};
window.saveVerteiler = function () {
  if (!window.can('strom.verteiler')) return;
  const val = (id) => parseNum((document.getElementById(id) || {}).value);
  stromStore.apply({ op: 'save', item: { id: 'verteiler', kind: 'verteiler', dosen: Math.min(24, Math.max(1, Math.floor(val('stromDosen')) || 6)), ampGesamt: Math.min(200, Math.max(1, val('stromAmpGesamt') || 16)), ampDose: Math.min(63, Math.max(1, val('stromAmpDose') || 16)) } });
  renderVerkabelung();
};
window.addStecker = async function () {
  if (!window.can('strom.steckerAdd')) return;
  const cfg = stromConfig();
  const count = stromSteckers().length;
  const v = await window.uiForm({
    title: 'Neuer Stecker',
    message: 'Ein Stecker ist eine Stromleitung ab einer Dose des Verteilers: erst die Verkabelung, dann die Geräte.',
    fields: [
      { key: 'name', label: 'Name', type: 'text', value: 'Stecker ' + (count + 1), required: true, maxlength: 40 },
      { key: 'dose', label: 'Dose am Verteiler', type: 'select', value: '0', options: [{ value: '0', label: 'noch nicht angeschlossen' }].concat(Array.from({ length: cfg.dosen }, (_, i) => ({ value: String(i + 1), label: 'Dose ' + (i + 1) }))) }
    ],
    okText: 'Anlegen'
  });
  if (!v) return;
  stromStore.apply({ op: 'save', item: { id: newId('s'), kind: 'stecker', name: v.name.trim(), dose: parseInt(v.dose, 10) || 0, kabel: [], geraete: [] } });
  renderVerkabelung();
};
window.setSteckerDose = function (id, value) {
  if (!window.can('strom.steckerEdit')) return;
  const st = stromSteckers().find((s) => s.id === id);
  if (!st) return;
  st.dose = parseInt(value, 10) || 0;
  stromStore.apply({ op: 'save', item: st });
  renderVerkabelung();
};
window.editStecker = async function (id) {
  if (!window.can('strom.steckerEdit')) return;
  const st = stromSteckers().find((s) => s.id === id);
  if (!st) return;
  const v = await window.uiForm({ title: 'Stecker umbenennen', fields: [{ key: 'name', label: 'Name', type: 'text', value: st.name, required: true, maxlength: 40 }], okText: 'Speichern' });
  if (!v) return;
  st.name = v.name.trim();
  stromStore.apply({ op: 'save', item: st });
  renderVerkabelung();
};
window.deleteStecker = async function (id) {
  if (!window.can('strom.steckerDelete')) return;
  const st = stromSteckers().find((s) => s.id === id);
  if (!st) return;
  const ok = await window.uiConfirm({ title: 'Stecker löschen?', message: '„' + st.name + '“ wird gelöscht. Die Karten wandern zurück in den Vorrat.', okText: 'Löschen' });
  if (!ok) return;
  stromStore.apply({ op: 'del', id: id });
  renderVerkabelung();
};

// --- Darstellung ---
function fmtW(n) {
  return Math.round(n).toLocaleString('de-DE') + ' W';
}
function cardChip(c, selected) {
  const base = c.kind === 'kabel'
    ? fmtW(c.rating) + (c.outlets > 1 ? ' · ' + c.outlets + ' Plätze' : '')
    : (c.watt > 0 ? fmtW(c.watt) : 'Watt eintragen');
  const info = (c.variant ? c.variant + ' · ' : '') + base;
  const color = c.kind === 'kabel'
    ? 'bg-sky-500/15 border-sky-500/50 text-sky-900 dark:text-sky-100'
    : (c.watt > 0 ? 'bg-amber-500/15 border-amber-500/50 text-amber-900 dark:text-amber-100' : 'bg-rose-500/10 border-rose-500/60 border-dashed text-rose-800 dark:text-rose-200');
  const edit = window.can('strom.watt')
    ? `<button type="button" data-cardedit="${escapeHtml(c.id)}" onclick="window.editCard('${escapeHtml(c.id)}')" title="Watt und Details" class="shrink-0 w-7 h-7 rounded-md bg-white/70 dark:bg-slate-900/60 border border-slate-300/60 dark:border-slate-600/60 text-xs">✎</button>`
    : '';
  return `<div data-card="${escapeHtml(c.id)}" style="touch-action:none" class="stromcard select-none cursor-grab inline-flex items-center gap-2 pl-2.5 pr-1.5 py-1.5 rounded-lg border text-xs leading-tight ${color} ${selected ? 'ring-2 ring-amber-400' : ''}"><span class="flex flex-col"><span class="font-bold">${escapeHtml(c.label)}</span><span class="text-[10px] opacity-80">${escapeHtml(info)}</span></span>${edit}</div>`;
}
// Watt / Belastbarkeit / Steckplaetze fuer genau diese Karte (optional fuer alle gleichen)
window.editCard = async function (cardId) {
  if (!window.can('strom.watt')) return;
  const c = stromCards()[cardId];
  if (!c) return;
  const isKabel = c.kind === 'kabel';
  const fields = [{ key: 'variant', label: 'Bezeichnung / Variante (optional)', type: 'text', value: c.variant, placeholder: 'z. B. altes Modell', maxlength: 30 }];
  if (isKabel) {
    fields.push({ key: 'wattMax', label: 'Belastbarkeit in Watt', type: 'text', value: String(c.rating), validate: (x) => (parseWatt(x) > 0 ? '' : 'Bitte Watt eintragen.') });
    fields.push({ key: 'dosen', label: 'Steckplätze', type: 'text', value: String(c.outlets), validate: (x) => (parseNum(x) >= 1 ? '' : 'Mindestens 1.') });
  } else {
    fields.push({ key: 'watt', label: 'Leistung in Watt', type: 'text', value: c.watt > 0 ? String(c.watt) : '', placeholder: 'z. B. 1000', validate: (x) => (parseWatt(x) > 0 ? '' : 'Bitte Watt eintragen.') });
  }
  if (c.count > 1) fields.push({ key: 'alle', label: 'Werte für alle ' + c.count + ' „' + c.name + '“ übernehmen', type: 'checkbox', value: false });
  const v = await window.uiForm({ title: c.label, fields: fields, okText: 'Speichern' });
  if (!v) return;
  const specs = stromSpecs();
  const targets = Object.keys(stromCards()).map((id) => stromCards()[id]).filter((x) => (v.alle ? x.item.id === c.item.id : x.id === c.id));
  targets.forEach((t) => {
    stromStore.apply({
      op: 'save',
      item: {
        id: 'k_' + t.id.replace('~', '_'), kind: 'karte', card: t.id,
        watt: isKabel ? 0 : parseWatt(v.watt),
        wattMax: isKabel ? parseWatt(v.wattMax) : 0,
        dosen: isKabel ? Math.floor(parseNum(v.dosen)) : 0,
        variant: t.id === c.id ? String(v.variant || '').trim() : ((specs[t.id] && specs[t.id].variant) || '')
      }
    });
  });
  renderVerkabelung();
};
function stromBar(load, limit, status) {
  const pct = limit > 0 ? Math.min(100, Math.round((load / limit) * 100)) : 0;
  return `<div class="h-2 rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden"><div class="h-full" style="width:${pct}%;background:${STROM_COLORS[status]}"></div></div>`;
}
function stromStatusBadge(status) {
  const cls = status === 'ok' ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/30'
    : (status === 'warn' ? 'bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/30' : 'bg-rose-500/10 text-rose-700 dark:text-rose-400 border-rose-500/30');
  return `<span class="px-2 py-0.5 rounded-md text-[11px] font-bold border ${cls}">${STROM_TEXT[status]}</span>`;
}
function stromSketchSvg(model) {
  const W = 1000;
  const perLine = 5;
  const chipW = 128;
  const chipH = 36;
  const gap = 8;
  const startX = 272;
  const rows = model.steckers.map((s) => {
    const chips = s.calc.kabel.map((c) => ({ t: 'k', c: c })).concat(s.calc.geraete.map((c) => ({ t: 'g', c: c })));
    return { s: s, chips: chips, lines: Math.max(1, Math.ceil(chips.length / perLine)) };
  });
  const dosen = model.cfg.dosen;
  const boxH = Math.max(150, dosen * 34 + 70);
  let y = 14;
  rows.forEach((r) => {
    r.y = y;
    r.h = 40 + r.lines * (chipH + 8);
    y += r.h + 14;
  });
  const H = Math.max(boxH + 28, y + 6);
  const doseY = (i) => 62 + (i - 1) * 34;
  const out = [];
  out.push(`<svg viewBox="0 0 ${W} ${H}" width="100%" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Stromplan-Skizze" style="font-family:Arial,Helvetica,sans-serif;color:inherit">`);
  const totalStatus = model.total > model.totalLimit ? 'over' : (model.total > model.totalLimit * 0.8 ? 'warn' : 'ok');
  out.push(`<rect x="10" y="14" width="190" height="${boxH}" rx="10" fill="rgba(148,163,184,0.15)" stroke="rgba(148,163,184,0.8)" stroke-width="2"/>`);
  out.push(`<text x="105" y="36" text-anchor="middle" font-size="14" font-weight="700" fill="currentColor">${escapeHtml(fmtNum(model.cfg.ampGesamt))} A Verteiler</text>`);
  out.push(`<text x="105" y="${boxH - 2}" text-anchor="middle" font-size="12" font-weight="700" fill="${STROM_COLORS[totalStatus]}">${escapeHtml(fmtW(model.total))} / ${escapeHtml(fmtW(model.totalLimit))}</text>`);
  for (let i = 1; i <= dosen; i++) {
    const dl = model.perDose[i] || 0;
    const ds = dl > model.doseLimit ? 'over' : (dl > model.doseLimit * 0.8 ? 'warn' : 'ok');
    out.push(`<circle cx="200" cy="${doseY(i)}" r="13" fill="rgba(148,163,184,0.25)" stroke="${dl > 0 ? STROM_COLORS[ds] : 'rgba(148,163,184,0.9)'}" stroke-width="2.5"/>`);
    out.push(`<text x="200" y="${doseY(i) + 4}" text-anchor="middle" font-size="11" font-weight="700" fill="currentColor">${i}</text>`);
    out.push(`<text x="24" y="${doseY(i) + 4}" font-size="11" fill="currentColor" opacity="0.85">Dose ${i}${dl > 0 ? ': ' + escapeHtml(fmtW(dl)) : ''}</text>`);
  }
  rows.forEach((r) => {
    const st = r.s.st;
    const calc = r.s.calc;
    const col = STROM_COLORS[calc.status];
    const headY = r.y + 20;
    out.push(`<text x="${startX}" y="${headY}" font-size="14" font-weight="700" fill="currentColor">${escapeHtml(st.name)}</text>`);
    out.push(`<text x="${startX + 200}" y="${headY}" font-size="12" font-weight="700" fill="${col}">${escapeHtml(fmtW(calc.load))} / ${escapeHtml(fmtW(calc.limit))} · ${escapeHtml(STROM_TEXT[calc.status])} · Plätze ${calc.used}/${calc.outlets}</text>`);
    const firstChipY = r.y + 32;
    if (st.dose > 0 && st.dose <= dosen) {
      const dy = doseY(st.dose);
      const ly = firstChipY + chipH / 2;
      out.push(`<polyline points="213,${dy} 240,${dy} 240,${ly} ${startX - 6},${ly}" fill="none" stroke="${col}" stroke-width="2.5"/>`);
    } else {
      out.push(`<text x="${startX - 8}" y="${firstChipY + chipH / 2 + 4}" text-anchor="end" font-size="10" fill="#ef4444">nicht angeschlossen</text>`);
    }
    if (!r.chips.length) {
      out.push(`<text x="${startX}" y="${firstChipY + chipH / 2 + 4}" font-size="11" fill="currentColor" opacity="0.6">noch leer</text>`);
    }
    r.chips.forEach((ch, i) => {
      const line = Math.floor(i / perLine);
      const col2 = i % perLine;
      const x = startX + col2 * (chipW + gap);
      const cy = firstChipY + line * (chipH + 8);
      const c = ch.c;
      const isK = ch.t === 'k';
      const noWatt = !isK && c.watt <= 0;
      const fill = isK ? 'rgba(56,189,248,0.18)' : 'rgba(245,158,11,0.18)';
      const stroke = noWatt ? '#ef4444' : (isK ? '#38bdf8' : '#f59e0b');
      if (isK && col2 > 0) out.push(`<line x1="${x - gap}" y1="${cy + chipH / 2}" x2="${x}" y2="${cy + chipH / 2}" stroke="${col}" stroke-width="2.5"/>`);
      const name = c.label.length > 17 ? c.label.slice(0, 16) + '…' : c.label;
      const sub = isK ? fmtW(c.rating) + (c.outlets > 1 ? ' · ' + c.outlets + 'x' : '') : (c.watt > 0 ? fmtW(c.watt) : 'Watt fehlt');
      out.push(`<rect x="${x}" y="${cy}" width="${chipW}" height="${chipH}" rx="8" fill="${fill}" stroke="${stroke}" stroke-width="2"${noWatt ? ' stroke-dasharray="4 3"' : ''}/>`);
      out.push(`<text x="${x + 8}" y="${cy + 15}" font-size="11" font-weight="700" fill="currentColor">${escapeHtml(name)}</text>`);
      out.push(`<text x="${x + 8}" y="${cy + 29}" font-size="10" fill="currentColor" opacity="0.85">${escapeHtml(sub)}</text>`);
    });
  });
  if (!rows.length) {
    out.push(`<text x="${startX}" y="60" font-size="13" fill="currentColor" opacity="0.7">Noch kein Stecker angelegt.</text>`);
  }
  out.push('</svg>');
  return out.join('');
}

function renderVerkabelung() {
  const root = document.getElementById('stromRoot');
  if (!root) return;
  if (window.stromDragging) {
    window.stromNeedsRender = true;
    return;
  }
  const model = stromModel();
  const editable = window.can('strom.plan');
  const canV = window.can('strom.verteiler');
  const canEditSt = window.can('strom.steckerEdit');
  const canDelSt = window.can('strom.steckerDelete');
  const canAddSt = window.can('strom.steckerAdd');
  const cfg = model.cfg;
  const dis = canV ? '' : 'disabled';
  const inputBase = 'bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-600 text-slate-900 dark:text-slate-100 focus:border-amber-500 focus:outline-none rounded-md disabled:opacity-60';
  const totalStatus = model.total > model.totalLimit ? 'over' : (model.total > model.totalLimit * 0.8 ? 'warn' : 'ok');
  const sel = window.stromSelected;
  const cardsAll = Object.keys(model.cards).map((id) => model.cards[id]);
  const poolK = cardsAll.filter((c) => c.kind === 'kabel' && !model.used[c.id]);
  const poolG = cardsAll.filter((c) => c.kind === 'geraet' && !model.used[c.id]);

  const steckerHtml = model.steckers.map((s) => {
    const st = s.st;
    const c = s.calc;
    const doseOpts = ['<option value="0">nicht angeschlossen</option>'].concat(Array.from({ length: cfg.dosen }, (_, i) => `<option value="${i + 1}" ${st.dose === i + 1 ? 'selected' : ''}>Dose ${i + 1}</option>`));
    if (st.dose > cfg.dosen) doseOpts.push(`<option value="${st.dose}" selected>Dose ${st.dose} (fehlt)</option>`);
    const zone = (field, cards, hint) => `<div data-drop="${field}:${escapeHtml(st.id)}" class="dropzone min-h-[3.25rem] flex flex-wrap gap-2 items-center p-2 rounded-xl border-2 border-dashed ${sel ? 'border-amber-400 bg-amber-500/5' : 'border-slate-300 dark:border-slate-700'}">${cards.length ? cards.map((x) => cardChip(x, sel === x.id)).join('') : `<span class="text-[11px] text-slate-400 dark:text-slate-500">${hint}</span>`}</div>`;
    return `<div class="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm p-4 space-y-3">
      <div class="flex flex-wrap items-center justify-between gap-2">
        <div class="font-black text-sm text-slate-900 dark:text-slate-100">🔌 ${escapeHtml(st.name)}</div>
        <div class="flex items-center gap-2">
          <select ${canEditSt ? '' : 'disabled'} onchange="window.setSteckerDose('${escapeHtml(st.id)}', this.value)" class="${inputBase} py-1 px-2 text-xs">${doseOpts.join('')}</select>
          ${canEditSt ? `<button type="button" onclick="window.editStecker('${escapeHtml(st.id)}')" title="Umbenennen" class="w-7 h-7 rounded-lg text-xs bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700">✏️</button>` : ''}${canDelSt ? `<button type="button" onclick="window.deleteStecker('${escapeHtml(st.id)}')" title="Löschen" class="w-7 h-7 rounded-lg text-xs bg-rose-500/10 border border-rose-500/30 text-rose-500">🗑️</button>` : ''}
        </div>
      </div>
      <div class="space-y-1">
        <div class="flex flex-wrap items-center justify-between gap-2 text-[11px] font-bold">
          <span class="text-slate-600 dark:text-slate-300">Belastbar bis <span class="text-slate-900 dark:text-slate-100">${escapeHtml(fmtW(c.limit))}</span> · angeschlossen <span class="text-slate-900 dark:text-slate-100">${escapeHtml(fmtW(c.load))}</span> · frei <span class="text-slate-900 dark:text-slate-100">${escapeHtml(fmtW(c.free))}</span> · Plätze ${c.used}/${c.outlets}</span>
          ${stromStatusBadge(c.status)}
        </div>
        ${stromBar(c.load, c.limit, c.status)}
      </div>
      <div class="space-y-1.5">
        <div class="text-[11px] font-black uppercase tracking-wider text-sky-600 dark:text-sky-400">Verkabelung</div>
        ${zone('kabel', c.kabel, 'Kabel und Mehrfachstecker hierher ziehen')}
        <div class="text-[11px] font-black uppercase tracking-wider text-amber-600 dark:text-amber-400 pt-1">Geräte</div>
        ${zone('geraete', c.geraete, 'Geräte hierher ziehen')}
      </div>
    </div>`;
  }).join('') || '<div class="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-8 text-center text-xs text-slate-500 dark:text-slate-400">Noch kein Stecker angelegt. Lege oben mit „➕ Neuer Stecker“ los.</div>';

  const doseList = Array.from({ length: cfg.dosen }, (_, i) => {
    const l = model.perDose[i + 1] || 0;
    const s = l > model.doseLimit ? 'over' : (l > model.doseLimit * 0.8 ? 'warn' : 'ok');
    return `<div class="rounded-lg border border-slate-200 dark:border-slate-800 p-2 text-[11px]"><div class="font-bold text-slate-700 dark:text-slate-200">Dose ${i + 1}</div><div style="color:${l > 0 ? STROM_COLORS[s] : 'inherit'}" class="font-black">${escapeHtml(fmtW(l))}</div></div>`;
  }).join('');

  root.innerHTML = `
    <div class="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm p-5 space-y-4">
      <div class="flex flex-wrap items-center justify-between gap-3">
        <h3 class="font-black text-base text-slate-900 dark:text-slate-100">🔋 Verteiler</h3>
        <div class="flex flex-wrap items-center gap-3 text-xs font-bold text-slate-600 dark:text-slate-300">
          <label>Dosen <input id="stromDosen" type="number" min="1" max="24" ${dis} value="${cfg.dosen}" onchange="window.saveVerteiler()" class="w-14 text-center ${inputBase} py-1 px-1 ml-1" /></label>
          <label>Gesamt <input id="stromAmpGesamt" type="number" min="1" step="any" ${dis} value="${cfg.ampGesamt}" onchange="window.saveVerteiler()" class="w-16 text-center ${inputBase} py-1 px-1 ml-1" /> A</label>
          <label>je Dose <input id="stromAmpDose" type="number" min="1" step="any" ${dis} value="${cfg.ampDose}" onchange="window.saveVerteiler()" class="w-16 text-center ${inputBase} py-1 px-1 ml-1" /> A</label>
        </div>
      </div>
      <div class="space-y-1">
        <div class="flex flex-wrap items-center justify-between gap-2 text-xs font-bold">
          <span class="text-slate-600 dark:text-slate-300">Belastung gesamt: <span class="text-slate-900 dark:text-slate-100">${escapeHtml(fmtW(model.total))}</span> von ${escapeHtml(fmtW(model.totalLimit))} (${escapeHtml(fmtNum(cfg.ampGesamt))} A × ${STROM_VOLT} V)</span>
          ${stromStatusBadge(totalStatus)}
        </div>
        ${stromBar(model.total, model.totalLimit, totalStatus)}
      </div>
      <div class="grid grid-cols-3 sm:grid-cols-6 gap-2">${doseList}</div>
    </div>

    <div class="grid grid-cols-1 xl:grid-cols-[minmax(0,22rem)_1fr] gap-6 items-start">
      <div class="space-y-4">
        <div data-drop="pool" class="dropzone bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm p-4 space-y-3">
          <div class="font-black text-sm text-slate-900 dark:text-slate-100">📦 Vorrat <span class="text-[11px] font-normal text-slate-500 dark:text-slate-400">(Anzahl = „Lager“ im Inventar)</span></div>
          <div class="text-[11px] font-black uppercase tracking-wider text-sky-600 dark:text-sky-400">Kabel &amp; Mehrfachstecker</div>
          <div class="flex flex-wrap gap-2">${poolK.length ? poolK.map((c) => cardChip(c, sel === c.id)).join('') : '<span class="text-[11px] text-slate-400 dark:text-slate-500">alles verplant</span>'}</div>
          <div class="text-[11px] font-black uppercase tracking-wider text-amber-600 dark:text-amber-400">Geräte</div>
          <div class="flex flex-wrap gap-2">${poolG.length ? poolG.map((c) => cardChip(c, sel === c.id)).join('') : '<span class="text-[11px] text-slate-400 dark:text-slate-500">alles verplant</span>'}</div>
          ${cardsAll.length ? '' : '<div class="text-[11px] text-slate-500 dark:text-slate-400">Noch keine Karten. Trage im Inventar (Elektrik &amp; Licht, Geräte) bei „Lager“ die vorhandenen Stückzahlen ein.</div>'}
          <div class="text-[11px] text-slate-500 dark:text-slate-400">${editable ? 'Karte ziehen oder antippen, dann auf ein Feld tippen. Mit ✎ trägst du Watt und Details für genau diese Karte ein.' : 'Du darfst den Plan ansehen, aber nicht ändern.'}</div>
        </div>
      </div>
      <div class="space-y-4">
        <div class="flex items-center justify-between gap-2">
          <h3 class="font-black text-base text-slate-900 dark:text-slate-100">🔌 Stecker</h3>
          ${canAddSt ? '<button type="button" onclick="window.addStecker()" class="px-3.5 py-2 bg-amber-500 hover:bg-amber-600 text-slate-950 text-xs font-black rounded-xl shadow transition">➕ Neuer Stecker</button>' : ''}
        </div>
        ${steckerHtml}
      </div>
    </div>

    <div class="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm p-5 space-y-3">
      <div class="flex flex-wrap items-center justify-between gap-2">
        <h3 class="font-black text-base text-slate-900 dark:text-slate-100">🗺️ Skizze</h3>
        <button type="button" id="stromPrintBtn" onclick="window.printStromPlan()" class="${window.can('strom.print') ? '' : 'hidden '}px-3.5 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold rounded-xl border border-slate-300 dark:border-slate-700 transition">🖨️ Drucken</button>
      </div>
      <div class="overflow-x-auto text-slate-800 dark:text-slate-100">${stromSketchSvg(model)}</div>
      <div class="text-[11px] text-slate-500 dark:text-slate-400">Grün = in Ordnung, Gelb = über 80 % der Belastbarkeit, Rot = überlastet oder zu wenig Steckplätze. Die Belastbarkeit eines Steckers ist der kleinste Wert aus Dose (${escapeHtml(fmtNum(cfg.ampDose))} A × ${STROM_VOLT} V) und allen Kabeln darin.</div>
    </div>`;
}
window.printStromPlan = function () {
  if (!window.can('strom.print')) { notify('Drucken ist für deine Anmeldung nicht freigegeben.'); return; }
  const model = stromModel();
  const rows = model.steckers.map((s) => `<tr><td>${escapeHtml(s.st.name)}</td><td>${s.st.dose > 0 ? 'Dose ' + s.st.dose : 'nicht angeschlossen'}</td><td>${escapeHtml(s.calc.kabel.map((c) => c.label).join(', ') || '–')}</td><td>${escapeHtml(s.calc.geraete.map((c) => c.label + ' (' + fmtW(c.watt) + ')').join(', ') || '–')}</td><td>${escapeHtml(fmtW(s.calc.load))} / ${escapeHtml(fmtW(s.calc.limit))}</td></tr>`).join('');
  window.printHtml(`<h1>Stromplan Weihnachtsmarkt</h1><p>Verteiler: ${escapeHtml(fmtNum(model.cfg.ampGesamt))} A, ${model.cfg.dosen} Dosen · Gesamtbelastung ${escapeHtml(fmtW(model.total))} von ${escapeHtml(fmtW(model.totalLimit))}</p>${stromSketchSvg(model)}<h2>Übersicht</h2><table class="ps-table"><tr><th>Stecker</th><th>Dose</th><th>Verkabelung</th><th>Geräte</th><th>Last</th></tr>${rows}</table>`);
};

// --- Ziehen und Ablegen (Zeiger-Ereignisse, funktioniert auch per Touch) ---
let stromDrag = null;
let stromSuppressClick = false;
function stromZoneAt(x, y) {
  const el = document.elementFromPoint ? document.elementFromPoint(x, y) : null;
  const zone = el && el.closest ? el.closest('[data-drop]') : null;
  return zone ? zone.dataset.drop : null;
}
function stromClearHighlights() {
  document.querySelectorAll('.dropzone').forEach((z) => z.classList.remove('ring-2', 'ring-amber-400'));
}
window.stromDragEnd = function (cardId, zone) {
  window.stromDragging = false;
  if (zone) window.movePlanCard(cardId, zone);
  else if (window.stromNeedsRender) renderVerkabelung();
  window.stromNeedsRender = false;
};
function initStromDnd() {
  const root = document.getElementById('stromRoot');
  if (!root || root.dataset.dnd) return;
  root.dataset.dnd = '1';
  root.addEventListener('pointerdown', (e) => {
    if (e.target && e.target.closest && e.target.closest('[data-cardedit]')) return;
    const cardEl = e.target && e.target.closest ? e.target.closest('[data-card]') : null;
    if (!cardEl || !window.can('strom.plan')) return;
    stromDrag = { id: cardEl.dataset.card, x: e.clientX, y: e.clientY, active: false, ghost: null, el: cardEl };
  });
  document.addEventListener('pointermove', (e) => {
    if (!stromDrag) return;
    if (!stromDrag.active) {
      if (Math.hypot(e.clientX - stromDrag.x, e.clientY - stromDrag.y) < 8) return;
      stromDrag.active = true;
      window.stromDragging = true;
      const rect = stromDrag.el.getBoundingClientRect();
      const ghost = stromDrag.el.cloneNode(true);
      ghost.style.cssText = 'position:fixed;z-index:90;pointer-events:none;opacity:.92;width:' + rect.width + 'px;left:0;top:0;';
      document.body.appendChild(ghost);
      stromDrag.ghost = ghost;
      stromDrag.dx = stromDrag.x - rect.left;
      stromDrag.dy = stromDrag.y - rect.top;
      stromDrag.el.style.opacity = '0.35';
    }
    e.preventDefault();
    stromDrag.ghost.style.transform = 'translate(' + (e.clientX - stromDrag.dx) + 'px,' + (e.clientY - stromDrag.dy) + 'px)';
    stromClearHighlights();
    const zone = stromZoneAt(e.clientX, e.clientY);
    if (zone) {
      const z = document.elementFromPoint(e.clientX, e.clientY).closest('[data-drop]');
      if (z) z.classList.add('ring-2', 'ring-amber-400');
    }
  }, { passive: false });
  const end = (e) => {
    if (!stromDrag) return;
    const d = stromDrag;
    stromDrag = null;
    if (!d.active) return;
    stromSuppressClick = true;
    setTimeout(() => { stromSuppressClick = false; }, 60);
    stromClearHighlights();
    if (d.ghost) d.ghost.remove();
    d.el.style.opacity = '';
    window.stromDragEnd(d.id, e.type === 'pointercancel' ? null : stromZoneAt(e.clientX, e.clientY));
  };
  document.addEventListener('pointerup', end);
  document.addEventListener('pointercancel', end);
  // Antippen: Karte auswaehlen, dann auf ein Feld tippen
  root.addEventListener('click', (e) => {
    if (stromSuppressClick || !window.can('strom.plan')) return;
    if (e.target && e.target.closest && e.target.closest('[data-cardedit]')) return;
    const cardEl = e.target && e.target.closest ? e.target.closest('[data-card]') : null;
    if (cardEl) {
      window.stromSelected = window.stromSelected === cardEl.dataset.card ? null : cardEl.dataset.card;
      renderVerkabelung();
      return;
    }
    const zone = e.target && e.target.closest ? e.target.closest('[data-drop]') : null;
    if (zone && window.stromSelected) window.movePlanCard(window.stromSelected, zone.dataset.drop);
  });
}
window.initStromDnd = initStromDnd;

// --- Boxen (Liste im Sheet) ---
function normBox(name) {
  return boxKey(name);
}
function renderBoxen() {
  const grid = document.getElementById('boxOverviewGrid');
  if (!grid) return;
  const canEditBox = window.can('boxen.edit');
  const canDelBox = window.can('boxen.delete');
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
        ${b.id && (canEditBox || canDelBox) ? `<span class="flex gap-1">${canEditBox ? `<button onclick="window.openBoxModal('${escapeHtml(b.id)}')" class="p-1 text-xs bg-slate-200 dark:bg-slate-800 rounded">✏️</button>` : ''}${canDelBox ? `<button onclick="window.deleteBox('${escapeHtml(b.id)}')" class="p-1 text-xs bg-rose-500/20 text-rose-500 rounded">🗑️</button>` : ''}</span>` : ''}
      </div>
      <ul class="text-xs text-slate-700 dark:text-slate-300 list-disc pl-4 space-y-0.5">${b.items.map((n) => `<li>${escapeHtml(n)}</li>`).join('') || '<li class="list-none text-slate-400">Noch leer</li>'}</ul>
    </div>`).join('') || '<div class="text-xs text-slate-500">Noch keine Boxen. Trage im Inventar bei "Box" einen Namen ein oder lege eine neue Box an.</div>';
}
// Alte Eintraege wie "3" werden einmal zu "Box 3" (gleiche Box, sauberer Name)
window.migrateBoxValues = function () {
  if (localStorage.getItem('boxMigrated1') === '1' || !window.canEditField('box')) return;
  const boxes = boxStore.items();
  if (!boxes.length) return;
  const ops = [];
  window.inventarData.forEach((cat) => cat.items.forEach((item) => {
    const cur = String(item.box || '').trim();
    if (!cur) return;
    const b = boxes.find((x) => boxKey(x.name) === boxKey(cur));
    if (b && b.name !== item.box) ops.push({ op: 'set', c: cat.id, i: item.id, f: 'box', v: b.name });
  }));
  if (ops.length) invCommit(ops);
  localStorage.setItem('boxMigrated1', '1');
};
window.ensureBoxMigration = async function () {
  await boxStore.sync();
  await window.syncInventar();
  window.migrateBoxValues();
};
window.openBoxModal = function (id) {
  if (!window.can(id ? 'boxen.edit' : 'boxen.add')) return;
  const def = boxStore.items().find((d) => d.id === id);
  document.getElementById('boxModalId').value = def ? def.id : '';
  document.getElementById('boxModalName').value = def ? def.name : '';
  document.getElementById('boxModalDesc').value = def ? def.desc : '';
  setText('boxModalTitle', def ? '📦 Box bearbeiten' : '📦 Neue Box');
  window.openModal('boxEditModal');
};
window.saveBoxFromModal = function () {
  const id = document.getElementById('boxModalId').value;
  if (!window.can(id ? 'boxen.edit' : 'boxen.add')) return;
  const name = document.getElementById('boxModalName').value.trim();
  const desc = document.getElementById('boxModalDesc').value.trim();
  if (!name) {
    notify('Bitte einen Namen eingeben.');
    return;
  }
  const old = id ? boxStore.items().find((b) => b.id === id) : null;
  boxStore.apply({ op: 'save', item: { id: id || newId('b'), name: name.slice(0, 60), desc: desc.slice(0, 120) } });
  // Umbenannt: Gegenstaende mit dieser Box ziehen mit um
  if (old && boxKey(old.name) !== boxKey(name.slice(0, 60)) && window.canEditField('box')) {
    const ops = [];
    window.inventarData.forEach((cat) => cat.items.forEach((item) => {
      if (item.box && boxKey(item.box) === boxKey(old.name)) ops.push({ op: 'set', c: cat.id, i: item.id, f: 'box', v: name.slice(0, 60) });
    }));
    if (ops.length) invCommit(ops);
  }
  window.closeModal('boxEditModal');
  renderBoxen();
};
window.deleteBox = async function (id) {
  if (!window.can('boxen.delete')) return;
  const box = boxStore.items().find((b) => b.id === id);
  const ok = await window.uiConfirm({ title: 'Box löschen?', message: box ? '"' + box.name + '" wird gelöscht. Die Einträge im Inventar behalten ihren Boxnamen.' : '', okText: 'Löschen' });
  if (!ok) return;
  boxStore.apply({ op: 'del', id: id });
  renderBoxen();
};

// --- Rezepte (aus dem Sheet) und Rezept-Rechner (nur Kinderpunsch) ---
const RECIPE_COLORS = {
  amber: { box: 'bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800/50', title: 'text-amber-900 dark:text-amber-300' },
  rose: { box: 'bg-rose-50 dark:bg-rose-950/30 border-rose-200 dark:border-rose-800/50', title: 'text-rose-900 dark:text-rose-300' },
  emerald: { box: 'bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800/50', title: 'text-emerald-900 dark:text-emerald-300' },
  sky: { box: 'bg-sky-50 dark:bg-sky-950/30 border-sky-200 dark:border-sky-800/50', title: 'text-sky-900 dark:text-sky-300' },
  violet: { box: 'bg-violet-50 dark:bg-violet-950/30 border-violet-200 dark:border-violet-800/50', title: 'text-violet-900 dark:text-violet-300' },
  orange: { box: 'bg-orange-50 dark:bg-orange-950/30 border-orange-200 dark:border-orange-800/50', title: 'text-orange-900 dark:text-orange-300' },
  teal: { box: 'bg-teal-50 dark:bg-teal-950/30 border-teal-200 dark:border-teal-800/50', title: 'text-teal-900 dark:text-teal-300' },
  fuchsia: { box: 'bg-fuchsia-50 dark:bg-fuchsia-950/30 border-fuchsia-200 dark:border-fuchsia-800/50', title: 'text-fuchsia-900 dark:text-fuchsia-300' }
};
// Notfall-Rezept, falls das Sheet noch nicht erreichbar war
function fallbackPunsch() {
  return {
    id: 'r_punsch', name: 'Winter-Kinderpunsch', emoji: '☕', color: 'rose', portions: 'Vereinsrezept, ca. 8 Liter', calc: true, basis: PUNSCH_BASIS_LITER,
    zutaten: PUNSCH_ZUTATEN.map((z, i) => ({ id: 'z' + (i + 1), name: z.name, amount: z.menge, unit: z.einheit, noBuy: !!z.ohneEinkauf, r: z.aufrunden ? 'up' : (z.schritt ? 'half' : '') })),
    steps: 'Tee kochen, ziehen lassen, Beutel raus.\nDen Rest nach und nach zugeben.\nZiehen lassen.', note: ''
  };
}
function punschRecipe() {
  return rezepteStore.items().find((r) => r.id === 'r_punsch') || fallbackPunsch();
}
function computePunsch(liters) {
  const rec = punschRecipe();
  const factor = liters / (rec.basis || PUNSCH_BASIS_LITER);
  return rec.zutaten.map((z) => {
    let amount = z.amount * factor;
    if (z.r === 'up') amount = Math.ceil(amount - 1e-9);
    else if (z.r === 'half') amount = Math.round(amount / 0.5) * 0.5;
    else amount = Math.round(amount * 100) / 100;
    return { name: z.name, unit: z.unit, amount: amount, ohneEinkauf: !!z.noBuy };
  });
}
window.punschLitersValue = null;
function punschLiters() {
  const input = document.getElementById('punschCalcInput');
  const base = punschRecipe().basis || PUNSCH_BASIS_LITER;
  const raw = input && input.value !== '' && input.value !== undefined ? input.value : (window.punschLitersValue || base);
  return Math.max(1, parseFloat(String(raw).replace(',', '.')) || base);
}
window.updatePunschRecipe = function () {
  const input = document.getElementById('punschCalcInput');
  if (input) window.punschLitersValue = input.value;
  const list = document.getElementById('recipeIngredientsList');
  if (!list) return;
  list.innerHTML = computePunsch(punschLiters()).map((r) =>
    `<li><span class="font-bold">${fmtNum(r.amount)} ${escapeHtml(r.unit)}</span> ${escapeHtml(r.name)}</li>`
  ).join('');
};
function recipeCardHtml(rec) {
  const c = RECIPE_COLORS[rec.color] || RECIPE_COLORS.emerald;
  const canEdit = window.can('rezepte.edit');
  const canDel = window.can('rezepte.delete') && rec.id !== 'r_waffel' && rec.id !== 'r_punsch';
  const btn = 'px-2 py-1 rounded-lg text-[11px] font-bold border bg-white/70 dark:bg-slate-900/60 border-slate-300 dark:border-slate-700';
  const zut = rec.zutaten.map((z) => `<li class="flex items-center justify-between gap-2"><span><span class="font-bold">${escapeHtml((z.amount ? fmtNum(z.amount) + (z.unit ? ' ' + z.unit : '') : (z.unit || '')))}</span> ${escapeHtml(z.name)}${z.noBuy ? ' <span class="text-[10px] text-slate-400">(nicht einkaufen)</span>' : ''}</span>${canEdit ? `<span class="whitespace-nowrap"><button type="button" onclick="editIngredient('${escapeHtml(rec.id)}', '${escapeHtml(z.id)}')" title="Zutat bearbeiten" class="${btn}">✏️</button> <button type="button" onclick="deleteIngredient('${escapeHtml(rec.id)}', '${escapeHtml(z.id)}')" title="Zutat löschen" class="${btn} !text-rose-500">🗑️</button></span>` : ''}</li>`).join('');
  const steps = String(rec.steps || '').split('\n').map((x) => x.trim()).filter(Boolean).map((x) => `<li>${escapeHtml(x)}</li>`).join('');
  const calc = rec.calc ? `
      <div class="bg-white/80 dark:bg-slate-900/70 p-4 rounded-xl border border-rose-200 dark:border-rose-800/50 space-y-3">
        <div class="flex flex-wrap justify-between items-center gap-2">
          <span class="font-extrabold text-rose-900 dark:text-rose-300">🧮 Rechner: Menge anpassen</span>
          <div class="flex items-center gap-1 font-bold text-slate-700 dark:text-slate-200">
            <input type="number" id="punschCalcInput" value="${escapeHtml(String(window.punschLitersValue || rec.basis || 8))}" min="1" max="400" step="any" ${window.can('rezepte.calc') ? '' : 'disabled'} onchange="updatePunschRecipe()" class="w-20 p-1.5 border border-slate-300 dark:border-slate-700 rounded-lg text-center bg-white dark:bg-slate-950" />
            <span>Liter</span>
          </div>
        </div>
        <ul id="recipeIngredientsList" class="list-disc pl-4 space-y-1 font-medium text-slate-700 dark:text-slate-300"></ul>
        <div class="flex flex-wrap gap-2 pt-1">
          ${window.can('rezepte.toShopping') ? '<button type="button" onclick="applyPunschToShopping()" class="px-4 py-2.5 bg-rose-600 hover:bg-rose-500 text-white font-black text-xs rounded-xl shadow transition">🛒 In Einkaufsliste übernehmen</button>' : ''}
          <button type="button" onclick="switchView('einkaufsliste')" class="px-4 py-2.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold text-xs rounded-xl transition">Zur Einkaufsliste</button>
        </div>
        <p class="text-[11px] text-slate-500 dark:text-slate-400">Setzt den Bedarf der Zutaten im Inventar auf diese Mengen und überschreibt die bisherigen Werte. Zutaten mit „nicht einkaufen“ (z. B. Wasser) werden übersprungen.</p>
      </div>` : '';
  return `<div class="p-4 rounded-xl border space-y-3 ${c.box}" data-recipe="${escapeHtml(rec.id)}">
      <div class="flex flex-wrap items-start justify-between gap-2">
        <div class="font-extrabold ${c.title}">${escapeHtml(rec.emoji || '')} ${escapeHtml(rec.name)}${rec.portions ? ` <span class="font-semibold opacity-80">(${escapeHtml(rec.portions)})</span>` : ''}</div>
        <span class="flex flex-wrap gap-1">
          ${canEdit ? `<button type="button" onclick="editRecipe('${escapeHtml(rec.id)}')" class="${btn}">✏️ Rezept</button><button type="button" onclick="addIngredient('${escapeHtml(rec.id)}')" class="${btn}">➕ Zutat</button>` : ''}
          ${canDel ? `<button type="button" onclick="deleteRecipe('${escapeHtml(rec.id)}')" class="${btn} !text-rose-500">🗑️</button>` : ''}
        </span>
      </div>
      <ul class="list-disc pl-4 space-y-1 font-medium text-slate-700 dark:text-slate-300">${zut || '<li class="list-none text-slate-400">Noch keine Zutaten.</li>'}</ul>
      ${steps ? `<ol class="list-decimal pl-4 space-y-1 text-slate-700 dark:text-slate-300 leading-relaxed">${steps}</ol>` : ''}
      ${rec.note ? `<p class="font-bold ${c.title}">${escapeHtml(rec.note)}</p>` : ''}
      ${calc}
    </div>`;
}
function renderRezepte() {
  const root = document.getElementById('rezepteRoot');
  if (!root) return;
  const ae = document.activeElement;
  if (ae && ae.closest && ae.closest('#rezepteRoot') && ae.tagName === 'INPUT') return;   // nicht beim Tippen stoeren
  let list = rezepteStore.items();
  if (!list.length) list = [fallbackPunsch()];
  root.innerHTML = list.map(recipeCardHtml).join('') +
    (window.can('rezepte.add') ? '<div><button type="button" onclick="addRecipe()" class="px-4 py-2.5 bg-rose-600 hover:bg-rose-500 text-white font-black text-xs rounded-xl shadow transition">➕ Neues Rezept</button></div>' : '');
  window.updatePunschRecipe();
}
window.renderRezepte = renderRezepte;
function recipeItem(id) {
  return rezepteStore.items().find((r) => r.id === id);
}
function saveRecipe(rec) {
  rezepteStore.apply({ op: 'save', item: rec });
  renderRezepte();
}
async function recipeForm(title, rec, okText) {
  const fields = [
    { key: 'name', label: 'Name', type: 'text', value: rec ? rec.name : '', required: true, maxlength: 60 },
    { key: 'emoji', label: 'Symbol (ein Emoji)', type: 'text', value: rec ? rec.emoji : '🍽️', maxlength: 4 },
    { key: 'portions', label: 'Menge / Hinweis (z. B. „ca. 8 Liter“)', type: 'text', value: rec ? rec.portions : '', maxlength: 60 }
  ];
  if (rec && rec.calc) fields.push({ key: 'basis', label: 'Menge dieses Rezepts in Litern (Grundlage für den Rechner)', type: 'text', value: String(rec.basis), validate: (x) => (parseNum(x) > 0 ? '' : 'Bitte eine Zahl über 0 eintragen.') });
  fields.push({ key: 'steps', label: 'Zubereitung (ein Schritt pro Zeile)', type: 'textarea', value: rec ? rec.steps : '', maxlength: 2000 });
  fields.push({ key: 'note', label: 'Hinweis (optional)', type: 'text', value: rec ? rec.note : '', maxlength: 300 });
  return window.uiForm({ title: title, fields: fields, okText: okText });
}
window.addRecipe = async function () {
  if (!window.can('rezepte.add')) return;
  const v = await recipeForm('Neues Rezept', null, 'Anlegen');
  if (!v) return;
  const used = rezepteStore.items().map((r) => r.color);
  const color = ['emerald', 'sky', 'violet', 'orange', 'teal', 'fuchsia'].find((c) => used.indexOf(c) < 0) || 'emerald';
  saveRecipe({ id: newId('r'), name: v.name.trim(), emoji: v.emoji.trim(), portions: v.portions.trim(), color: color, calc: false, basis: 0, zutaten: [], steps: v.steps.trim(), note: v.note.trim() });
};
window.editRecipe = async function (id) {
  if (!window.can('rezepte.edit')) return;
  const rec = recipeItem(id);
  if (!rec) return;
  const v = await recipeForm('Rezept bearbeiten', rec, 'Speichern');
  if (!v) return;
  saveRecipe(Object.assign({}, rec, { name: v.name.trim(), emoji: v.emoji.trim(), portions: v.portions.trim(), steps: v.steps.trim(), note: v.note.trim(), basis: rec.calc ? parseNum(v.basis) : 0 }));
};
window.deleteRecipe = async function (id) {
  if (!window.can('rezepte.delete') || id === 'r_waffel' || id === 'r_punsch') return;
  const rec = recipeItem(id);
  if (!rec) return;
  const ok = await window.uiConfirm({ title: 'Rezept löschen?', message: '„' + rec.name + '“ wird gelöscht.', okText: 'Löschen' });
  if (!ok) return;
  rezepteStore.apply({ op: 'del', id: id });
  renderRezepte();
};
async function ingredientForm(title, rec, z, okText) {
  const fields = [
    { key: 'name', label: 'Zutat', type: 'text', value: z ? z.name : '', required: true, maxlength: 80 },
    { key: 'amount', label: 'Menge', type: 'text', value: z ? String(z.amount).replace('.', ',') : '', validate: (x) => (String(x).trim() === '' || parseNum(x) >= 0 ? '' : 'Bitte eine Zahl eintragen.') },
    { key: 'unit', label: 'Einheit (optional)', type: 'text', value: z ? z.unit : '', placeholder: 'g, ml, l, Btl., Stk.', maxlength: 12 },
    { key: 'noBuy', label: 'Nicht einkaufen (z. B. Leitungswasser)', type: 'checkbox', value: z ? z.noBuy : false }
  ];
  if (rec.calc) fields.push({ key: 'r', label: 'Runden beim Rechner', type: 'select', value: z ? z.r : '', options: [{ value: '', label: 'nicht runden' }, { value: 'half', label: 'auf halbe Einheiten' }, { value: 'up', label: 'immer aufrunden' }] });
  return window.uiForm({ title: title, fields: fields, okText: okText });
}
window.addIngredient = async function (rid) {
  if (!window.can('rezepte.edit')) return;
  const rec = recipeItem(rid);
  if (!rec) return;
  const v = await ingredientForm('Neue Zutat', rec, null, 'Hinzufügen');
  if (!v) return;
  const used = {};
  rec.zutaten.forEach((z) => { used[z.id] = true; });
  let n = rec.zutaten.length + 1;
  while (used['z' + n]) n++;
  saveRecipe(Object.assign({}, rec, { zutaten: rec.zutaten.concat([{ id: 'z' + n, name: v.name.trim(), amount: parseNum(v.amount), unit: v.unit.trim(), noBuy: v.noBuy, r: v.r || '' }]) }));
};
window.editIngredient = async function (rid, zid) {
  if (!window.can('rezepte.edit')) return;
  const rec = recipeItem(rid);
  const z = rec && rec.zutaten.find((x) => x.id === zid);
  if (!z) return;
  const v = await ingredientForm('Zutat bearbeiten', rec, z, 'Speichern');
  if (!v) return;
  saveRecipe(Object.assign({}, rec, { zutaten: rec.zutaten.map((x) => (x.id === zid ? { id: zid, name: v.name.trim(), amount: parseNum(v.amount), unit: v.unit.trim(), noBuy: v.noBuy, r: v.r !== undefined ? v.r : x.r } : x)) }));
};
window.deleteIngredient = async function (rid, zid) {
  if (!window.can('rezepte.edit')) return;
  const rec = recipeItem(rid);
  const z = rec && rec.zutaten.find((x) => x.id === zid);
  if (!z) return;
  const ok = await window.uiConfirm({ title: 'Zutat löschen?', message: '„' + z.name + '“ aus „' + rec.name + '“ löschen.', okText: 'Löschen' });
  if (!ok) return;
  saveRecipe(Object.assign({}, rec, { zutaten: rec.zutaten.filter((x) => x.id !== zid) }));
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
  if (!window.can('rezepte.toShopping')) {
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
// --- Admin-Panel ---
window.adminTab = 'verwaltung';
window.usersData = [];
window.extrasData = [];
window.setAdminTab = function (tab) {
  window.adminTab = ['benutzer', 'zugang'].indexOf(tab) >= 0 ? tab : 'verwaltung';
  renderAdmin();
  if (window.adminTab !== 'verwaltung') loadAccessData();
};
async function loadAccessData() {
  await window.refreshRoles();
  if (window.session && window.session.token && window.canAny(['system.users', 'system.rechte', 'system.roles'])) {
    const res = await getFromSheets('users', { token: window.session.token });
    if (res && Array.isArray(res.users)) {
      window.usersData = res.users;
      window.extrasData = Array.isArray(res.extras) ? res.extras : [];
      renderAdmin();
    }
  }
}
function adminProductsHtml() {
  const cfg = window.kasseCfg;
  const canPrice = window.can('finance.prices');
  return kasseProducts().map((p) => {
    const c = PRODUCT_COLORS[p.color] || PRODUCT_COLORS.emerald;
    const price = productPrice(p, cfg);
    const btns = p.builtin ? '' : `${window.can('finance.productEdit') ? `<button type="button" onclick="editProduct('${p.id}')" title="Bearbeiten" class="w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700">✏️</button>` : ''}${window.can('finance.productDelete') ? `<button type="button" onclick="deleteProduct('${p.id}')" title="Löschen" class="w-8 h-8 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-500">🗑️</button>` : ''}`;
    return `<div class="flex flex-wrap items-center gap-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 border-l-4 ${c.border} rounded-xl px-3 py-2">
        <span class="text-2xl">${escapeHtml(p.emoji)}</span>
        <div class="flex-1 min-w-[8rem]"><div class="font-bold text-slate-900 dark:text-slate-100">${escapeHtml(p.name)}</div><div class="text-[11px] text-slate-500 dark:text-slate-400">${p.builtin ? 'Standardprodukt' : 'eigenes Produkt'} · je ${escapeHtml(p.unit)}</div></div>
        <span class="flex items-center gap-1"><input type="text" inputmode="decimal" ${canPrice ? '' : 'disabled'} value="${escapeHtml(euroInputValue(price))}" onchange="setProductPrice('${p.id}', this.value)" class="w-24 text-right bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg py-1.5 px-2 font-bold disabled:opacity-60" /><span class="text-slate-500">€</span></span>
        ${btns}
      </div>`;
  }).join('');
}
// ---------- Hilfen fuer Zeit und Anzeige ----------
function pad2(n) { return String(n).padStart(2, '0'); }
function fmtDateTime(ts) {
  const d = new Date(ts);
  return pad2(d.getDate()) + '.' + pad2(d.getMonth() + 1) + '. ' + pad2(d.getHours()) + ':' + pad2(d.getMinutes());
}
function fmtAgo(ts) {
  if (!ts) return 'noch nie';
  const sec = Math.max(0, Math.round((Date.now() - ts) / 1000));
  if (sec < 10) return 'gerade eben';
  if (sec < 60) return 'vor ' + sec + ' Sek.';
  const min = Math.round(sec / 60);
  if (min < 60) return 'vor ' + min + ' Min.';
  const h = Math.round(min / 60);
  if (h < 48) return 'vor ' + h + ' Std.';
  return 'vor ' + Math.round(h / 24) + ' Tagen';
}

// ---------- Rollen: Reihenfolge, Kopieren, Rechte-Uebersicht ----------
window.moveRole = function (id, dir) {
  if (!window.can('system.roles')) return;
  accessCall([{ op: 'moveRole', id: id, dir: dir }]);
};
window.duplicateRole = function (id) {
  window.openRoleDialog(null, id);
};
function adminRolesHtml() {
  const total = PERMISSION_LIST.length;
  const canOpen = window.canAny(['system.roles', 'system.rechte', 'system.passwords']);
  const canSort = window.can('system.roles');
  const canCopy = window.can('system.roles') && window.can('system.rechte');
  const btn = 'px-2.5 py-1.5 rounded-lg text-xs font-bold bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 disabled:opacity-30';
  return window.rolesData.map((r, i, all) => {
    const n = r.perms.filter((k) => PERMISSION_LIST.indexOf(k) >= 0).length;
    const rid = escapeHtml(r.id);
    return `<div class="flex flex-wrap items-center gap-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2.5">
      <span class="text-xs font-black text-slate-400 w-5 text-center">${i + 1}</span>
      <span class="text-xl">${roleIcon(r.id)}</span>
      <div class="flex-1 min-w-[9rem]"><div class="font-bold text-slate-900 dark:text-slate-100">${escapeHtml(r.name)}${r.builtin ? ' <span class="text-[10px] font-semibold text-slate-400">(fest)</span>' : ''}</div><div class="text-[11px] text-slate-500 dark:text-slate-400">${escapeHtml(r.desc || 'ohne Beschreibung')}${r.last ? ' · zuletzt angemeldet ' + fmtAgo(r.last) : ''}</div></div>
      <span class="text-[11px] font-bold text-slate-600 dark:text-slate-300">Rechte ${n} von ${total}</span>
      <span class="text-[11px] font-bold ${r.hasPw ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-400'}">${r.id === 'gast' ? 'ohne Passwort' : (r.hasPw ? '🔑 Passwort' : 'Rollen-Anmeldung aus')}</span>
      ${canSort ? `<span class="whitespace-nowrap"><button type="button" title="Höher einstufen" onclick="moveRole('${rid}', -1)" ${i === 0 ? 'disabled' : ''} class="${btn}">▲</button> <button type="button" title="Niedriger einstufen" onclick="moveRole('${rid}', 1)" ${i === all.length - 1 ? 'disabled' : ''} class="${btn}">▼</button></span>` : ''}
      ${canCopy ? `<button type="button" title="Als Vorlage für eine neue Rolle kopieren" onclick="duplicateRole('${rid}')" class="${btn}">⧉ Kopieren</button>` : ''}
      ${canOpen ? `<button type="button" onclick="openRoleDialog('${rid}')" class="${btn}">✏️ Bearbeiten</button>` : ''}
    </div>`;
  }).join('');
}
// Tabelle: welche Rolle (und welches Sonderrecht) darf was
function adminMatrixHtml() {
  const cols = window.rolesData.map((r) => ({ name: r.name, perms: r.perms, extra: false }))
    .concat((window.extrasData || []).map((x) => ({ name: '✨ ' + x.name, perms: x.perms, extra: true })));
  const th = 'px-2 py-2 text-[11px] font-black text-slate-600 dark:text-slate-300 text-center whitespace-nowrap';
  let html = `<table class="min-w-full text-xs"><thead><tr><th class="${th} text-left sticky left-0 bg-white dark:bg-slate-900">Recht</th>${cols.map((c) => `<th class="${th}">${escapeHtml(c.name)}</th>`).join('')}</tr></thead><tbody>`;
  PERMISSION_GROUPS.forEach((g) => {
    html += `<tr><td colspan="${cols.length + 1}" class="px-2 py-1.5 bg-slate-100 dark:bg-slate-800 text-[11px] font-black uppercase tracking-wide text-slate-600 dark:text-slate-300">${escapeHtml(g.title)}</td></tr>`;
    g.perms.forEach((p) => {
      html += `<tr class="border-b border-slate-100 dark:border-slate-800"><td class="px-2 py-1.5 text-slate-800 dark:text-slate-100 sticky left-0 bg-white dark:bg-slate-900">${escapeHtml(p[1])}</td>${cols.map((c) => `<td class="px-2 py-1.5 text-center ${c.perms.indexOf(p[0]) >= 0 ? 'text-emerald-600 dark:text-emerald-400 font-black' : 'text-slate-300 dark:text-slate-600'}">${c.perms.indexOf(p[0]) >= 0 ? '✓' : '–'}</td>`).join('')}</tr>`;
    });
  });
  return html + '</tbody></table>';
}
function adminUsersHtml() {
  if (!window.canAny(['system.users', 'system.rechte', 'system.roles'])) return '';
  if (!window.session || !window.session.token) return '<div class="text-xs text-slate-500 dark:text-slate-400">Bitte einmal abmelden und neu anmelden, dann erscheinen hier die Benutzer.</div>';
  if (!window.usersData.length) return '<div class="text-xs text-slate-500 dark:text-slate-400">Noch keine Benutzer. Ohne Benutzer meldet man sich mit dem Passwort der Rolle an.</div>';
  const canUsers = window.can('system.users');
  return window.usersData.map((u) => {
    const names = (u.roles || []).map((id) => { const r = window.roleById(id); return r ? r.name : '?'; });
    const ex = (u.extras || []).map((id) => { const x = window.extrasData.find((e) => e.id === id); return x ? x.name : null; }).filter(Boolean);
    return `<div class="flex flex-wrap items-center gap-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2.5 ${u.disabled ? 'opacity-60' : ''}">
      <span class="text-xl">${u.disabled ? '🚫' : '👤'}</span>
      <div class="flex-1 min-w-[8rem]"><div class="font-bold text-slate-900 dark:text-slate-100">${escapeHtml(u.name)}${u.disabled ? ' <span class="text-[10px] font-black uppercase text-rose-500">gesperrt</span>' : ''}</div><div class="text-[11px] text-slate-500 dark:text-slate-400">${escapeHtml(names.join(' + ') || 'keine Rolle')}${ex.length ? ' · ✨ ' + escapeHtml(ex.join(', ')) : ''} · ${u.last ? 'zuletzt angemeldet ' + fmtAgo(u.last) : 'noch nie angemeldet'}</div></div>
      ${canUsers ? `<button type="button" onclick="openUserDialog('${escapeHtml(u.id)}')" class="px-3 py-1.5 rounded-lg text-xs font-bold bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700">✏️ Bearbeiten</button>` : ''}
    </div>`;
  }).join('');
}
function adminExtrasHtml() {
  if (!window.canAny(['system.users', 'system.rechte', 'system.roles'])) return '';
  if (!window.session || !window.session.token) return '';
  if (!window.extrasData.length) return '<div class="text-xs text-slate-500 dark:text-slate-400">Noch keine Sonderrechte angelegt.</div>';
  const canEdit = window.can('system.rechte');
  return window.extrasData.map((x) => {
    const users = window.usersData.filter((u) => (u.extras || []).indexOf(x.id) >= 0).length;
    return `<div class="flex flex-wrap items-center gap-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2.5">
      <span class="text-xl">✨</span>
      <div class="flex-1 min-w-[9rem]"><div class="font-bold text-slate-900 dark:text-slate-100">${escapeHtml(x.name)}</div><div class="text-[11px] text-slate-500 dark:text-slate-400">${escapeHtml(x.desc || 'ohne Beschreibung')}</div></div>
      <span class="text-[11px] font-bold text-slate-600 dark:text-slate-300">${x.perms.length} ${x.perms.length === 1 ? 'Recht' : 'Rechte'} · ${users} ${users === 1 ? 'Benutzer' : 'Benutzer'}</span>
      ${canEdit ? `<button type="button" onclick="openExtraDialog('${escapeHtml(x.id)}')" class="px-3 py-1.5 rounded-lg text-xs font-bold bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700">✏️ Bearbeiten</button>` : ''}
    </div>`;
  }).join('');
}

// ---------- Sicherungen ----------
window.backupsData = null;
const BACKUP_KIND = { auto: 'automatisch', manuell: 'manuell', 'vor-wiederherstellung': 'vor Wiederherstellung' };
async function loadBackups() {
  if (!window.session || !window.session.token || !window.canAny(['system.backup', 'system.restore'])) return;
  const r = await getJson('backups', { token: window.session.token });
  if (r && Array.isArray(r.backups)) {
    window.backupsData = r.backups;
    renderBackups();
  }
}
function renderBackups() {
  const box = document.getElementById('adminBackupList');
  if (!box) return;
  if (!window.canAny(['system.backup', 'system.restore'])) { box.innerHTML = ''; return; }
  if (!window.session || !window.session.token) { box.innerHTML = '<div class="text-xs text-slate-500 dark:text-slate-400">Bitte einmal abmelden und neu anmelden, dann erscheinen hier die Sicherungen.</div>'; return; }
  const list = window.backupsData;
  if (!list) { box.innerHTML = '<div class="text-xs text-slate-500 dark:text-slate-400">Lade Sicherungen ...</div>'; return; }
  if (!list.length) { box.innerHTML = '<div class="text-xs text-slate-500 dark:text-slate-400">Noch keine Sicherung vorhanden.</div>'; return; }
  const canRestore = window.can('system.restore');
  box.innerHTML = list.map((b) => `<div class="flex flex-wrap items-center gap-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2">
      <span class="text-lg">🗄️</span>
      <div class="flex-1 min-w-[8rem]"><div class="font-bold text-sm text-slate-900 dark:text-slate-100">${fmtDateTime(b.ts)}</div><div class="text-[11px] text-slate-500 dark:text-slate-400">${escapeHtml(BACKUP_KIND[b.kind] || b.kind)} · ca. ${b.kb} KB</div></div>
      ${canRestore ? `<button type="button" onclick="restoreBackup('${escapeHtml(b.id)}')" class="px-3 py-1.5 rounded-lg text-xs font-bold bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700">↩️ Wiederherstellen</button>` : ''}
    </div>`).join('');
}
window.backupNow = async function () {
  if (!window.can('system.backup')) return;
  if (!window.session || !window.session.token) { notify('Bitte einmal abmelden und neu anmelden, dann kann ich sichern.'); return; }
  const r = await postJson({ action: 'backupNow', token: window.session.token });
  if (!r || r.status !== 'success') { notify(r && r.message ? r.message : 'Sichern nicht möglich (keine Verbindung oder Anmeldung abgelaufen).'); return; }
  notify('Sicherung erstellt.');
  await loadBackups();
  if (window.currentView === 'status') window.runStatusCheck();
};
window.restoreBackup = async function (id) {
  if (!window.can('system.restore')) return;
  const b = (window.backupsData || []).find((x) => x.id === id);
  if (!b) return;
  const ok = await window.uiConfirm({
    title: 'Sicherung wiederherstellen?',
    message: 'Stand vom ' + fmtDateTime(b.ts) + ' (' + (BACKUP_KIND[b.kind] || b.kind) + '). Inventar, Kasse, Ausgaben, Produkte, Rezepte, Aushang, Strom, Boxen und Aufbau gehen auf diesen Stand zurück. Benutzer, Rollen und Bilder bleiben. Der jetzige Stand wird vorher automatisch gesichert, du kannst also wieder zurück.',
    okText: 'Wiederherstellen'
  });
  if (!ok) return;
  const r = await postJson({ action: 'restoreBackup', token: window.session.token, id: id });
  if (!r || r.status !== 'success') { notify(r && r.message ? r.message : 'Wiederherstellen nicht möglich (keine Verbindung oder Anmeldung abgelaufen).'); return; }
  notify('Wiederhergestellt. Alle Geräte holen den Stand in den nächsten Sekunden.');
  window.syncInventar();
  window.syncKasse();
  [expenseStore, boxStore, stromStore, aufbauStore, produkteStore, rezepteStore, aushangStore, kassensturzStore].forEach((st) => st.sync());
  loadBackups();
};

// ---------- Systemstatus ----------
window.statusCheck = null;
window.statusData = null;
window.swInfo = { supported: false, active: false, files: 0 };
function localStorageKb() {
  let n = 0;
  try {
    if (typeof localStorage.length === 'number') {
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        n += (k.length + String(localStorage.getItem(k) || '').length) * 2;
      }
    }
  } catch (e) { /* egal */ }
  return Math.round(n / 1024);
}
function isStandalone() {
  try { return !!((typeof navigator !== 'undefined' && navigator.standalone) || (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches)); } catch (e) { return false; }
}
async function updateSwInfo() {
  const info = { supported: false, active: false, files: 0 };
  try {
    if (typeof navigator !== 'undefined' && 'serviceWorker' in navigator) {
      info.supported = true;
      const reg = await navigator.serviceWorker.getRegistration('/weihnachtsmarkt/');
      info.active = !!(reg && reg.active);
      if (typeof caches !== 'undefined') {
        const keys = (await caches.keys()).filter((k) => k.indexOf('wm-shell-') === 0);
        for (const k of keys) info.files += (await (await caches.open(k)).keys()).length;
      }
    }
  } catch (e) { /* egal */ }
  window.swInfo = info;
}
window.runStatusCheck = async function () {
  const t0 = Date.now();
  const ping = await getJson('ping');
  window.statusCheck = { at: Date.now(), ok: !!ping, ms: Date.now() - t0, version: ping ? Number(ping.version) || 0 : 0 };
  if (ping) window.scriptVersion = window.statusCheck.version;
  window.statusServerNote = '';
  if (window.session && window.session.token && window.can('view.status')) {
    const r = await getJson('status', { token: window.session.token });
    if (r && r.status === 'success') window.statusData = r;
    else { window.statusData = null; window.statusServerNote = r && r.code === 'auth' ? 'Die Anmeldung ist abgelaufen. Bitte neu anmelden.' : (r ? 'Keine Berechtigung.' : ''); }
  } else if (window.can('view.status')) {
    window.statusServerNote = 'Bitte einmal abmelden und neu anmelden, dann zeigt dieser Bereich auch die Werte vom Sheet.';
  }
  await updateSwInfo();
  updateNavVersion();
  renderStatus();
};
function statusPending() {
  const parts = [];
  if (kasseOps.length) parts.push(['Kasse-Buchungen', kasseOps.length]);
  const cfg = Object.keys(kassePatch || {}).length;
  if (cfg) parts.push(['Kasse-Einstellungen', cfg]);
  if (invPending.length) parts.push(['Inventar', invPending.length]);
  [['Ausgaben', expenseStore], ['Boxen', boxStore], ['Strom', stromStore], ['Aufbau', aufbauStore], ['Produkte', produkteStore], ['Rezepte', rezepteStore], ['Aushang', aushangStore], ['Kassensturz', kassensturzStore]].forEach((x) => {
    if (x[1].pendingCount()) parts.push([x[0], x[1].pendingCount()]);
  });
  return parts;
}
const STATUS_SYNC_AREAS = [['kasse', 'Kasse'], ['inventar', 'Inventar'], ['list:aushang', 'Aushang'], ['list:rezepte', 'Rezepte'], ['list:boxes', 'Boxen'], ['list:strom', 'Strom'], ['list:aufbau', 'Aufbau'], ['list:produkte', 'Produkte'], ['list:kassensturz', 'Kassensturz'], ['list:expenses', 'Ausgaben'], ['roles', 'Rollen und Rechte']];
function renderStatus() {
  const root = document.getElementById('statusRoot');
  const ampel = document.getElementById('statusAmpel');
  if (!root || !ampel) return;
  const LV = [
    { dot: 'bg-emerald-500', text: 'text-emerald-600 dark:text-emerald-400' },
    { dot: 'bg-amber-500', text: 'text-amber-600 dark:text-amber-400' },
    { dot: 'bg-rose-500', text: 'text-rose-600 dark:text-rose-400' }
  ];
  const row = (level, label, value, hint) => `<div class="flex items-start gap-3 py-2 border-b border-slate-100 dark:border-slate-800 last:border-0">
      <span class="w-2.5 h-2.5 rounded-full mt-1.5 shrink-0 ${LV[level].dot}"></span>
      <div class="flex-1 min-w-0"><div class="flex flex-wrap justify-between gap-x-3"><span class="text-sm font-bold text-slate-800 dark:text-slate-100">${escapeHtml(label)}</span><span class="text-sm font-semibold ${LV[level].text}">${escapeHtml(value)}</span></div>${hint ? `<div class="text-[11px] text-slate-500 dark:text-slate-400">${escapeHtml(hint)}</div>` : ''}</div>
    </div>`;
  const plain = (label, value) => `<div class="flex justify-between gap-3 py-1.5 text-sm border-b border-slate-100 dark:border-slate-800 last:border-0"><span class="text-slate-600 dark:text-slate-300">${escapeHtml(label)}</span><span class="font-semibold text-slate-800 dark:text-slate-100 text-right">${escapeHtml(value)}</span></div>`;
  const card = (title, inner) => `<div class="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm p-5"><h3 class="font-extrabold text-sm uppercase tracking-wide text-slate-500 dark:text-slate-400 mb-2">${title}</h3>${inner}</div>`;
  let worst = 0;
  const lvl = (n) => { if (n > worst) worst = n; return n; };
  const chk = window.statusCheck;
  // Verbindung und Versionen
  let conn = '';
  if (!chk) conn += row(lvl(1), 'Verbindung', 'wird geprüft ...');
  else if (!chk.ok) conn += row(lvl(2), 'Verbindung', 'keine Verbindung', 'Das Google-Script ist nicht erreichbar. Änderungen werden auf dem Gerät gespeichert und später gesendet.');
  else conn += row(lvl(chk.ms > 2500 ? 1 : 0), 'Verbindung', chk.ms + ' ms', chk.ms > 2500 ? 'Langsam. Bei schlechtem Netz kann das Senden dauern.' : 'Das Google-Script antwortet.');
  const sv = chk && chk.ok ? chk.version : 0;
  if (sv) conn += row(lvl(sv < SCRIPT_VERSION_NEEDED ? 2 : 0), 'Versionen', 'App ' + APP_VERSION + ' · Script ' + sv, sv < SCRIPT_VERSION_NEEDED ? 'Das Script ist zu alt. Bitte Code.gs erneut als „Neue Version“ bereitstellen.' : 'Passt zusammen.');
  else conn += row(lvl(0), 'Versionen', 'App ' + APP_VERSION);
  const sw = window.swInfo;
  const standalone = isStandalone();
  conn += row(lvl(sw.active ? 0 : 1), 'Offline-Start', sw.active ? 'bereit (' + sw.files + ' Dateien)' : (sw.supported ? 'noch nicht eingerichtet' : 'nicht unterstützt'), sw.active ? 'Die Seite startet auch ohne Internet.' : 'Die Seite öffnen, kurz warten und einmal neu laden.');
  conn += plain('Gestartet als', standalone ? 'App vom Home-Bildschirm' : 'Seite im Browser');
  // Gerät
  const kb = localStorageKb();
  const pend = statusPending();
  let dev = row(lvl(kb > 4200 ? 2 : (kb > 3000 ? 1 : 0)), 'Gerätespeicher', kb + ' KB von etwa 5000 KB', kb > 3000 ? 'Wird knapp. Neue Bilder und große Listen brauchen Platz.' : '');
  if (!pend.length) dev += row(0, 'Wartende Änderungen', 'keine', 'Alles ist gesendet.');
  else dev += row(lvl(chk && !chk.ok ? 2 : 1), 'Wartende Änderungen', pend.reduce((a, x) => a + x[1], 0) + ' auf diesem Gerät', pend.map((x) => x[0] + ': ' + x[1]).join(', ') + '. Sie werden gesendet, sobald das Script antwortet.');
  // Abgleich
  const sync = STATUS_SYNC_AREAS.map((a) => plain(a[1], window.syncTimes[a[0]] ? fmtAgo(window.syncTimes[a[0]]) : 'noch nicht in dieser Sitzung')).join('');
  // Sheet
  let sheet = '';
  const sd = window.statusData;
  if (sd) {
    const cellPct = sd.cells / sd.cellLimit * 100;
    sheet += row(lvl(cellPct > 80 ? 2 : (cellPct > 50 ? 1 : 0)), 'Zellen im Sheet', Math.round(sd.cells / 1000) + ' Tsd. von ' + Math.round(sd.cellLimit / 1000000) + ' Mio.', cellPct > 50 ? 'Google erlaubt höchstens 10 Millionen Zellen pro Tabelle.' : '');
    const big = sd.parts.slice().sort((a, b) => b.chars - a.chars).slice(0, 4);
    big.forEach((x) => {
      const pct = x.chars / sd.cellMax * 100;
      sheet += row(lvl(pct > 90 ? 2 : (pct > 70 ? 1 : 0)), 'Füllstand ' + x.name, Math.round(pct) + ' %', pct > 70 ? 'Jede Liste hat in einer Zelle Platz für etwa ' + sd.cellMax + ' Zeichen. Wird es voll, können keine Einträge mehr dazukommen.' : '');
    });
    const last = sd.backups.last;
    const age = last ? (sd.now - last.ts) / 3600000 : 999;
    sheet += row(lvl(!last ? 2 : (age > 36 ? 1 : 0)), 'Letzte Sicherung', last ? fmtDateTime(last.ts) + ' (' + fmtAgo(last.ts) + ')' : 'keine', last ? sd.backups.count + ' Sicherungen vorhanden' : 'Es gibt noch keine Sicherung.');
    sheet += plain('Angemeldete Geräte (Sitzungen)', String(sd.sessions)) + plain('Benutzer', String(sd.users)) + plain('Einträge im Protokoll', String(sd.logRows));
  } else if (window.statusServerNote) {
    sheet = `<div class="text-xs text-slate-500 dark:text-slate-400 py-2">${escapeHtml(window.statusServerNote)}</div>`;
  } else {
    sheet = '<div class="text-xs text-slate-500 dark:text-slate-400 py-2">Werte vom Sheet werden geladen ...</div>';
  }
  const word = ['Alles in Ordnung', 'Kleine Hinweise', 'Achtung, bitte prüfen'][worst];
  ampel.className = 'rounded-2xl p-5 border flex items-center gap-4 ' + ['bg-emerald-500/10 border-emerald-500/30', 'bg-amber-500/10 border-amber-500/30', 'bg-rose-500/10 border-rose-500/30'][worst];
  ampel.innerHTML = `<span class="w-6 h-6 rounded-full ${LV[worst].dot} shrink-0"></span><div><div class="text-xl font-black ${LV[worst].text}">${word}</div><div class="text-[11px] text-slate-500 dark:text-slate-400">${chk ? 'Geprüft ' + fmtAgo(chk.at) : 'Prüfung läuft ...'}</div></div>`;
  root.innerHTML = card('Verbindung und App', conn) + card('Dieses Gerät', dev) + card('Zuletzt abgeglichen', sync) + card('Google Sheet', sheet);
  const bb = document.getElementById('statusBackupBtn');
  if (bb) bb.classList.toggle('hidden', !window.can('system.backup'));
}
// Ganz frisch neu laden: Zwischenspeicher leeren, damit die neueste Version kommt
window.reloadApp = async function () {
  try {
    if (typeof caches !== 'undefined') {
      const keys = await caches.keys();
      await Promise.all(keys.filter((k) => k.indexOf('wm-shell-') === 0).map((k) => caches.delete(k)));
    }
  } catch (e) { /* egal */ }
  try { window.location.reload(); } catch (e) { /* egal */ }
};
function updateNavVersion() {
  setText('navVersion', 'App ' + APP_VERSION + (window.scriptVersion ? ' · Script ' + window.scriptVersion : '') + (window.startTiming ? ' · Start ' + (window.startTiming.ms / 1000).toFixed(1).replace('.', ',') + ' s' : ''));
}
// Beim Start: passt das Script zur App? (sonst klare Meldung statt stiller Fehler)
async function checkScriptVersion() {
  const ping = await getJson('ping');
  window.scriptVersion = ping ? Number(ping.version) || 0 : 0;
  updateNavVersion();
  if (!ping && window.isLoggedIn() && window.wmBanner && navigator.onLine !== false) window.wmBanner('script', 'Das Google-Script antwortet nicht. Stimmt die Script-URL in weihnachtsmarkt.js und ist das Script als Web-App für alle freigegeben?');
  if (ping && window.scriptVersion < SCRIPT_VERSION_NEEDED && window.isLoggedIn()) {
    const txt = 'Das Google-Script ist noch Version ' + window.scriptVersion + ', die App braucht mindestens ' + SCRIPT_VERSION_NEEDED + '. Bitte Code.gs als Neue Version bereitstellen. Bis dahin funktionieren einzelne Bereiche nicht.';
    notify(txt);
    if (window.wmBanner) window.wmBanner('script', txt);
  }
}

// ---------- Aenderungsprotokoll ----------
window.logState = { entries: [], areas: [], more: false, error: '', loading: false };
window.loadProtokoll = async function (reset) {
  const st = window.logState;
  if (st.loading) return;
  const box = document.getElementById('logList');
  if (!window.session || !window.session.token) {
    st.error = 'Bitte einmal abmelden und neu anmelden, dann zeigt das Protokoll die Einträge.';
    renderProtokoll();
    return;
  }
  st.loading = true;
  const val = (id) => { const el = document.getElementById(id); return el ? String(el.value || '').trim() : ''; };
  const params = { token: window.session.token, limit: 100 };
  if (val('logArea')) params.area = val('logArea');
  if (val('logQ')) params.q = val('logQ');
  if (val('logFrom')) params.from = new Date(val('logFrom') + 'T00:00:00').getTime();
  if (val('logTo')) params.to = new Date(val('logTo') + 'T23:59:59').getTime();
  if (!reset && st.entries.length) params.before = st.entries[st.entries.length - 1].t;
  const r = await getJson('log', params);
  st.loading = false;
  if (!r) st.error = 'Keine Verbindung.';
  else if (r.code === 'auth') st.error = 'Die Anmeldung ist abgelaufen. Bitte neu anmelden.';
  else if (r.code === 'perm') st.error = 'Dafür fehlt dir die Berechtigung.';
  else if (Array.isArray(r.entries)) {
    st.error = '';
    st.entries = reset ? r.entries : st.entries.concat(r.entries);
    st.more = !!r.more;
    st.areas = r.areas || st.areas;
  }
  renderProtokoll();
};
function renderProtokoll() {
  const st = window.logState;
  const box = document.getElementById('logList');
  if (!box) return;
  const sel = document.getElementById('logArea');
  if (sel && st.areas.length && sel.dataset.filled !== st.areas.join('|')) {
    const cur = sel.value;
    sel.innerHTML = '<option value="">Alle Bereiche</option>' + st.areas.map((a) => `<option value="${escapeHtml(a)}">${escapeHtml(a)}</option>`).join('');
    sel.value = cur;
    sel.dataset.filled = st.areas.join('|');
  }
  if (st.error) box.innerHTML = `<div class="p-6 text-sm text-slate-500 dark:text-slate-400">${escapeHtml(st.error)}</div>`;
  else if (!st.entries.length) box.innerHTML = '<div class="p-6 text-sm text-slate-500 dark:text-slate-400">Keine Einträge gefunden.</div>';
  else box.innerHTML = st.entries.map((e) => `<div class="flex flex-wrap items-baseline gap-x-3 gap-y-1 px-4 py-2.5 border-b border-slate-100 dark:border-slate-800 last:border-0">
      <span class="text-[11px] font-bold text-slate-400 tabular-nums w-28 shrink-0">${fmtDateTime(e.t)}</span>
      <span class="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">${escapeHtml(e.a)}</span>
      <span class="text-sm text-slate-800 dark:text-slate-100 flex-1 min-w-[12rem]">${escapeHtml(e.x)}</span>
      <span class="text-[11px] text-slate-500 dark:text-slate-400">${escapeHtml(e.n || 'unbekannt')}${e.r ? ' · ' + escapeHtml(e.r) : ''}</span>
    </div>`).join('');
  const more = document.getElementById('logMore');
  if (more) more.classList.toggle('hidden', !st.more || !!st.error);
}

// ---------- App auf dem Home-Bildschirm (Offline-Start) ----------
function setupApp() {
  try {
    const head = document.head || document.getElementsByTagName('head')[0];
    const add = (tag, attrs) => {
      const el = document.createElement(tag);
      Object.keys(attrs).forEach((k) => el.setAttribute(k, attrs[k]));
      head.appendChild(el);
    };
    add('meta', { name: 'apple-mobile-web-app-capable', content: 'yes' });
    add('meta', { name: 'mobile-web-app-capable', content: 'yes' });
    add('meta', { name: 'apple-mobile-web-app-title', content: 'Markt' });
    add('meta', { name: 'apple-mobile-web-app-status-bar-style', content: 'default' });
    add('link', { rel: 'apple-touch-icon', href: '/assets/weihnachtsmarkt/app-icon-180.png' });
  } catch (e) { /* egal */ }
  try {
    if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return;
    const send = (reg) => {
      const urls = [location.origin + location.pathname].concat(performance.getEntriesByType('resource').map((r) => r.name)
        .filter((u) => /^https?:/.test(u) && !/script\.google/.test(u)));
      if (reg && reg.active) reg.active.postMessage({ type: 'cache-urls', urls: Array.from(new Set(urls)) });
    };
    navigator.serviceWorker.register('/weihnachtsmarkt/sw.js', { scope: '/weihnachtsmarkt/' })
      .then(() => navigator.serviceWorker.ready)
      .then((reg) => { if (!navigator.serviceWorker.controller) setTimeout(() => send(reg), 4000); })
      .catch(() => { /* egal */ });
  } catch (e) { /* egal */ }
}


// =====================================================================
// Kasse: Tag abschliessen, Uebungsmodus, Kassensturz, Kiosk
// =====================================================================
window.practiceMode = false;
let practiceCounts = {};
function practiceTotalsFor(day) {
  const out = {};
  kasseProductIds().forEach((p) => {
    out[p] = { paid: practiceCounts[day + '_' + p + '_paid'] || 0, free: practiceCounts[day + '_' + p + '_free'] || 0 };
  });
  return out;
}
function dayClosedNow(day) {
  const c = window.kasseCfg && window.kasseCfg.closed && window.kasseCfg.closed[day];
  return c || null;
}
const dayName = (d) => (d === 'samstag' ? 'Samstag' : 'Sonntag');
window.togglePractice = function () {
  if (!window.can('kasse.practice')) return;
  if (window.practiceMode) {
    window.practiceMode = false;
    practiceCounts = {};
    kasseLast = null;
    hideKasseUndo();
    notify('Übungsmodus beendet. Die Übungszahlen sind gelöscht.');
  } else {
    window.practiceMode = true;
    practiceCounts = {};
    window.kasseEditMode = false;
    sturzOpen = false;
    notify('Übungsmodus: Buchungen werden nicht gespeichert und zählen nicht.');
  }
  window.renderKasse();
};
window.resetPractice = function () {
  practiceCounts = {};
  kasseLast = null;
  hideKasseUndo();
  window.renderKasse();
};
function applyCloseReply(r) {
  if (!r || r.status !== 'success') {
    notify(r && r.message ? r.message : 'Nicht möglich (keine Verbindung oder die Anmeldung ist abgelaufen).');
    return false;
  }
  kasseServerCfg = normalizeKasseConfig(r.config);
  persistKasse();
  recomputeKasse();
  window.renderKasse();
  window.renderStatistik();
  return true;
}
window.toggleDayClosed = async function () {
  if (window.practiceMode) return;
  const day = window.kasseDay;
  const closed = dayClosedNow(day);
  const name = dayName(day);
  if (!window.session || !window.session.token) {
    notify('Bitte einmal abmelden und neu anmelden, dann kann ich den Tag abschließen oder öffnen.');
    return;
  }
  if (closed) {
    if (!window.can('kasse.reopen')) return;
    const ok = await window.uiConfirm({ title: name + ' wieder öffnen?', message: 'Danach kann an diesem Tag wieder gebucht und korrigiert werden.', okText: 'Wieder öffnen' });
    if (!ok) return;
    applyCloseReply(await postJson({ action: 'kasseReopen', token: window.session.token, day: day }));
    return;
  }
  if (!window.can('kasse.close')) return;
  await window.syncKasse();
  if (kasseOps.length) {
    notify('Auf diesem Gerät warten noch Buchungen. Zum Abschließen wird Internet gebraucht, bitte später noch einmal versuchen.');
    return;
  }
  const it = sturzItem(day);
  const hasSturz = !!(it && (it.abendAt > 0 || sturzSum(it.abend) > 0));
  const ok = await window.uiConfirm({
    title: name + ' abschließen?',
    message: (hasSturz ? '' : 'Für diesen Tag gibt es noch keinen Kassensturz. ') + 'Danach nimmt die Kasse für ' + name + ' keine Buchungen und keine Korrekturen mehr an. Nur ein Administrator kann den Tag wieder öffnen.',
    okText: hasSturz ? 'Abschließen' : 'Trotzdem abschließen'
  });
  if (!ok) return;
  applyCloseReply(await postJson({ action: 'kasseClose', token: window.session.token, day: day }));
};
function renderKasseExtras() {
  const day = window.kasseDay;
  const closed = dayClosedNow(day);
  const practice = !!window.practiceMode;
  const kiosk = !!window.kioskActive;
  const show = (id, on) => { const el = document.getElementById(id); if (el) el.classList.toggle('hidden', !on); };
  const banner = document.getElementById('kasseBanner');
  if (banner) {
    let html = '';
    if (practice) {
      html = `<div class="flex flex-wrap items-center justify-between gap-3 bg-amber-400/20 border-2 border-amber-500 text-amber-900 dark:text-amber-200 rounded-2xl px-4 py-3"><span class="font-black text-sm">🎓 ÜBUNGSMODUS – nichts wird gespeichert, nichts zählt</span><span class="flex gap-2"><button type="button" onclick="resetPractice()" class="px-3 py-1.5 rounded-xl bg-white/70 dark:bg-slate-900/60 border border-amber-500/50 text-xs font-bold">Zahlen löschen</button><button type="button" onclick="togglePractice()" class="px-3 py-1.5 rounded-xl bg-amber-500 text-slate-950 text-xs font-black">Übung beenden</button></span></div>`;
    } else if (closed) {
      html = `<div class="bg-slate-800 text-white dark:bg-slate-700 rounded-2xl px-4 py-3 text-sm font-bold">🔒 ${escapeHtml(dayName(day))} ist abgeschlossen. <span class="font-semibold opacity-80">Abgeschlossen von ${escapeHtml(closed.by || 'unbekannt')} am ${fmtDateTime(closed.ts)}. Gebucht und korrigiert wird erst wieder, wenn ein Administrator den Tag öffnet.</span></div>`;
    }
    banner.innerHTML = html;
    banner.classList.toggle('hidden', !html);
  }
  show('kasseSturzBtn', window.can('kasse.sturz') && !practice);
  const sb = document.getElementById('kasseSturzBtn');
  if (sb) sb.innerText = sturzOpen ? '✓ Kassensturz schließen' : '💰 Kassensturz';
  show('kasseCloseBtn', !practice && (closed ? window.can('kasse.reopen') : window.can('kasse.close')));
  const cb = document.getElementById('kasseCloseBtn');
  if (cb) cb.innerText = closed ? '🔓 ' + dayName(day) + ' wieder öffnen' : '🔒 ' + dayName(day) + ' abschließen';
  show('kassePracticeBtn', window.can('kasse.practice'));
  const pb = document.getElementById('kassePracticeBtn');
  if (pb) pb.innerText = practice ? '✓ Übung beenden' : '🎓 Übungsmodus';
  show('kasseKioskBtn', window.can('system.kiosk') && !practice && !kiosk);
  show('kasseKioskHint', kiosk);
  if (closed || practice) {
    const eb = document.getElementById('kasseEditBtn');
    if (eb) eb.classList.add('hidden');
    window.kasseEditMode = false;
  }
  const prods = document.getElementById('kasseProducts');
  if (prods) prods.classList.toggle('opacity-60', !!closed && !practice);
  show('kasseSturzPanel', sturzOpen && window.can('kasse.sturz') && !practice);
  renderSturz();
}

// ---------- Kassensturz ----------
const STURZ_DENOMS = [['1', '1 ct'], ['2', '2 ct'], ['5', '5 ct'], ['10', '10 ct'], ['20', '20 ct'], ['50', '50 ct'], ['100', '1 €'], ['200', '2 €'], ['500', '5 €'], ['1000', '10 €'], ['2000', '20 €'], ['5000', '50 €'], ['10000', '100 €']];
let sturzOpen = false;
function emptyDenoms() {
  const o = {};
  STURZ_DENOMS.forEach((d) => { o[d[0]] = 0; });
  return o;
}
function sturzItem(day) {
  return kassensturzStore.items().find((x) => x.id === day) || null;
}
function sturzBase(day) {
  const it = sturzItem(day);
  return it ? clone(it) : { id: day, anfang: emptyDenoms(), abend: emptyDenoms(), anfangAt: 0, abendAt: 0, entnahmen: [], by: '' };
}
function sturzSum(d) {
  return round2(STURZ_DENOMS.reduce((s, x) => s + (Number(d && d[x[0]]) || 0) * Number(x[0]) / 100, 0));
}
function sturzCalc(day) {
  const it = sturzBase(day);
  const f = window.getFinance();
  const anfang = sturzSum(it.anfang);
  const abend = sturzSum(it.abend);
  const sales = f.days[day].sales;
  const spende = f.days[day].spende;
  const ent = round2((it.entnahmen || []).reduce((s, e) => s + e.amount, 0));
  const soll = round2(anfang + sales + spende - ent);
  return { it: it, anfang: anfang, abend: abend, sales: sales, spende: spende, ent: ent, soll: soll, diff: round2(abend - soll), done: it.abendAt > 0 || abend > 0 };
}
window.toggleSturz = function () {
  if (!window.can('kasse.sturz') || window.practiceMode) return;
  sturzOpen = !sturzOpen;
  renderKasseExtras();
};
function sturzResultHtml(c) {
  const line = (label, value, cls) => `<div class="flex justify-between gap-3 py-1 text-sm ${cls || ''}"><span>${label}</span><span class="font-bold tabular-nums">${value}</span></div>`;
  let verdict = '';
  if (c.done) {
    const ad = Math.abs(c.diff);
    const cls = ad < 0.005 ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300' : (ad <= 2 ? 'bg-amber-500/15 text-amber-700 dark:text-amber-300' : 'bg-rose-500/15 text-rose-700 dark:text-rose-300');
    const txt = ad < 0.005 ? 'Die Kasse stimmt auf den Cent.' : (c.diff > 0 ? 'Es sind ' + formatEuro(ad) + ' zu viel in der Kasse.' : 'Es fehlen ' + formatEuro(ad) + '.');
    verdict = `<div class="mt-3 rounded-xl px-4 py-3 font-black ${cls}">${txt}</div>`;
  } else {
    verdict = '<div class="mt-3 rounded-xl px-4 py-3 text-xs text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800">Trag unten das Bargeld vom Abend ein, dann steht hier die Differenz.</div>';
  }
  return line('Anfangsbestand (Wechselgeld)', formatEuro(c.anfang)) + line('+ Verkäufe', formatEuro(c.sales)) + line('+ Spendenente', formatEuro(c.spende)) + line('− Entnahmen', formatEuro(c.ent)) +
    line('= Soll in der Kasse', formatEuro(c.soll), 'border-t border-slate-200 dark:border-slate-700 mt-1 pt-2 font-black') + line('Gezählt am Abend (Ist)', formatEuro(c.abend), 'font-black') + verdict;
}
function updateSturzSums() {
  const day = window.kasseDay;
  const c = sturzCalc(day);
  ['anfang', 'abend'].forEach((w) => {
    STURZ_DENOMS.forEach((d) => setText('sturzSum_' + w + '_' + d[0], formatEuro(round2((Number(c.it[w][d[0]]) || 0) * Number(d[0]) / 100))));
    setText('sturzTotal_' + w, formatEuro(w === 'anfang' ? c.anfang : c.abend));
  });
  const res = document.getElementById('sturzResult');
  if (res) res.innerHTML = sturzResultHtml(c);
}
function renderSturz() {
  const root = document.getElementById('sturzRoot');
  if (!root) return;
  const panel = document.getElementById('kasseSturzPanel');
  const visible = sturzOpen && window.can('kasse.sturz') && !window.practiceMode;
  if (panel) panel.classList.toggle('hidden', !visible);
  if (!visible) return;
  const ae = document.activeElement;
  if (ae && ae.closest && ae.closest('#sturzRoot')) { updateSturzSums(); return; }
  const day = window.kasseDay;
  const closed = !!dayClosedNow(day);
  const c = sturzCalc(day);
  const dis = closed ? 'disabled' : '';
  const inputCls = 'w-20 text-right bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg py-1.5 px-2 font-bold text-sm disabled:opacity-60';
  const col = (w, title, hint) => `<div class="space-y-2"><div><h4 class="font-extrabold text-sm text-slate-900 dark:text-slate-100">${title}</h4><p class="text-[11px] text-slate-500 dark:text-slate-400">${hint}</p></div>` +
    STURZ_DENOMS.map((d) => `<div class="flex items-center gap-2"><span class="w-12 text-sm font-bold text-slate-700 dark:text-slate-200">${d[1]}</span><input type="number" min="0" max="9999" inputmode="numeric" ${dis} value="${Number(c.it[w][d[0]]) || 0}" onfocus="this.select()" onchange="setSturzCount('${w}', '${d[0]}', this.value)" class="${inputCls}" /><span id="sturzSum_${w}_${d[0]}" class="flex-1 text-right text-xs font-semibold text-slate-500 dark:text-slate-400 tabular-nums">${formatEuro(round2((Number(c.it[w][d[0]]) || 0) * Number(d[0]) / 100))}</span></div>`).join('') +
    `<div class="flex justify-between border-t border-slate-200 dark:border-slate-700 pt-2 text-sm font-black"><span>Summe</span><span id="sturzTotal_${w}" class="tabular-nums">${formatEuro(w === 'anfang' ? c.anfang : c.abend)}</span></div></div>`;
  const ents = (c.it.entnahmen || []).map((e) => `<div class="flex items-center justify-between gap-2 py-1.5 border-b border-slate-100 dark:border-slate-800 text-xs"><span class="text-slate-700 dark:text-slate-200 font-semibold">${escapeHtml(e.note || 'Entnahme')}</span><span class="flex items-center gap-2"><span class="font-black">− ${formatEuro(e.amount)}</span>${closed ? '' : `<button type="button" onclick="delEntnahme('${escapeHtml(e.id)}')" class="px-2 py-1 bg-rose-500/10 text-rose-500 border border-rose-500/30 rounded-lg font-bold">🗑️</button>`}</span></div>`).join('');
  root.innerHTML = `<div class="flex flex-wrap items-center justify-between gap-2 mb-4"><h3 class="font-black text-xl text-amber-600 dark:text-amber-400">💰 Kassensturz ${escapeHtml(dayName(day))}</h3>${closed ? '<span class="text-xs font-bold text-slate-500">Tag abgeschlossen: nur ansehen</span>' : ''}</div>
    <div class="grid grid-cols-1 md:grid-cols-2 gap-6">${col('anfang', 'Anfangsbestand', 'Wechselgeld, das morgens in die Kasse kommt')}${col('abend', 'Bargeld am Abend', 'Alles zählen, was jetzt in der Kasse liegt')}</div>
    <div class="mt-6 grid grid-cols-1 md:grid-cols-2 gap-6">
      <div><h4 class="font-extrabold text-sm text-slate-900 dark:text-slate-100 mb-1">Entnahmen</h4><p class="text-[11px] text-slate-500 dark:text-slate-400 mb-2">Geld, das während des Tages aus der Kasse genommen wurde, zum Beispiel in den Tresor.</p>${ents || '<div class="text-xs text-slate-500 dark:text-slate-400 py-1">Keine Entnahmen.</div>'}
        ${closed ? '' : `<div class="flex flex-wrap gap-2 mt-2"><input id="sturzEntAmount" type="text" inputmode="decimal" placeholder="Betrag" class="w-24 text-right bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg py-1.5 px-2 text-sm font-bold" /><input id="sturzEntNote" type="text" maxlength="80" placeholder="Wofür, z. B. Tresor" class="flex-1 min-w-[8rem] bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg py-1.5 px-2 text-sm" /><button type="button" onclick="addEntnahme()" class="px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-slate-950 text-xs font-black rounded-xl">➕</button></div>`}
      </div>
      <div><h4 class="font-extrabold text-sm text-slate-900 dark:text-slate-100 mb-1">Ergebnis</h4><div id="sturzResult">${sturzResultHtml(c)}</div></div>
    </div>`;
}
window.setSturzCount = function (which, key, value) {
  const day = window.kasseDay;
  if (!window.can('kasse.sturz') || dayClosedNow(day) || (which !== 'anfang' && which !== 'abend')) return;
  const text = String(value).trim();
  const n = text === '' ? 0 : parseInt(text, 10);
  if (isNaN(n) || n < 0 || n > 9999) {
    notify('Bitte eine ganze Zahl zwischen 0 und 9999 eintragen.');
    sturzForce();
    return;
  }
  const it = sturzBase(day);
  it[which][key] = n;
  if (which === 'abend') it.abendAt = Date.now(); else it.anfangAt = Date.now();
  const a = actorInfo();
  it.by = a.n || a.r;
  kassensturzStore.apply({ op: 'save', item: it });
  updateSturzSums();
};
function sturzForce() {
  const ae = document.activeElement;
  if (ae && ae.blur) ae.blur();
  renderSturz();
}
window.addEntnahme = function () {
  const day = window.kasseDay;
  if (!window.can('kasse.sturz') || dayClosedNow(day)) return;
  const amount = parseEuro((document.getElementById('sturzEntAmount') || {}).value || '');
  if (amount === null || amount <= 0) { notify('Bitte einen Betrag über 0 eintragen, z. B. 50.'); return; }
  const it = sturzBase(day);
  it.entnahmen = (it.entnahmen || []).concat([{ id: newId('n'), amount: amount, note: String((document.getElementById('sturzEntNote') || {}).value || '').trim().slice(0, 80), ts: Date.now() }]);
  const a = actorInfo();
  it.by = a.n || a.r;
  kassensturzStore.apply({ op: 'save', item: it });
  sturzForce();
};
window.delEntnahme = async function (id) {
  const day = window.kasseDay;
  if (!window.can('kasse.sturz') || dayClosedNow(day)) return;
  const it = sturzBase(day);
  const e = (it.entnahmen || []).find((x) => x.id === id);
  if (!e) return;
  const ok = await window.uiConfirm({ title: 'Entnahme löschen?', message: formatEuro(e.amount) + (e.note ? ' (' + e.note + ')' : '') + ' wird gelöscht.', okText: 'Löschen' });
  if (!ok) return;
  it.entnahmen = it.entnahmen.filter((x) => x.id !== id);
  kassensturzStore.apply({ op: 'save', item: it });
  sturzForce();
};

// ---------- Kiosk-Modus ----------
function applyKioskUi() {
  const kiosk = !!window.kioskActive;
  ['roleBadge', 'themeToggleBtn', 'homeBtn'].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.classList.toggle('hidden', kiosk);
  });
  if (kiosk) {
    const b = document.getElementById('burgerMenuBtn');
    if (b) b.classList.add('hidden');
  }
}
window.startKiosk = async function () {
  if (!window.can('system.kiosk') || window.practiceMode) return;
  if (!window.can('kasse.book')) {
    notify('Dieses Gerät braucht eine Anmeldung, die an der Kasse buchen darf.');
    return;
  }
  const ok = await window.uiConfirm({
    title: 'Kiosk-Modus starten?',
    message: 'Dieses Gerät zeigt danach nur noch die Kasse (Buchen und Rückgängig). Menü, Anmeldung und alle anderen Seiten sind gesperrt. Beenden: den Titel oben 3 Sekunden gedrückt halten und mit einem Konto anmelden, das den Kiosk-Modus beenden darf. Für ein wirklich gesperrtes iPad zusätzlich „Geführten Zugriff“ einschalten.',
    okText: 'Starten'
  });
  if (!ok) return;
  try { localStorage.setItem('kiosk', '1'); } catch (e) { /* egal */ }
  window.kioskActive = true;
  window.applyPermissionUi();
  window.switchView('verkauf');
};
window.exitKioskDialog = async function () {
  if (!window.kioskActive) return;
  const roleOpts = window.rolesData.filter((r) => r.hasPw && r.id !== 'gast' && r.perms.indexOf('system.kiosk') >= 0).map((r) => ({ value: 'role:' + r.id, label: 'Rollen-Passwort: ' + r.name }));
  const v = await window.uiForm({
    title: 'Kiosk-Modus beenden',
    fields: [
      { key: 'kind', label: 'Anmelden mit', type: 'select', value: 'user', options: [{ value: 'user', label: 'Benutzername und Passwort' }].concat(roleOpts) },
      { key: 'name', label: 'Benutzername (nur bei „Benutzername und Passwort“)', type: 'text', value: '' },
      { key: 'password', label: 'Passwort', type: 'password', value: '' }
    ],
    okText: 'Beenden'
  });
  if (!v) return;
  const payload = v.kind === 'user' ? { kind: 'user', name: v.name, password: v.password } : { kind: 'role', role: String(v.kind).slice(5), password: v.password };
  const res = await postJson(Object.assign({ action: 'login' }, payload));
  if (!res) { notify('Keine Verbindung. Zum Beenden des Kiosk-Modus wird Internet gebraucht.'); return; }
  if (res.status !== 'success') { notify(res.message || 'Falsche Anmeldedaten.'); return; }
  if (res.perms.indexOf('system.kiosk') < 0) {
    postJson({ action: 'logout', token: res.token });
    notify('Mit diesem Konto darf der Kiosk-Modus nicht beendet werden.');
    return;
  }
  if (window.session && window.session.token) postJson({ action: 'logout', token: window.session.token });
  try { localStorage.setItem('kiosk', '0'); } catch (e) { /* egal */ }
  window.kioskActive = false;
  window.session = { token: res.token, user: res.user || '', roles: res.roles || [], perms: res.user ? res.perms : [] };
  lsSet('session4', window.session);
  if (!window.roleById(res.role.id)) window.rolesData.push({ id: res.role.id, name: res.role.name, desc: '', perms: res.perms, hasPw: true, builtin: false });
  window.setRole(res.role.id, { user: res.user || '', perms: res.perms });
  window.refreshRoles();
  notify('Kiosk-Modus beendet.');
};
function setupKioskExit() {
  const h = document.getElementById('headerTitle');
  if (!h || !h.addEventListener) return;
  let timer = null;
  const start = () => { if (!window.kioskActive) return; clearTimeout(timer); timer = setTimeout(() => window.exitKioskDialog(), 3000); };
  const stop = () => clearTimeout(timer);
  ['touchstart', 'mousedown'].forEach((ev) => h.addEventListener(ev, start));
  ['touchend', 'touchcancel', 'mouseup', 'mouseleave'].forEach((ev) => h.addEventListener(ev, stop));
}

// =====================================================================
// Statistik: Verkaeufe pro Stunde, Belege, Abrechnung
// =====================================================================
window.hourlyData = null;
window.hourlyNote = '';
const PRODUCT_HEX = { rose: '#f43f5e', amber: '#f59e0b', emerald: '#10b981', sky: '#0ea5e9', violet: '#8b5cf6', orange: '#f97316', teal: '#14b8a6', fuchsia: '#d946ef' };
window.loadHourly = async function () {
  if (!window.can('view.statistik')) return;
  if (!window.session || !window.session.token) {
    window.hourlyNote = 'Bitte einmal abmelden und neu anmelden, dann erscheinen hier die Verkäufe pro Stunde.';
    renderHourly();
    return;
  }
  const r = await getJson('hourly', { token: window.session.token });
  if (r && r.status === 'success') { window.hourlyData = r; window.hourlyNote = ''; }
  else window.hourlyNote = r ? (r.code === 'auth' ? 'Die Anmeldung ist abgelaufen. Bitte neu anmelden.' : 'Dafür fehlt dir die Berechtigung.') : 'Keine Verbindung.';
  renderHourly();
};
function hourlyColumns(data, prods) {
  const hours = {};
  prods.forEach((p) => Object.keys(data[p.id] || {}).forEach((h) => { hours[h] = true; }));
  const hs = Object.keys(hours).map(Number);
  if (!hs.length) return [];
  const lo = Math.min.apply(null, hs);
  let hi = Math.max.apply(null, hs);
  if (hi - lo < 4) hi = Math.min(23, lo + 4);
  const cols = [];
  for (let h = lo; h <= hi; h++) {
    const parts = prods.map((p) => Math.max(0, (data[p.id] && data[p.id][h]) || 0));
    cols.push({ h: h, parts: parts, total: parts.reduce((a, b) => a + b, 0) });
  }
  return cols;
}
function hourlySvg(day, cols, prods) {
  const max = Math.max.apply(null, [1].concat(cols.map((c) => c.total)));
  const W = Math.max(320, cols.length * 46);
  const H = 200;
  const padB = 28;
  const padT = 22;
  const bw = 30;
  const step = W / cols.length;
  let svg = `<svg viewBox="0 0 ${W} ${H}" class="w-full text-slate-700 dark:text-slate-200" role="img" aria-label="Verkäufe pro Stunde am ${dayName(day)}">`;
  cols.forEach((c, i) => {
    const x = i * step + (step - bw) / 2;
    let y = H - padB;
    c.parts.forEach((v, k) => {
      if (!v) return;
      const hgt = v / max * (H - padB - padT);
      y -= hgt;
      svg += `<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${bw}" height="${hgt.toFixed(1)}" rx="3" fill="${PRODUCT_HEX[prods[k].color] || '#64748b'}"><title>${escapeHtml(prods[k].name)}: ${v}</title></rect>`;
    });
    if (c.total) svg += `<text x="${(x + bw / 2).toFixed(1)}" y="${(y - 4).toFixed(1)}" text-anchor="middle" font-size="11" font-weight="700" fill="currentColor">${c.total}</text>`;
    svg += `<text x="${(x + bw / 2).toFixed(1)}" y="${H - 10}" text-anchor="middle" font-size="11" fill="currentColor" opacity=".7">${c.h}</text>`;
  });
  return svg + `<line x1="0" y1="${H - padB}" x2="${W}" y2="${H - padB}" stroke="currentColor" opacity=".2"/></svg>`;
}
function renderHourly() {
  const root = document.getElementById('statHourlyRoot');
  if (!root) return;
  if (!window.can('view.statistik')) { root.innerHTML = ''; return; }
  if (!window.hourlyData) {
    root.innerHTML = `<div class="text-xs text-slate-500 dark:text-slate-400 py-2">${escapeHtml(window.hourlyNote || 'Lade Verkäufe pro Stunde ...')}</div>`;
    return;
  }
  const prods = kasseProducts();
  root.innerHTML = KASSE_DAYS.map((day) => {
    const data = (window.hourlyData.hours && window.hourlyData.hours[day]) || {};
    const cols = hourlyColumns(data, prods);
    let body;
    if (!cols.length) body = '<div class="text-xs text-slate-500 dark:text-slate-400 py-3">Noch keine Buchungen mit Uhrzeit.</div>';
    else {
      const peak = cols.reduce((a, c) => (c.total > a.total ? c : a), cols[0]);
      const hourlySum = prods.reduce((s, p) => s + Object.keys(data[p.id] || {}).reduce((a, h) => a + data[p.id][h], 0), 0);
      const real = prods.reduce((s, p) => s + ((window.kasseTotals[day] && window.kasseTotals[day][p.id] && window.kasseTotals[day][p.id].paid) || 0), 0);
      const legend = prods.map((p) => `<span class="inline-flex items-center gap-1.5 text-[11px] font-semibold text-slate-600 dark:text-slate-300"><span class="w-2.5 h-2.5 rounded-sm" style="background:${PRODUCT_HEX[p.color] || '#64748b'}"></span>${escapeHtml(p.name)}</span>`).join('');
      body = `<div class="flex flex-wrap gap-x-4 gap-y-1 mb-2">${legend}</div>${hourlySvg(day, cols, prods)}
        <div class="text-[11px] text-slate-500 dark:text-slate-400 mt-1">Die Zahl unter dem Balken ist die Stunde (10 heißt 10 bis 11 Uhr). Stärkste Stunde: <b>${peak.h} bis ${peak.h + 1} Uhr</b> mit ${peak.total} Stück.</div>
        ${hourlySum !== real ? `<div class="text-[11px] text-amber-600 dark:text-amber-400 mt-1">Hier zählen nur Buchungen mit Uhrzeit: ${hourlySum} von ${real} bezahlten Stück. Buchungen aus der Zeit vor dem Update und Korrekturen haben keine Uhrzeit.</div>` : ''}`;
    }
    return `<div class="mb-5 last:mb-0"><div class="font-extrabold text-sm text-slate-900 dark:text-slate-100 mb-1">${dayName(day)}</div>${body}</div>`;
  }).join('');
}

// ---------- Belege ----------
function belegKey(id) { return 'beleg_' + id; }
function belegButtonsHtml(e) {
  const b = 'px-2 py-1 rounded-lg font-bold border text-[11px] bg-slate-100 dark:bg-slate-800 border-slate-300 dark:border-slate-700';
  const id = escapeHtml(e.id);
  const can = window.can('finance.receipt');
  if (e.beleg) {
    return `<button type="button" onclick="viewBeleg('${id}')" title="Beleg ansehen" class="${b}">${e.bt === 'pdf' ? '📄' : '🧾'} Beleg</button>` +
      (can ? `<button type="button" onclick="attachBeleg('${id}')" title="Beleg ersetzen" class="${b}">↻</button><button type="button" onclick="removeBeleg('${id}')" title="Beleg entfernen" class="${b}">✕</button>` : '');
  }
  return can ? `<button type="button" onclick="attachBeleg('${id}')" title="Foto oder Scan anhängen" class="${b}">📎 Beleg</button>` : '';
}
async function fileToBase64(file) {
  const buf = new Uint8Array(await file.arrayBuffer());
  let bin = '';
  for (let i = 0; i < buf.length; i += 0x8000) bin += String.fromCharCode.apply(null, buf.subarray(i, i + 0x8000));
  return btoa(bin);
}
function needToken(text) {
  if (window.session && window.session.token) return true;
  notify(text || 'Bitte einmal abmelden und neu anmelden, dann klappt das.');
  return false;
}
window.attachBeleg = function (id) {
  if (!window.can('finance.receipt') || !needToken('Bitte einmal abmelden und neu anmelden, dann kann ich Belege speichern.')) return;
  const inp = document.createElement('input');
  inp.type = 'file';
  inp.accept = 'image/*,application/pdf';
  inp.onchange = () => { const f = inp.files && inp.files[0]; if (f) window.attachBelegFile(id, f); };
  inp.click();
};
window.attachBelegFile = async function (id, file) {
  if (!window.can('finance.receipt') || !needToken('Bitte einmal abmelden und neu anmelden, dann kann ich Belege speichern.')) return;
  const item = expenseStore.items().find((e) => e.id === id);
  if (!item) return;
  notify('Beleg wird verarbeitet ...');
  let data;
  let type;
  try {
    if (/pdf/i.test(file.type || '') || /\.pdf$/i.test(file.name || '')) {
      if (file.size > 700 * 1024) { notify('Das PDF ist größer als 700 KB. Bitte als Foto aufnehmen oder das PDF verkleinern.'); return; }
      data = 'data:application/pdf;base64,' + await fileToBase64(file);
      type = 'pdf';
    } else {
      data = await fileToCompressed(file, 1600);
      type = 'img';
    }
  } catch (e) { notify(e.message || 'Die Datei konnte nicht gelesen werden.'); return; }
  const key = belegKey(id);
  const sig = hashString(data);
  const r = await postJson({ action: 'image', token: window.session.token, name: key, data: data, sig: sig });
  if (!r || r.status !== 'success') { notify('Beleg nicht gespeichert: ' + (r && r.message ? r.message : 'keine Verbindung oder Anmeldung abgelaufen') + '. Belege brauchen Internet.'); return; }
  const meta = await getJson('imagemeta', { names: key, token: window.session.token });
  if (!(meta && meta[key] && meta[key].sig === sig)) { notify('Das Sheet hat den Beleg nicht bestätigt. Bitte noch einmal versuchen.'); return; }
  expenseStore.apply({ op: 'save', item: Object.assign({}, item, { beleg: key, bt: type }) });
  window.renderStatistik(true);
  notify('Beleg gespeichert.');
};
window.viewBeleg = async function (id) {
  const item = expenseStore.items().find((e) => e.id === id);
  if (!item || !item.beleg || !needToken('Bitte einmal abmelden und neu anmelden, dann kann ich Belege zeigen.')) return;
  const win = item.bt === 'pdf' && typeof window.open === 'function' ? window.open('', '_blank') : null;
  const res = await getJson('image', { name: item.beleg, token: window.session.token });
  if (!res || res.status !== 'ok' || !res.data) {
    if (win && win.close) win.close();
    notify(res && res.status === 'empty' ? 'Der Beleg wurde im Sheet nicht gefunden.' : 'Der Beleg konnte nicht geladen werden (Internet oder Anmeldung).');
    return;
  }
  if (res.data.indexOf('data:application/pdf') === 0) {
    const bin = atob(res.data.split(',')[1]);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    const url = URL.createObjectURL(new Blob([bytes], { type: 'application/pdf' }));
    window.lastBelegUrl = url;
    if (win) win.location = url; else if (typeof window.open === 'function') window.open(url, '_blank');
  } else {
    window.openLightbox(res.data, (item.note || 'Beleg') + ' · ' + formatEuro(item.amount));
  }
};
window.removeBeleg = async function (id) {
  if (!window.can('finance.receipt') || !needToken()) return;
  const item = expenseStore.items().find((e) => e.id === id);
  if (!item || !item.beleg) return;
  const ok = await window.uiConfirm({ title: 'Beleg entfernen?', message: 'Der Beleg zu „' + (item.note || 'ohne Verwendungszweck') + '“ wird aus dem Sheet gelöscht.', okText: 'Entfernen' });
  if (!ok) return;
  const r = await postJson({ action: 'imageDelete', token: window.session.token, name: item.beleg });
  if (!r || r.status === 'error') { notify('Der Beleg konnte nicht gelöscht werden (Internet oder Anmeldung).'); return; }
  expenseStore.apply({ op: 'save', item: Object.assign({}, item, { beleg: '', bt: '' }) });
  window.renderStatistik(true);
};

// ---------- Abrechnung: CSV und Druck (PDF ueber den Druckdialog) ----------
function reportData() {
  const f = window.getFinance();
  const cfg = window.kasseCfg;
  const rows = [];
  KASSE_DAYS.forEach((d) => kasseProducts().forEach((p) => {
    const t = (window.kasseTotals[d] && window.kasseTotals[d][p.id]) || { paid: 0, free: 0 };
    const price = productPrice(p, cfg);
    rows.push({ day: d, name: p.name, price: price, paid: t.paid, free: t.free, revenue: round2(t.paid * price) });
  }));
  const expenses = expenseStore.items().slice().sort((a, b) => (a.ts || 0) - (b.ts || 0));
  const sturz = KASSE_DAYS.map((d) => Object.assign({ day: d }, sturzCalc(d))).filter((c) => c.done || c.anfang > 0);
  return { year: new Date().getFullYear(), f: f, cfg: cfg, rows: rows, expenses: expenses, sturz: sturz };
}
const deNum = (n) => (Math.round((Number(n) || 0) * 100) / 100).toFixed(2).replace('.', ',');
function csvCell(v) {
  const t = String(v === undefined || v === null ? '' : v);
  return /[;"\n\r]/.test(t) ? '"' + t.replace(/"/g, '""') + '"' : t;
}
function downloadFile(name, text, mime) {
  window.lastDownload = { name: name, text: text, mime: mime };
  const blob = new Blob([text], { type: mime });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
window.exportCsv = function () {
  if (!window.can('finance.export')) return;
  const d = reportData();
  const L = [];
  const add = function () { L.push(Array.prototype.slice.call(arguments).map(csvCell).join(';')); };
  add('Abrechnung Weihnachtsmarkt ' + d.year);
  add('Stand', fmtDateTime(Date.now()));
  add();
  add('Verkäufe');
  add('Tag', 'Produkt', 'Preis in €', 'bezahlt', 'Helfer (gratis)', 'Umsatz in €');
  d.rows.forEach((r) => add(dayName(r.day), r.name, deNum(r.price), r.paid, r.free, deNum(r.revenue)));
  add();
  add('Tagesergebnis');
  add('Tag', 'Verkäufe in €', 'Spendenente in €', 'Summe in €');
  KASSE_DAYS.forEach((day) => add(dayName(day), deNum(d.f.days[day].sales), deNum(d.f.days[day].spende), deNum(d.f.days[day].total)));
  add();
  add('Gesamtumsatz in €', deNum(d.f.revenue));
  add('Standgebühr in €', deNum(d.f.standgebuehr));
  add('Ausgaben gesamt in €', deNum(d.f.expenses));
  add('Gewinn in €', deNum(d.f.profit));
  add();
  add('Ausgaben');
  add('Datum', 'Verwendungszweck', 'Betrag in €', 'Beleg');
  d.expenses.forEach((e) => add(e.ts ? new Date(e.ts).toLocaleDateString('de-DE') : '', e.note || 'ohne Verwendungszweck', deNum(e.amount), e.beleg ? (e.bt === 'pdf' ? 'ja (PDF)' : 'ja (Foto)') : 'nein'));
  if (d.sturz.length) {
    add();
    add('Kassensturz');
    add('Tag', 'Anfangsbestand in €', 'Verkäufe in €', 'Spendenente in €', 'Entnahmen in €', 'Soll in €', 'Gezählt in €', 'Differenz in €');
    d.sturz.forEach((c) => add(dayName(c.day), deNum(c.anfang), deNum(c.sales), deNum(c.spende), deNum(c.ent), deNum(c.soll), c.done ? deNum(c.abend) : 'nicht gezählt', c.done ? deNum(c.diff) : ''));
  }
  downloadFile('abrechnung-weihnachtsmarkt-' + new Date().toISOString().slice(0, 10) + '.csv', '\ufeff' + L.join('\r\n'), 'text/csv;charset=utf-8');
  notify('CSV gespeichert (Semikolon getrennt, öffnet sich direkt in Excel und Numbers).');
};
window.exportPrint = async function () {
  if (!window.can('finance.export')) return;
  const v = await window.uiForm({
    title: 'Abrechnung drucken oder als PDF sichern',
    fields: [{ key: 'belege', label: 'Fotos der Belege hinten anhängen (braucht Internet)', type: 'checkbox', value: false }],
    okText: 'Weiter'
  });
  if (!v) return;
  const d = reportData();
  const e2 = (x) => escapeHtml(x);
  const table = (head, body) => `<table><thead><tr>${head.map((h) => `<th>${e2(h)}</th>`).join('')}</tr></thead><tbody>${body.map((r) => `<tr>${r.map((c) => `<td>${e2(c)}</td>`).join('')}</tr>`).join('')}</tbody></table>`;
  let html = `<div class="ps-head"><h1>Abrechnung Weihnachtsmarkt ${d.year}</h1></div><p>Stand: ${e2(fmtDateTime(Date.now()))}</p>`;
  html += '<h2>Verkäufe</h2>' + table(['Tag', 'Produkt', 'Preis', 'bezahlt', 'Helfer (gratis)', 'Umsatz'], d.rows.map((r) => [dayName(r.day), r.name, formatEuro(r.price), r.paid, r.free, formatEuro(r.revenue)]));
  html += '<h2>Ergebnis</h2>' + table(['Position', 'Betrag'], KASSE_DAYS.map((day) => [dayName(day) + ': Verkäufe + Spendenente (' + formatEuro(d.f.days[day].sales) + ' + ' + formatEuro(d.f.days[day].spende) + ')', formatEuro(d.f.days[day].total)]).concat([['Gesamtumsatz', formatEuro(d.f.revenue)], ['− Standgebühr', formatEuro(d.f.standgebuehr)], ['− Ausgaben', formatEuro(d.f.expenses)], ['Gewinn', formatEuro(d.f.profit)]]));
  html += '<h2>Ausgaben</h2>' + (d.expenses.length ? table(['Datum', 'Verwendungszweck', 'Betrag', 'Beleg'], d.expenses.map((e) => [e.ts ? new Date(e.ts).toLocaleDateString('de-DE') : '', e.note || 'ohne Verwendungszweck', formatEuro(e.amount), e.beleg ? (e.bt === 'pdf' ? 'PDF vorhanden' : 'Foto vorhanden') : 'kein Beleg'])) : '<p>Keine Ausgaben.</p>');
  if (d.sturz.length) html += '<h2>Kassensturz</h2>' + table(['Tag', 'Anfang', 'Verkäufe', 'Spendenente', 'Entnahmen', 'Soll', 'Gezählt', 'Differenz'], d.sturz.map((c) => [dayName(c.day), formatEuro(c.anfang), formatEuro(c.sales), formatEuro(c.spende), formatEuro(c.ent), formatEuro(c.soll), c.done ? formatEuro(c.abend) : 'nicht gezählt', c.done ? formatEuro(c.diff) : '']));
  let appendix = '';
  if (v.belege && needToken('Für die Belege bitte einmal abmelden und neu anmelden.')) {
    const withBeleg = d.expenses.filter((e) => e.beleg);
    if (withBeleg.length) notify('Belege werden geladen ...');
    for (const e of withBeleg.slice(0, 40)) {
      if (e.bt === 'pdf') { appendix += `<div class="ps-img"><h3>${e2(e.note || 'Beleg')} – ${formatEuro(e.amount)}</h3><p>Dieser Beleg ist ein PDF und steht nicht im Ausdruck.</p></div>`; continue; }
      const res = await getJson('image', { name: e.beleg, token: window.session.token });
      appendix += res && res.data ? `<div class="ps-img"><h3>${e2(e.note || 'Beleg')} – ${formatEuro(e.amount)}</h3><img src="${res.data}" alt=""></div>` : `<div class="ps-img"><h3>${e2(e.note || 'Beleg')}</h3><p>Der Beleg konnte nicht geladen werden.</p></div>`;
    }
    if (appendix) appendix = '<div class="ps-page"></div><h2>Belege</h2>' + appendix;
  }
  window.printHtml(html + appendix);
};

function renderAdmin() {
  const show = (id, on) => { const el = document.getElementById(id); if (el) el.classList.toggle('hidden', !on); };
  const canBenutzer = window.can('system.users');
  const canZugang = window.canAny(['system.roles', 'system.rechte', 'system.passwords']);
  if ((window.adminTab === 'benutzer' && !canBenutzer) || (window.adminTab === 'zugang' && !canZugang)) window.adminTab = 'verwaltung';
  show('adminTabBenutzer', canBenutzer);
  show('adminTabZugang', canZugang);
  show('adminPanelVerwaltung', window.adminTab === 'verwaltung');
  show('adminPanelBenutzer', window.adminTab === 'benutzer');
  show('adminPanelZugang', window.adminTab === 'zugang');
  const tabOn = 'px-5 py-2.5 rounded-xl text-sm font-black bg-amber-500 text-slate-950 shadow';
  const tabOff = 'px-5 py-2.5 rounded-xl text-sm font-bold bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 border border-slate-300 dark:border-slate-700';
  [['adminTabVerwaltung', 'verwaltung'], ['adminTabBenutzer', 'benutzer'], ['adminTabZugang', 'zugang']].forEach((t) => {
    const el = document.getElementById(t[0]);
    if (el) el.className = window.adminTab === t[1] ? tabOn : tabOff;
  });
  show('adminCardKasse', window.canAny(['finance.prices', 'finance.productAdd', 'finance.productEdit', 'finance.productDelete', 'kasse.reset']));
  show('adminCardAushang', window.can('aushang.upload'));
  show('adminCardDaten', window.canAny(['system.backup', 'system.reset']));
  show('adminAddProductBtn', window.can('finance.productAdd'));
  show('adminResetSamstagBtn', window.can('kasse.reset'));
  show('adminResetSonntagBtn', window.can('kasse.reset'));
  show('adminBackupBtn', window.can('system.backup'));
  show('adminSeasonResetBtn', window.can('system.reset'));
  show('adminAddRoleBtn', window.can('system.roles'));
  show('adminAddUserBtn', window.can('system.users'));
  show('adminAddExtraBtn', window.can('system.rechte'));
  show('adminBackupNowBtn', window.can('system.backup'));
  show('adminBackupsBox', window.canAny(['system.backup', 'system.restore']));

  const ae = document.activeElement;
  const list = document.getElementById('adminProductList');
  if (list && !(ae && ae.closest && ae.closest('#adminProductList'))) list.innerHTML = adminProductsHtml();
  const roles = document.getElementById('adminRolesList');
  if (roles) roles.innerHTML = adminRolesHtml();
  const users = document.getElementById('adminUsersList');
  if (users) users.innerHTML = adminUsersHtml();
  const extrasEl = document.getElementById('adminExtrasList');
  if (extrasEl) extrasEl.innerHTML = adminExtrasHtml();
  const matrixEl = document.getElementById('adminMatrix');
  if (matrixEl && window.adminTab === 'zugang') matrixEl.innerHTML = adminMatrixHtml();
  renderBackups();
  const hint = document.getElementById('adminRolesHint');
  if (hint) hint.classList.toggle('hidden', window.adminTab === 'verwaltung' || !!(window.session && window.session.token));
}
function roleIcon(id) {
  return { gast: '👁️', helfer: '🧑‍🍳', orga: '📋', admin: '🛡️' }[id] || '👤';
}
// Aenderungen an Rollen und Benutzern gehen ueber das Script (mit Anmeldung)
async function accessCall(ops) {
  if (!window.session || !window.session.token) {
    notify('Bitte einmal abmelden und neu anmelden, dann kann ich Änderungen an Rollen speichern.');
    return null;
  }
  const r = await postJson({ action: 'accessOps', token: window.session.token, ops: ops });
  if (!r) {
    notify('Keine Verbindung. Änderungen an Rollen brauchen Internet.');
    return null;
  }
  if (r.code === 'auth') {
    notify('Die Anmeldung ist abgelaufen. Bitte neu anmelden.');
    return null;
  }
  if (validRoles(r.roles)) {
    window.rolesData = sortRoles(r.roles);
    lsSet('rolesData4', window.rolesData);
  }
  if (Array.isArray(r.users)) window.usersData = r.users;
  if (Array.isArray(r.extras)) window.extrasData = r.extras;
  if (r.errors && r.errors.length) notify(r.errors.join(' '));
  if (!window.roleById(window.currentUserRole)) window.setRole('gast');
  window.applyPermissionUi();
  window.rerenderAll();
  return r;
}
window.openRoleDialog = async function (id, copyFrom) {
  const role = id ? window.roleById(id) : null;
  if (role ? !window.canAny(['system.roles', 'system.rechte', 'system.passwords']) : !window.can('system.roles')) return;
  const src = role || (copyFrom ? window.roleById(copyFrom) : null);
  const isAdmin = !!role && role.id === 'admin';
  const canNames = !role || window.can('system.roles');
  const fields = [
    { key: 'name', label: 'Name', type: 'text', value: role ? role.name : (src ? 'Kopie von ' + src.name : ''), required: true, maxlength: 40 },
    { key: 'desc', label: 'Beschreibung', type: 'text', value: src ? src.desc : '', maxlength: 120 }
  ];
  if (!role || role.id !== 'gast') {
    fields.push({
      key: 'password', label: role ? 'Neues Passwort (leer lassen = unverändert)' : 'Passwort', type: 'text', value: '',
      hint: role ? 'Mindestens 4 Zeichen.' : 'Mindestens 4 Zeichen. Ohne Passwort ist keine Anmeldung mit dieser Rolle möglich.',
      validate: (x) => (String(x).trim() === '' || String(x).trim().length >= 4 ? '' : 'Mindestens 4 Zeichen.')
    });
  }
  const permsLocked = !window.can('system.rechte');
  fields.push({
    key: 'perms', label: 'Rechte', type: 'permissions', groups: PERMISSION_GROUPS, grid: true, value: src ? src.perms : [],
    locked: permsLocked, forced: isAdmin ? ADMIN_CORE_PERMS : [], forcedText: 'Die Rechte, die zur Verwaltung von Rollen, Benutzern und Passwörtern gehören, bleiben beim Administrator immer an, damit sich niemand aussperren kann.', lockedText: 'Du darfst Rechte ansehen, aber nicht ändern.'
  });
  const extra = [];
  if (role && !role.builtin && window.can('system.roles')) extra.push({ text: '🗑️ Rolle löschen', value: 'delete', danger: true });
  if (role && role.id !== 'gast' && window.can('system.roles')) extra.push({ text: '🚪 Überall abmelden', value: 'logoutAll' });
  if (role && role.id !== 'gast' && role.id !== 'admin' && role.hasPw && window.can('system.passwords')) extra.push({ text: '🔓 Rollen-Anmeldung abschalten', value: 'clearPw' });
  const v = await window.uiForm({ title: role ? 'Rolle bearbeiten: ' + role.name : (src ? 'Rolle kopieren: ' + src.name : 'Neue Rolle'), fields: fields, okText: 'Speichern', extraButtons: extra, full: true });
  if (!v) return;
  if (v.__action === 'delete') {
    const users = window.usersData.filter((u) => (u.roles || []).indexOf(role.id) >= 0).length;
    const ok = await window.uiConfirm({ title: 'Rolle löschen?', message: '„' + role.name + '“ wird gelöscht.' + (users ? ' ' + users + ' Benutzer verlieren diese Rolle.' : '') + ' Wer mit dieser Rolle angemeldet ist, wird zum Gast.', okText: 'Löschen' });
    if (ok) await accessCall([{ op: 'delRole', id: role.id }]);
    return;
  }
  if (v.__action === 'logoutAll') {
    const ok = await window.uiConfirm({ title: 'Überall abmelden?', message: 'Alle, die sich mit dem Passwort der Rolle „' + role.name + '“ angemeldet haben, werden abgemeldet. Benutzer mit eigenem Namen bleiben angemeldet.', okText: 'Abmelden' });
    if (ok) await accessCall([{ op: 'logoutRole', id: role.id }]);
    return;
  }
  if (v.__action === 'clearPw') {
    const ok = await window.uiConfirm({ title: 'Rollen-Anmeldung abschalten?', message: 'Mit „' + role.name + '“ kann sich danach niemand mehr mit einem Rollen-Passwort anmelden, bis du wieder ein Passwort setzt. Benutzer mit dieser Rolle sind nicht betroffen.', okText: 'Abschalten' });
    if (ok) await accessCall([{ op: 'saveRole', role: { id: role.id, name: role.name, desc: role.desc, perms: role.perms }, clearPassword: true }]);
    return;
  }
  const pw = String(v.password || '').trim();
  const op = { op: 'saveRole', role: { id: role ? role.id : undefined, name: canNames ? v.name.trim() : role.name, desc: canNames ? v.desc.trim() : role.desc, perms: permsLocked ? (role ? role.perms : []) : v.perms } };
  if (pw) op.password = pw;
  await accessCall([op]);
};
window.openUserDialog = async function (id) {
  if (!window.can('system.users')) return;
  const u = id ? window.usersData.find((x) => x.id === id) : null;
  if (id && !u) return;
  const roleOpts = window.rolesData.map((r) => ({ value: r.id, label: r.name, hint: r.desc || '' }));
  const extraOpts = (window.extrasData || []).map((x) => ({ value: x.id, label: x.name, hint: x.desc || '' }));
  const fields = [
    { key: 'name', label: 'Benutzername', type: 'text', value: u ? u.name : '', required: true, maxlength: 40 },
    { key: 'roles', label: 'Rollen (eine oder mehrere)', type: 'checklist', options: roleOpts, value: u ? u.roles : (window.roleById('helfer') ? ['helfer'] : []), validate: (v) => (v.length ? '' : 'Bitte mindestens eine Rolle wählen.') },
    { key: 'extras', label: 'Sonderrechte (zusätzlich zu den Rollen)', type: 'checklist', options: extraOpts, value: u ? u.extras : [], empty: 'Noch keine Sonderrechte angelegt. Du legst sie in der Zugangsverwaltung an.' }
  ];
  if (!u || window.can('system.passwords')) {
    fields.push({
      key: 'password', label: u ? 'Neues Passwort (leer lassen = unverändert)' : 'Passwort', type: 'text', value: '', hint: 'Mindestens 4 Zeichen.',
      validate: (x) => { const t = String(x).trim(); return (!u && t.length < 4) || (t !== '' && t.length < 4) ? 'Mindestens 4 Zeichen.' : ''; }
    });
  }
  if (u) fields.push({ key: 'disabled', label: 'Konto sperren (Anmeldung nicht mehr möglich, der Benutzer bleibt erhalten)', type: 'checkbox', value: !!u.disabled });
  const extra = u ? [{ text: '🗑️ Benutzer löschen', value: 'delete', danger: true }, { text: '🚪 Überall abmelden', value: 'logoutAll' }] : [];
  const v = await window.uiForm({ title: u ? 'Benutzer bearbeiten' : 'Neuer Benutzer', fields: fields, okText: 'Speichern', extraButtons: extra });
  if (!v) return;
  if (v.__action === 'delete') {
    const ok = await window.uiConfirm({ title: 'Benutzer löschen?', message: '„' + u.name + '“ wird gelöscht und überall abgemeldet.', okText: 'Löschen' });
    if (ok) await accessCall([{ op: 'delUser', id: u.id }]);
    return;
  }
  if (v.__action === 'logoutAll') {
    const ok = await window.uiConfirm({ title: 'Überall abmelden?', message: '„' + u.name + '“ wird auf allen Geräten abgemeldet und muss sich neu anmelden.', okText: 'Abmelden' });
    if (ok) await accessCall([{ op: 'logoutUser', id: u.id }]);
    return;
  }
  const op = { op: 'saveUser', user: { id: u ? u.id : undefined, name: v.name.trim(), roles: v.roles, extras: v.extras } };
  if (u) op.user.disabled = !!v.disabled;
  const pw = String(v.password || '').trim();
  if (pw) op.password = pw;
  await accessCall([op]);
};
window.openExtraDialog = async function (id) {
  if (!window.can('system.rechte')) return;
  const x = id ? window.extrasData.find((e) => e.id === id) : null;
  if (id && !x) return;
  const fields = [
    { key: 'name', label: 'Name des Sonderrechts', type: 'text', value: x ? x.name : '', required: true, maxlength: 40, placeholder: 'z. B. Statistik bearbeiten' },
    { key: 'desc', label: 'Beschreibung', type: 'text', value: x ? x.desc : '', maxlength: 120 },
    { key: 'perms', label: 'Rechte, die dieses Sonderrecht zusätzlich gibt', type: 'permissions', groups: PERMISSION_GROUPS, grid: true, value: x ? x.perms : [] }
  ];
  const extra = x ? [{ text: '🗑️ Sonderrecht löschen', value: 'delete', danger: true }] : [];
  const v = await window.uiForm({ title: x ? 'Sonderrecht bearbeiten: ' + x.name : 'Neues Sonderrecht', fields: fields, okText: 'Speichern', extraButtons: extra, full: true });
  if (!v) return;
  if (v.__action === 'delete') {
    const n = window.usersData.filter((u) => (u.extras || []).indexOf(x.id) >= 0).length;
    const ok = await window.uiConfirm({ title: 'Sonderrecht löschen?', message: '„' + x.name + '“ wird gelöscht.' + (n ? ' ' + n + ' Benutzer verlieren dieses Recht.' : ''), okText: 'Löschen' });
    if (ok) await accessCall([{ op: 'delExtra', id: x.id }]);
    return;
  }
  await accessCall([{ op: 'saveExtra', extra: { id: x ? x.id : undefined, name: v.name.trim(), desc: v.desc.trim(), perms: v.perms } }]);
};
function doBackup() {
  const payload = {
    exportedAt: new Date().toISOString(),
    inventar: window.inventarData,
    kasse: { einstellungen: window.kasseCfg, summen: window.kasseTotals, finanzen: window.getFinance() },
    ausgaben: expenseStore.items(),
    boxen: boxStore.items(),
    produkte: produkteStore.items(),
    rezepte: rezepteStore.items(),
    kassensturz: kassensturzStore.items(),
    aufbau: aufbauStore.items(),
    aushang: aushangStore.items(),
    strom: stromStore.items(),
    rollen: window.rolesData.map((r) => ({ id: r.id, name: r.name, desc: r.desc, perms: r.perms }))
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'weihnachtsmarkt-backup-' + new Date().toISOString().slice(0, 10) + '.json';
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
window.downloadBackup = function () {
  if (!window.can('system.backup')) return;
  doBackup();
};
window.resetSeasonPrompt = async function () {
  if (!window.can('system.reset')) return;
  const v = await window.uiForm({
    title: 'Saison-Reset',
    message: 'Setzt Inventar, Kasse, Spendenente, Standgebühr und Ausgaben zurück. Vorher wird automatisch ein Backup heruntergeladen. Das kann nicht rückgängig gemacht werden.',
    fields: [{ key: 'word', label: 'Zur Bestätigung RESET eintippen', type: 'text', validate: (x) => (String(x).trim() === 'RESET' ? '' : 'Bitte RESET eintippen.') }],
    okText: 'Zurücksetzen',
    danger: true
  });
  if (!v) return;
  doBackup();
  invCommit([{ op: 'replaceAll', data: clone(window.inventarCategories || []) }]);
  if (!(await resetKasseOnServer(KASSE_DAYS.slice()))) notify(window.resetClosed ? 'Ein Tag ist abgeschlossen, deshalb blieben die Kassen-Zähler stehen. Bitte in der Kasse wieder öffnen und Samstag und Sonntag im Admin-Panel einzeln zurücksetzen.' : 'Die Kassen-Zähler konnten ohne Verbindung nicht zurückgesetzt werden. Bitte im Admin-Panel Samstag und Sonntag einzeln zurücksetzen, sobald du online bist.');
  ['samstag', 'sonntag'].forEach((d) => kassensturzStore.apply({ op: 'del', id: d }));
  applyKassePatch({ spende: { samstag: 0, sonntag: 0 }, standgebuehr: 0 });
  expenseStore.items().forEach((e) => expenseStore.apply({ op: 'del', id: e.id }));
  window.renderStatistik(true);
  renderAdmin();
};

// ------------------------------------------
// 7. AUSHANG (Listen zum Eintragen), AUFBAU, BILDER
// Lokal zuerst, alles wird zusaetzlich im Google Sheet abgelegt und auf allen Geraeten angezeigt.
// ------------------------------------------
const AUSHANG_TAGE = { samstag: 'Samstag', sonntag: 'Sonntag' };
window.signupName = localStorage.getItem('signupName') || '';

// --- Drucken: DIN-A4-Blatt (nur der Inhalt, ohne Menues) ---
window.printHtml = function (html) {
  let sheet = document.getElementById('printSheet');
  if (!sheet) {
    sheet = mk('div', { id: 'printSheet' });
    document.body.appendChild(sheet);
  }
  sheet.innerHTML = html;
  setTimeout(() => window.print(), 80);
};
function siteLogoSrc() {
  const img = document.querySelector ? document.querySelector('.navbar-brand img') : null;
  return img && img.src ? img.src : '';
}

// --- Bilder (Scans und Aufbau-Fotos) ---
// Schluessel: samstag, sonntag oder aufbau_<id>. Cache im Speicher + lokal, Ablage im Sheet in Stuecken.
window.roshopImages = {};
function imageStorageKey(key) {
  return key === 'samstag' || key === 'sonntag' ? 'aushangImage_' + key : 'img_' + key;
}
Object.keys(AUSHANG_TAGE).forEach((day) => {
  localStorage.removeItem('roshopImage_' + day); // Altlast: nur lokal gespeicherte Bilder der ersten Version
});
function getImageRec(key) {
  if (!(key in window.roshopImages)) window.roshopImages[key] = lsGet(imageStorageKey(key), null);
  return window.roshopImages[key];
}
function saveImageLocal(key, rec) {
  window.roshopImages[key] = rec;
  try {
    if (rec) localStorage.setItem(imageStorageKey(key), JSON.stringify(rec));
    else localStorage.removeItem(imageStorageKey(key));
  } catch (e) {
    console.warn('Bild zu groß für den lokalen Speicher - wird nur im Arbeitsspeicher gehalten:', e);
  }
}
async function uploadImageRecord(key, rec) {
  const r = await postToSheets({ action: 'image', name: key, data: rec.data, sig: rec.sig });
  if (!r.ok) return false;
  const meta = await getFromSheets('imagemeta', { names: key });
  const ok = !!(meta && meta[key] && meta[key].sig === rec.sig);
  if (ok) {
    rec.synced = true;
    saveImageLocal(key, rec);
  }
  return ok;
}
let imagesSyncing = false;
window.syncImages = async function (keys) {
  if (imagesSyncing) return false;
  imagesSyncing = true;
  try {
    const meta = await getFromSheets('imagemeta', { names: keys.join(',') });
    if (!meta) return false;
    for (const key of keys) {
      if (!Object.prototype.hasOwnProperty.call(meta, key)) continue;
      const local = getImageRec(key);
      const remote = meta[key];
      if (local && local.synced === false) {
        await uploadImageRecord(key, local);
        continue;
      }
      if (!remote || !remote.chunks) {
        if (local && key.indexOf('aufbau_') !== 0) saveImageLocal(key, null);
        continue;
      }
      if (local && local.sig === remote.sig) continue;
      const res = await getFromSheets('image', { name: key });
      if (res && res.data) saveImageLocal(key, { sig: res.sig || remote.sig, data: res.data, synced: true });
    }
    return true;
  } finally {
    imagesSyncing = false;
  }
};
function compressImage(img, maxSide) {
  let scale = Math.min(1, maxSide / Math.max(img.width, img.height));
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
// Datei -> verkleinertes JPEG (Data-URL)
function fileToCompressed(file, maxSide) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Die Datei konnte nicht gelesen werden.'));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('Das ist kein lesbares Bild.'));
      img.onload = () => resolve(compressImage(img, maxSide));
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}

// Zusatz-Aushang (Foto/Scan) pro Tag: nur sichtbar, wenn hochgeladen
window.renderAushangImages = function () {
  Object.keys(AUSHANG_TAGE).forEach((day) => {
    const cap = capDay(day);
    const img = document.getElementById('aushangImg' + cap);
    const wrap = document.getElementById('aushangScan' + cap);
    const rec = getImageRec(day);
    const has = !!(rec && rec.data);
    if (img) {
      if (has && img.dataset.sig !== rec.sig) {
        img.src = rec.data;
        img.dataset.sig = rec.sig;
      }
      img.classList.toggle('hidden', !has);
    }
    if (wrap) wrap.classList.toggle('hidden', !has);
  });
};
window.pullAushang = async function () {
  aushangStore.sync();
  const ok = await window.syncImages(Object.keys(AUSHANG_TAGE));
  if (ok) window.renderAushangImages();
};
window.uploadRoshopImage = async function (day, input) {
  const file = input.files && input.files[0];
  if (!window.can('aushang.upload')) {
    notify('Dafür fehlt dir die Berechtigung.');
    return;
  }
  if (!file || !AUSHANG_TAGE[day]) return;
  const status = document.getElementById('uploadStatus' + capDay(day));
  const say = (t) => { if (status) status.innerText = t; };
  say('Bild wird verarbeitet...');
  let dataUrl;
  try {
    dataUrl = await fileToCompressed(file, 1600);
  } catch (e) {
    say(e.message);
    return;
  }
  const rec = { sig: hashString(dataUrl), data: dataUrl, synced: false };
  saveImageLocal(day, rec);
  window.renderAushangImages();
  say('Wird hochgeladen...');
  const ok = await uploadImageRecord(day, rec);
  say(ok
    ? '✓ Hochgeladen - jetzt für alle Geräte sichtbar.'
    : '⚠ Nur auf diesem Gerät gespeichert. Der Upload wird automatisch erneut versucht.');
  input.value = '';
};

// --- Aushang: Listen zum Eintragen ---
function aushangDay(day) {
  const all = aushangStore.items();
  const meta = all.find((x) => x.kind === 'meta' && x.day === day) || { id: 'meta_' + day, kind: 'meta', day: day, dateText: AUSHANG_TAGE[day], auxLabel: 'Aufsicht (Ü18)' };
  return {
    meta: meta,
    slots: all.filter((x) => x.kind === 'slot' && x.day === day),
    teige: all.filter((x) => x.kind === 'teig' && x.day === day).sort((a, b) => a.n - b.n)
  };
}
function renderAushangLists() {
  const canEdit = window.can('aushang.editRows');
  const canUnsign = window.can('aushang.unsignOthers');
  const canTitle = window.can('aushang.editTitle');
  const canTeigEdit = window.can('aushang.editTeig');
  const canSign = window.can('aushang.signup');
  const canPrint = window.can('aushang.print');
  const btn = 'px-2 py-1 rounded-lg text-[11px] font-bold border transition';
  Object.keys(AUSHANG_TAGE).forEach((day) => {
    const box = document.getElementById('aushangList' + capDay(day));
    if (!box) return;
    const d = aushangDay(day);
    const title = d.meta.dateText || AUSHANG_TAGE[day];
    setText('aushangTitle' + capDay(day), title);
    const aux = !d.meta.auxLabel || d.meta.auxLabel === 'Aufsicht' ? 'Aufsicht (Ü18)' : d.meta.auxLabel;
    const chipsHtml = (s, field) => (s[field] || []).map((e, ni) => {
      const mine = e.d === DEVICE_ID;
      const removable = mine || canUnsign;
      return `<span class="inline-flex items-center gap-1 pl-2.5 ${removable ? 'pr-1' : 'pr-2.5'} py-0.5 rounded-full text-xs font-semibold ${mine ? 'bg-emerald-500/15 border-emerald-500/50 text-emerald-800 dark:text-emerald-200' : 'bg-slate-100 dark:bg-slate-800 border-slate-300 dark:border-slate-700 text-slate-800 dark:text-slate-100'} border">${escapeHtml(e.n)}${removable ? `<button type="button" onclick="window.removeSignup('${escapeHtml(s.id)}', ${ni}, '${field}')" title="Austragen" class="w-5 h-5 rounded-full text-slate-500 hover:bg-rose-500/20 hover:text-rose-500">✕</button>` : ''}</span>`;
    }).join('');
    const cellHtml = (s, field) => `<div class="flex flex-wrap items-center gap-1.5">${chipsHtml(s, field)}${canSign ? `<button type="button" onclick="window.addSignup('${escapeHtml(s.id)}', '${field}')" class="${btn} bg-amber-500/10 border-amber-500/40 text-amber-700 dark:text-amber-300 hover:bg-amber-500/20">＋ Eintragen</button>` : ''}</div>`;
    const slotRows = d.slots.map((s, i) => `<tr class="align-top">
        <td class="py-2.5 px-3 text-xs font-bold text-slate-700 dark:text-slate-200" style="text-align:left">${escapeHtml(s.label)}</td>
        <td class="py-2.5 px-3" style="text-align:left">${cellHtml(s, 'names')}</td>
        <td class="py-2.5 px-3" style="text-align:left">${cellHtml(s, 'aufsicht')}${s.extra ? `<div class="text-[11px] text-slate-500 dark:text-slate-400 mt-1">${escapeHtml(s.extra)}</div>` : ''}</td>
        ${canEdit ? `<td class="py-2.5 px-2" style="text-align:right"><div class="flex flex-wrap justify-end gap-1"><button type="button" onclick="window.moveAushangSlot('${escapeHtml(s.id)}', -1)" ${i === 0 ? 'disabled' : ''} class="${btn} bg-slate-100 dark:bg-slate-800 border-slate-300 dark:border-slate-700 disabled:opacity-30">⬆️</button> <button type="button" onclick="window.moveAushangSlot('${escapeHtml(s.id)}', 1)" ${i === d.slots.length - 1 ? 'disabled' : ''} class="${btn} bg-slate-100 dark:bg-slate-800 border-slate-300 dark:border-slate-700 disabled:opacity-30">⬇️</button> <button type="button" onclick="window.editAushangSlot('${escapeHtml(s.id)}')" class="${btn} bg-slate-100 dark:bg-slate-800 border-slate-300 dark:border-slate-700">✏️</button> <button type="button" onclick="window.deleteAushangSlot('${escapeHtml(s.id)}')" class="${btn} bg-rose-500/10 border-rose-500/30 text-rose-500">🗑️</button></div></td>` : ''}
      </tr>`).join('');
    const teigCells = d.teige.map((t) => {
      const mine = t.d === DEVICE_ID;
      const free = !t.name;
      return `<div class="flex items-center justify-between gap-2 px-3 py-2 rounded-xl border ${free ? 'border-dashed border-slate-300 dark:border-slate-700' : (mine ? 'border-emerald-500/50 bg-emerald-500/10' : 'border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60')}">
        <span class="text-xs font-semibold text-slate-800 dark:text-slate-100"><span class="text-slate-400 dark:text-slate-500 mr-1">${t.n}.</span>${free ? '<span class="text-slate-400 dark:text-slate-500">frei</span>' : escapeHtml(t.name)}</span>
        ${free
          ? (canSign ? `<button type="button" onclick="window.claimTeig('${escapeHtml(t.id)}')" class="${btn} bg-amber-500/10 border-amber-500/40 text-amber-700 dark:text-amber-300 hover:bg-amber-500/20">Eintragen</button>` : '')
          : (mine || canUnsign ? `<button type="button" onclick="window.releaseTeig('${escapeHtml(t.id)}')" title="Austragen" class="w-6 h-6 rounded-full text-slate-500 hover:bg-rose-500/20 hover:text-rose-500">✕</button>` : '')}
      </div>`;
    }).join('');
    box.innerHTML = `
      <div class="space-y-2">
        <div class="flex items-center justify-between gap-2">
          <h4 class="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">🤝 Unterstützung vor Ort</h4>
          ${canTitle ? `<button type="button" onclick="window.editAushangMeta('${day}')" class="${btn} bg-slate-100 dark:bg-slate-800 border-slate-300 dark:border-slate-700">✏️ Titel</button>` : ''}
        </div>
        <div class="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-700">
          <table class="w-full text-xs table-fixed">
            <colgroup><col style="width:22%"><col style="width:${canEdit ? 28 : 42}%"><col style="width:${canEdit ? 26 : 36}%">${canEdit ? '<col style="width:24%">' : ''}</colgroup>
            <thead class="bg-slate-100 dark:bg-slate-800"><tr>
              <th class="py-2 px-3 text-[11px] font-black uppercase tracking-wider text-slate-600 dark:text-slate-300" style="text-align:left">Zeit</th>
              <th class="py-2 px-3 text-[11px] font-black uppercase tracking-wider text-slate-600 dark:text-slate-300" style="text-align:left">Name</th>
              <th class="py-2 px-3 text-[11px] font-black uppercase tracking-wider text-slate-600 dark:text-slate-300" style="text-align:left">${escapeHtml(aux)}</th>
              ${canEdit ? '<th></th>' : ''}
            </tr></thead>
            <tbody class="divide-y divide-slate-200 dark:divide-slate-700/60">${slotRows || '<tr><td colspan="4" class="p-4 text-slate-500 dark:text-slate-400">Noch keine Zeilen.</td></tr>'}</tbody>
          </table>
        </div>
        ${canEdit ? `<button type="button" onclick="window.addAushangSlot('${day}')" class="${btn} bg-amber-500/10 border-amber-500/40 text-amber-700 dark:text-amber-300">➕ Zeile hinzufügen</button>` : ''}
      </div>
      <div class="space-y-2 pt-2">
        <div class="flex items-center justify-between gap-2">
          <h4 class="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">🧇 Waffelteig</h4>
          ${canTeigEdit ? `<span class="flex gap-1"><button type="button" onclick="window.addTeigPlatz('${day}', -1)" class="${btn} bg-slate-100 dark:bg-slate-800 border-slate-300 dark:border-slate-700">− Platz</button><button type="button" onclick="window.addTeigPlatz('${day}', 1)" class="${btn} bg-slate-100 dark:bg-slate-800 border-slate-300 dark:border-slate-700">＋ Platz</button></span>` : ''}
        </div>
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-2">${teigCells || '<div class="text-xs text-slate-500 dark:text-slate-400">Noch keine Plätze.</div>'}</div>
      </div>
      ${canPrint ? `<div class="pt-2"><button type="button" onclick="window.printAushang('${day}')" class="${btn} bg-slate-100 dark:bg-slate-800 border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200">🖨️ Als DIN-A4-Blatt drucken</button></div>` : ''}`;
  });
}
window.renderAushangLists = renderAushangLists;

async function askName(title, message) {
  const v = await window.uiForm({
    title: title,
    message: message || '',
    fields: [{ key: 'name', label: 'Dein Name', type: 'text', value: window.signupName, required: true, maxlength: 40 }],
    okText: 'Eintragen'
  });
  if (!v) return null;
  const name = v.name.trim();
  window.signupName = name;
  localStorage.setItem('signupName', name);
  return name;
}
window.addSignup = async function (slotId, field) {
  if (!window.can('aushang.signup')) return;
  const f = field === 'aufsicht' ? 'aufsicht' : 'names';
  const name = await askName(f === 'aufsicht' ? 'Als Aufsicht eintragen' : 'In die Liste eintragen', f === 'aufsicht' ? 'Aufsicht ist für Erwachsene (ab 18 Jahren).' : '');
  if (!name) return;
  aushangStore.apply({ op: 'addName', id: slotId, f: f, entry: { n: name, d: DEVICE_ID } });
  renderAushangLists();
};
window.removeSignup = async function (slotId, index, field) {
  const f = field === 'aufsicht' ? 'aufsicht' : 'names';
  const slot = aushangStore.items().find((x) => x.id === slotId);
  const e = slot && (slot[f] || [])[index];
  if (!e || !(e.d === DEVICE_ID || window.can('aushang.unsignOthers'))) return;
  const ok = await window.uiConfirm({ title: 'Austragen?', message: '„' + e.n + '“ aus „' + slot.label + '“ austragen.', okText: 'Austragen' });
  if (!ok) return;
  aushangStore.apply({ op: 'delName', id: slotId, f: f, entry: { n: e.n, d: e.d } });
  renderAushangLists();
};
window.claimTeig = async function (id) {
  if (!window.can('aushang.signup')) return;
  const name = await askName('Waffelteig übernehmen');
  if (!name) return;
  const t = aushangStore.items().find((x) => x.id === id);
  if (!t || t.name) {
    notify('Dieser Platz ist schon vergeben.');
    renderAushangLists();
    return;
  }
  aushangStore.apply({ op: 'claim', id: id, name: name, d: DEVICE_ID });
  renderAushangLists();
};
window.releaseTeig = async function (id) {
  const t = aushangStore.items().find((x) => x.id === id);
  if (!t || !t.name || !(t.d === DEVICE_ID || window.can('aushang.unsignOthers'))) return;
  const ok = await window.uiConfirm({ title: 'Austragen?', message: 'Platz ' + t.n + ' („' + t.name + '“) wieder freigeben.', okText: 'Freigeben' });
  if (!ok) return;
  aushangStore.apply({ op: 'clear', id: id });
  renderAushangLists();
};
window.addAushangSlot = async function (day) {
  if (!window.can('aushang.editRows')) return;
  const v = await window.uiForm({
    title: 'Neue Zeile',
    fields: [
      { key: 'label', label: 'Zeit / Bezeichnung', type: 'text', placeholder: 'z. B. 19 - 20 Uhr', required: true, maxlength: 40 }
    ],
    okText: 'Hinzufügen'
  });
  if (!v) return;
  aushangStore.apply({ op: 'save', item: { id: newId('s'), kind: 'slot', day: day, label: v.label.trim(), names: [], aufsicht: [], extra: '' } });
  renderAushangLists();
};
window.editAushangSlot = async function (id) {
  if (!window.can('aushang.editRows')) return;
  const s = aushangStore.items().find((x) => x.id === id);
  if (!s) return;
  const v = await window.uiForm({
    title: 'Zeile bearbeiten',
    fields: [
      { key: 'label', label: 'Zeit / Bezeichnung', type: 'text', value: s.label, required: true, maxlength: 40 }
    ],
    okText: 'Speichern'
  });
  if (!v) return;
  aushangStore.apply({ op: 'save', item: Object.assign({}, s, { label: v.label.trim() }) });
  renderAushangLists();
};
window.deleteAushangSlot = async function (id) {
  if (!window.can('aushang.editRows')) return;
  const s = aushangStore.items().find((x) => x.id === id);
  if (!s) return;
  const ok = await window.uiConfirm({ title: 'Zeile löschen?', message: '„' + s.label + '“ mit ' + (s.names || []).length + ' Eintrag/Einträgen wird gelöscht.', okText: 'Löschen' });
  if (!ok) return;
  aushangStore.apply({ op: 'del', id: id });
  renderAushangLists();
};
window.moveAushangSlot = function (id, dir) {
  if (!window.can('aushang.editRows')) return;
  const all = aushangStore.items();
  const s = all.find((x) => x.id === id);
  if (!s) return;
  const sameDay = all.filter((x) => x.kind === 'slot' && x.day === s.day);
  const at = sameDay.findIndex((x) => x.id === id);
  const neighbor = sameDay[at + dir];
  if (!neighbor) return;
  aushangStore.apply({ op: 'move', id: id, to: all.findIndex((x) => x.id === neighbor.id) });
  renderAushangLists();
};
window.editAushangMeta = async function (day) {
  if (!window.can('aushang.editTitle')) return;
  const m = aushangDay(day).meta;
  const v = await window.uiForm({
    title: AUSHANG_TAGE[day] + ': Titel',
    fields: [
      { key: 'dateText', label: 'Überschrift mit Datum', type: 'text', value: m.dateText, placeholder: 'z. B. Samstag, 28. Nov 2026', maxlength: 40 },
      { key: 'auxLabel', label: 'Titel der dritten Spalte', type: 'text', value: (!m.auxLabel || m.auxLabel === 'Aufsicht') ? 'Aufsicht (Ü18)' : m.auxLabel, maxlength: 30 }
    ],
    okText: 'Speichern'
  });
  if (!v) return;
  aushangStore.apply({ op: 'save', item: { id: 'meta_' + day, kind: 'meta', day: day, dateText: v.dateText.trim() || AUSHANG_TAGE[day], auxLabel: v.auxLabel.trim() || 'Aufsicht (Ü18)' } });
  renderAushangLists();
};
window.addTeigPlatz = function (day, dir) {
  if (!window.can('aushang.editTeig')) return;
  const d = aushangDay(day);
  if (dir > 0) {
    const next = d.teige.reduce((m, t) => Math.max(m, t.n), 0) + 1;
    if (next > 40) return;
    aushangStore.apply({ op: 'save', item: { id: newId('t'), kind: 'teig', day: day, n: next, name: '', d: '' } });
  } else {
    const last = d.teige[d.teige.length - 1];
    if (!last) return;
    if (last.name) {
      notify('Der letzte Platz ist belegt. Erst austragen, dann entfernen.');
      return;
    }
    aushangStore.apply({ op: 'del', id: last.id });
  }
  renderAushangLists();
};

// --- Aushang drucken (wie die Vorlage der letzten Jahre) ---
function aushangPrintPage(day) {
  const d = aushangDay(day);
  const logo = siteLogoSrc();
  const aux = !d.meta.auxLabel || d.meta.auxLabel === 'Aufsicht' ? 'Aufsicht (Ü18)' : d.meta.auxLabel;
  // Zeilenhoehe so waehlen, dass alles auf EINE A4-Seite passt (Platz fuer Zeilen: rund 185 mm)
  const nSlots = d.slots.length;
  const nTeigRows = Math.ceil(d.teige.length / 2);
  const avail = 185;
  let sh = 17;
  let th = 9;
  let fs = 11;
  const need = nSlots * sh + nTeigRows * th;
  if (need > avail) {
    const f = avail / need;
    sh = Math.max(7, Math.round(sh * f * 10) / 10);
    th = Math.max(7, Math.round(th * f * 10) / 10);
  }
  if (nSlots * sh + nTeigRows * th > avail) { fs = 9; sh = Math.max(6, sh - 1); th = Math.max(6, th - 1); }
  const rows = d.slots.map((s) => `<tr style="height:${sh}mm"><td class="c1">${escapeHtml(s.label)}</td><td>${escapeHtml((s.names || []).map((e) => e.n).join(', '))}</td><td class="c3">${escapeHtml((s.aufsicht || []).map((e) => e.n).concat(s.extra ? [s.extra] : []).join(', '))}</td></tr>`).join('');
  const cells = d.teige.map((t) => `${t.n}. ${t.name || ''}`);
  const teigRows = [];
  for (let i = 0; i < cells.length; i += 2) teigRows.push(`<tr style="height:${th}mm"><td>${escapeHtml(cells[i])}</td><td>${escapeHtml(cells[i + 1] || '')}</td></tr>`);
  return `<div style="font-size:${fs}pt"><div class="ps-head"><h1>${escapeHtml(d.meta.dateText || AUSHANG_TAGE[day])}</h1>${logo ? `<img src="${escapeHtml(logo)}" alt="">` : ''}</div>
    <h2>Unterstützung vor Ort</h2>
    <table class="ps-table ps-slots"><tr><th>Zeit</th><th>Name</th><th>${escapeHtml(aux)}</th></tr>${rows}</table>
    <h2>Waffelteig</h2>
    <table class="ps-table ps-teig">${teigRows.join('')}</table></div>`;
}
window.aushangPrintPage = aushangPrintPage;
window.printAushang = function (day) {
  if (!window.can('aushang.print')) { notify('Drucken ist für deine Anmeldung nicht freigegeben.'); return; }
  const days = day === 'beide' ? ['samstag', 'sonntag'] : [day];
  window.printHtml(days.map((x) => '<div class="ps-page">' + aushangPrintPage(x) + '</div>').join(''));
};

// --- Aufbau: Ablauf, Hinweise, Bilder und Skizzen ---
function aufbauKeys() {
  return aufbauStore.items().filter((x) => x.kind === 'image').map((x) => x.imageKey);
}
function renderAufbau() {
  const root = document.getElementById('aufbauRoot');
  if (!root) return;
  const items = aufbauStore.items();
  const check = window.can('aufbau.check');
  const canSort = window.can('aufbau.sort');
  const btn = 'px-2 py-1 rounded-lg text-[11px] font-bold border transition bg-slate-100 dark:bg-slate-800 border-slate-300 dark:border-slate-700';
  const tools = (it, kind) => {
    const same = items.filter((x) => x.kind === kind);
    const i = same.findIndex((x) => x.id === it.id);
    const sortBtns = canSort ? `<button type="button" onclick="window.moveAufbau('${escapeHtml(it.id)}', -1)" ${i === 0 ? 'disabled' : ''} class="${btn} disabled:opacity-30">⬆️</button> <button type="button" onclick="window.moveAufbau('${escapeHtml(it.id)}', 1)" ${i === same.length - 1 ? 'disabled' : ''} class="${btn} disabled:opacity-30">⬇️</button> ` : '';
    const editBtn = window.can('aufbau.' + kind + 'Edit') ? `<button type="button" onclick="window.editAufbauItem('${escapeHtml(it.id)}')" class="${btn}">✏️</button> ` : '';
    const delBtn = window.can('aufbau.' + kind + 'Delete') ? `<button type="button" onclick="window.deleteAufbauItem('${escapeHtml(it.id)}')" class="${btn} !bg-rose-500/10 !border-rose-500/30 text-rose-500">🗑️</button>` : '';
    return sortBtns || editBtn || delBtn ? `<span class="whitespace-nowrap">${sortBtns}${editBtn}${delBtn}</span>` : '';
  };
  const steps = items.filter((x) => x.kind === 'step');
  const notes = items.filter((x) => x.kind === 'note');
  const images = items.filter((x) => x.kind === 'image');
  const doneCount = steps.filter((s) => s.done).length;
  const card = 'bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm p-5 space-y-3';
  root.innerHTML = `
    <div class="${card}">
      <div class="flex flex-wrap items-center justify-between gap-2">
        <h3 class="font-black text-base text-slate-900 dark:text-slate-100">✅ Ablauf <span class="text-xs font-semibold text-slate-500 dark:text-slate-400">${doneCount}/${steps.length} erledigt</span></h3>
        ${window.can('aufbau.stepAdd') ? '<button type="button" onclick="window.addAufbauStep()" class="px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-slate-950 text-xs font-black rounded-xl shadow transition">➕ Schritt</button>' : ''}
      </div>
      ${steps.length ? `<div class="divide-y divide-slate-200 dark:divide-slate-800/60">${steps.map((s) => `<div class="py-2.5 flex flex-wrap items-start gap-3 ${s.done ? 'opacity-60' : ''}">
        <input type="checkbox" ${check ? '' : 'disabled'} ${s.done ? 'checked' : ''} onchange="window.toggleAufbauDone('${escapeHtml(s.id)}', this.checked)" class="w-5 h-5 mt-0.5 accent-emerald-500" />
        <div class="min-w-[4.5rem] text-xs font-black text-amber-600 dark:text-amber-400">${escapeHtml(s.time || '')}</div>
        <div class="flex-1 min-w-[10rem]"><div class="text-sm font-bold text-slate-900 dark:text-slate-100 ${s.done ? 'line-through' : ''}">${escapeHtml(s.title)}</div>${s.text ? `<div class="text-xs text-slate-600 dark:text-slate-300 whitespace-pre-line">${escapeHtml(s.text)}</div>` : ''}${s.who ? `<div class="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">👤 ${escapeHtml(s.who)}</div>` : ''}</div>
        ${tools(s, 'step')}
      </div>`).join('')}</div>` : '<div class="text-xs text-slate-500 dark:text-slate-400">Noch keine Schritte. Lege den Aufbau mit „➕ Schritt“ an, z. B. „12:30 Hütte aufschließen“.</div>'}
    </div>
    <div class="${card}">
      <div class="flex flex-wrap items-center justify-between gap-2">
        <h3 class="font-black text-base text-slate-900 dark:text-slate-100">📝 Hinweise</h3>
        ${window.can('aufbau.noteAdd') ? '<button type="button" onclick="window.addAufbauNote()" class="px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-slate-950 text-xs font-black rounded-xl shadow transition">➕ Hinweis</button>' : ''}
      </div>
      ${notes.length ? notes.map((n) => `<div class="rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 p-3 space-y-1">
        <div class="flex flex-wrap items-start justify-between gap-2"><div class="text-sm font-bold text-slate-900 dark:text-slate-100">${escapeHtml(n.title)}</div>${tools(n, 'note')}</div>
        <div class="text-xs text-slate-700 dark:text-slate-200 whitespace-pre-line">${escapeHtml(n.text)}</div></div>`).join('') : '<div class="text-xs text-slate-500 dark:text-slate-400">Noch keine Hinweise.</div>'}
    </div>
    <div class="${card}">
      <div class="flex flex-wrap items-center justify-between gap-2">
        <h3 class="font-black text-base text-slate-900 dark:text-slate-100">🖼️ Bilder &amp; Skizzen</h3>
        <div class="flex gap-2">
          <button type="button" onclick="switchView('verkabelung')" class="${btn}">⚡ Stromplan öffnen</button>
          ${window.can('aufbau.imageAdd') ? '<button type="button" onclick="window.addAufbauImage()" class="px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-slate-950 text-xs font-black rounded-xl shadow transition">➕ Bild</button>' : ''}
        </div>
      </div>
      ${images.length ? `<div class="grid grid-cols-1 sm:grid-cols-2 gap-4">${images.map((im) => `<div class="rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden bg-slate-50 dark:bg-slate-800/50">
        <button type="button" onclick="window.openAufbauImage('${escapeHtml(im.id)}')" class="block w-full bg-white"><img data-imgkey="${escapeHtml(im.imageKey)}" alt="${escapeHtml(im.title)}" class="hidden w-full max-h-72 object-contain"><span data-imgwait="${escapeHtml(im.imageKey)}" class="block py-10 text-xs text-slate-400">Bild wird geladen…</span></button>
        <div class="p-3 space-y-1"><div class="flex flex-wrap items-start justify-between gap-2"><div class="text-sm font-bold text-slate-900 dark:text-slate-100">${escapeHtml(im.title)}</div>${tools(im, 'image')}</div>${im.text ? `<div class="text-xs text-slate-600 dark:text-slate-300 whitespace-pre-line">${escapeHtml(im.text)}</div>` : ''}</div></div>`).join('')}</div>` : '<div class="text-xs text-slate-500 dark:text-slate-400">Noch keine Bilder. Lade Fotos oder Skizzen vom Standaufbau hoch.</div>'}
    </div>`;
  fillAufbauImages();
}
window.renderAufbau = renderAufbau;
function fillAufbauImages() {
  const root = document.getElementById('aufbauRoot');
  if (!root || !root.querySelectorAll) return;
  root.querySelectorAll('img[data-imgkey]').forEach((img) => {
    const rec = getImageRec(img.dataset.imgkey);
    if (rec && rec.data) {
      if (img.dataset.sig !== rec.sig) {
        img.src = rec.data;
        img.dataset.sig = rec.sig;
      }
      img.classList.remove('hidden');
      const wait = root.querySelector('[data-imgwait="' + img.dataset.imgkey + '"]');
      if (wait) wait.classList.add('hidden');
    }
  });
}
window.syncAufbau = async function () {
  await aufbauStore.sync();
  const keys = aufbauKeys();
  if (keys.length && (await window.syncImages(keys))) fillAufbauImages();
};
function aufbauItem(id) {
  return aufbauStore.items().find((x) => x.id === id);
}
window.addAufbauStep = async function () {
  if (!window.can('aufbau.stepAdd')) return;
  const v = await window.uiForm({
    title: 'Neuer Schritt',
    fields: [
      { key: 'time', label: 'Uhrzeit (optional)', type: 'text', placeholder: 'z. B. 12:30', maxlength: 30 },
      { key: 'title', label: 'Was ist zu tun?', type: 'text', required: true, maxlength: 120 },
      { key: 'who', label: 'Wer? (optional)', type: 'text', maxlength: 80 },
      { key: 'text', label: 'Details (optional)', type: 'textarea', maxlength: 600 }
    ],
    okText: 'Hinzufügen'
  });
  if (!v) return;
  aufbauStore.apply({ op: 'save', item: { id: newId('a'), kind: 'step', time: v.time.trim(), title: v.title.trim(), text: v.text.trim(), who: v.who.trim(), done: false } });
  renderAufbau();
};
window.addAufbauNote = async function () {
  if (!window.can('aufbau.noteAdd')) return;
  const v = await window.uiForm({
    title: 'Neuer Hinweis',
    fields: [
      { key: 'title', label: 'Überschrift', type: 'text', required: true, maxlength: 120 },
      { key: 'text', label: 'Text', type: 'textarea', maxlength: 3000 }
    ],
    okText: 'Hinzufügen'
  });
  if (!v) return;
  aufbauStore.apply({ op: 'save', item: { id: newId('a'), kind: 'note', title: v.title.trim(), text: v.text.trim() } });
  renderAufbau();
};
window.addAufbauImage = async function () {
  if (!window.can('aufbau.imageAdd')) return;
  const v = await window.uiForm({
    title: 'Neues Bild',
    fields: [
      { key: 'file', label: 'Foto oder Skizze', type: 'file', accept: 'image/*', required: true },
      { key: 'title', label: 'Titel', type: 'text', required: true, maxlength: 120 },
      { key: 'text', label: 'Beschreibung (optional)', type: 'textarea', maxlength: 300 }
    ],
    okText: 'Hochladen'
  });
  if (!v) return;
  let dataUrl;
  try {
    dataUrl = await fileToCompressed(v.file, 1400);
  } catch (e) {
    notify(e.message);
    return;
  }
  const id = newId('a');
  const key = 'aufbau_' + id;
  const rec = { sig: hashString(dataUrl), data: dataUrl, synced: false };
  saveImageLocal(key, rec);
  aufbauStore.apply({ op: 'save', item: { id: id, kind: 'image', title: v.title.trim(), text: v.text.trim(), imageKey: key } });
  renderAufbau();
  const ok = await uploadImageRecord(key, rec);
  notify(ok ? 'Bild hochgeladen, jetzt für alle sichtbar.' : 'Bild nur auf diesem Gerät gespeichert. Der Upload wird erneut versucht.');
};
window.toggleAufbauDone = function (id, checked) {
  if (!window.can('aufbau.check')) return;
  const it = aufbauItem(id);
  if (!it) return;
  aufbauStore.apply({ op: 'save', item: Object.assign({}, it, { done: !!checked }) });
  renderAufbau();
};
window.editAufbauItem = async function (id) {
  const it = aufbauItem(id);
  if (!it || !window.can('aufbau.' + it.kind + 'Edit')) return;
  let fields;
  if (it.kind === 'step') {
    fields = [
      { key: 'time', label: 'Uhrzeit (optional)', type: 'text', value: it.time, maxlength: 30 },
      { key: 'title', label: 'Was ist zu tun?', type: 'text', value: it.title, required: true, maxlength: 120 },
      { key: 'who', label: 'Wer? (optional)', type: 'text', value: it.who, maxlength: 80 },
      { key: 'text', label: 'Details (optional)', type: 'textarea', value: it.text, maxlength: 600 }
    ];
  } else if (it.kind === 'note') {
    fields = [
      { key: 'title', label: 'Überschrift', type: 'text', value: it.title, required: true, maxlength: 120 },
      { key: 'text', label: 'Text', type: 'textarea', value: it.text, maxlength: 3000 }
    ];
  } else {
    fields = [
      { key: 'title', label: 'Titel', type: 'text', value: it.title, required: true, maxlength: 120 },
      { key: 'text', label: 'Beschreibung (optional)', type: 'textarea', value: it.text, maxlength: 300 }
    ];
  }
  const v = await window.uiForm({ title: 'Bearbeiten', fields: fields, okText: 'Speichern' });
  if (!v) return;
  const next = Object.assign({}, it);
  Object.keys(v).forEach((k) => { next[k] = typeof v[k] === 'string' ? v[k].trim() : v[k]; });
  aufbauStore.apply({ op: 'save', item: next });
  renderAufbau();
};
window.deleteAufbauItem = async function (id) {
  const it = aufbauItem(id);
  if (!it || !window.can('aufbau.' + it.kind + 'Delete')) return;
  const ok = await window.uiConfirm({ title: 'Löschen?', message: '„' + (it.title || 'Eintrag') + '“ wird gelöscht.', okText: 'Löschen' });
  if (!ok) return;
  aufbauStore.apply({ op: 'del', id: id });
  if (it.kind === 'image') {
    saveImageLocal(it.imageKey, null);
    postToSheets({ action: 'imageDelete', name: it.imageKey });
  }
  renderAufbau();
};
window.moveAufbau = function (id, dir) {
  if (!window.can('aufbau.sort')) return;
  const all = aufbauStore.items();
  const it = all.find((x) => x.id === id);
  if (!it) return;
  const same = all.filter((x) => x.kind === it.kind);
  const neighbor = same[same.findIndex((x) => x.id === id) + dir];
  if (!neighbor) return;
  aufbauStore.apply({ op: 'move', id: id, to: all.findIndex((x) => x.id === neighbor.id) });
  renderAufbau();
};
window.openAufbauImage = function (id) {
  const it = aufbauItem(id);
  const rec = it && getImageRec(it.imageKey);
  if (rec && rec.data) window.openLightbox(rec.data, it.title);
};
window.printAufbau = function () {
  if (!window.can('aufbau.print')) { notify('Drucken ist für deine Anmeldung nicht freigegeben.'); return; }
  const items = aufbauStore.items();
  const steps = items.filter((x) => x.kind === 'step');
  const notes = items.filter((x) => x.kind === 'note');
  const images = items.filter((x) => x.kind === 'image');
  const stepRows = steps.map((s) => `<tr><td class="c1">${s.done ? '☑' : '☐'} ${escapeHtml(s.time)}</td><td><b>${escapeHtml(s.title)}</b>${s.text ? '<br>' + escapeHtml(s.text).replace(/\n/g, '<br>') : ''}</td><td class="c3">${escapeHtml(s.who)}</td></tr>`).join('');
  const noteHtml = notes.map((n) => `<h3>${escapeHtml(n.title)}</h3><p>${escapeHtml(n.text).replace(/\n/g, '<br>')}</p>`).join('');
  const imgHtml = images.map((im) => { const rec = getImageRec(im.imageKey); return rec && rec.data ? `<div class="ps-img"><img src="${rec.data}" alt=""><p>${escapeHtml(im.title)}</p></div>` : ''; }).join('');
  window.printHtml(`<div class="ps-head"><h1>Aufbauplan Weihnachtsmarkt</h1></div>${steps.length ? `<h2>Ablauf</h2><table class="ps-table ps-slots"><tr><th>Zeit</th><th>Was</th><th>Wer</th></tr>${stepRows}</table>` : ''}${noteHtml ? '<h2>Hinweise</h2>' + noteHtml : ''}${imgHtml ? '<h2>Bilder &amp; Skizzen</h2>' + imgHtml : ''}`);
};

// --- Vollbildansicht ---
window.openAushang = function (day) {
  const rec = getImageRec(day);
  if (!rec || !rec.data) return;
  window.openLightbox(rec.data, AUSHANG_TAGE[day] + ' - Aushang');
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
window.rerenderAll = function () {
  [window.renderKasse, window.renderStatistik, window.renderInventar, renderEinkaufsliste, renderLagerbestand, renderVerkabelung, renderBoxen, renderAushangLists, renderAufbau, renderRezepte, renderAdmin, renderLogin].forEach((fn) => {
    try { fn(); } catch (e) { console.warn('Neu zeichnen fehlgeschlagen:', e); }
  });
};
function initApp() {
  window.primeStart();
  if (window.WM_PAGE_VERSION && window.WM_PAGE_VERSION !== APP_VERSION && window.wmBanner) window.wmBanner('ver', 'Seite (Version ' + window.WM_PAGE_VERSION + ') und Skript (Version ' + APP_VERSION + ') passen nicht zusammen. Bitte alle Dateien des Portals in derselben Lieferung hochladen und die Seite neu laden.');
  try { if (typeof navigator !== 'undefined' && navigator.storage && navigator.storage.persist) navigator.storage.persist(); } catch (e) { /* egal */ }
  window.initTheme();
  recomputeKasse();
  persistKasse();
  window.applyRolePermissions(window.currentUserRole);
  window.renderKasse();
  window.renderStatistik();
  window.renderInventar();
  window.renderAushangImages();
  renderAushangLists();
  window.initStromDnd();
  renderRezepte();
  renderLogin();
  window.refreshRoles();
  setupApp();
  setupKioskExit();
  checkScriptVersion();
  setKasseBadge(kasseOps.length || Object.keys(kassePatch).length ? 'pending' : 'loading');

  window.pullAushang();
  if (window.isLoggedIn()) {
    window.syncKasse();
    window.syncInventar();
    produkteStore.sync();
    rezepteStore.sync();
    window.ensureBoxMigration();
  }

  // Regelmaessiger Abgleich: aktive Ansicht alle 10 s, sonst seltener
  let tick = 0;
  setInterval(() => {
    if (document.hidden) return;
    tick++;
    const view = window.currentView;
    if (view === 'admin' && window.adminTab !== 'verwaltung') loadAccessData();
    else if (tick % 4 === 0 || view === 'admin' || view === 'login') window.refreshRoles();
    if (view === 'aushang') {
      aushangStore.sync();
      if (tick % 8 === 0) window.pullAushang();
    }
    if (window.isLoggedIn()) {
      const kasseView = view === 'verkauf' || view === 'statistik' || view === 'admin';
      const invView = ['inventar', 'einkaufsliste', 'lagerbestand', 'verkabelung', 'boxen'].indexOf(view) >= 0;
      if (kasseView || tick % 4 === 0) window.syncKasse();
      if (kasseView || tick % 4 === 0) produkteStore.sync();
      if (invView || tick % 4 === 0) window.syncInventar();
      if (view === 'statistik') expenseStore.sync();
      if (view === 'statistik' && tick % 4 === 0) window.loadHourly();
      if (view === 'verkauf') kassensturzStore.sync();
      if (view === 'status') { if (tick % 4 === 0) window.runStatusCheck(); else renderStatus(); }
      if (view === 'boxen') boxStore.sync();
      if (view === 'rezepte') rezepteStore.sync();
      if (view === 'verkabelung') stromStore.sync();
      if (view === 'aufbau') {
        aufbauStore.sync();
        if (tick % 8 === 0) window.syncAufbau();
      }
    }
  }, 10000);
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) return;
    window.refreshRoles();
    window.pullAushang();
    if (window.isLoggedIn()) {
      window.syncKasse();
      window.syncInventar();
    }
  });
  window.__wmBooted = true;
  try { const bb = document.getElementById('wmB_boot'); if (bb) bb.remove(); } catch (e) { /* egal */ }
}
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initApp);
} else {
  initApp();
}
