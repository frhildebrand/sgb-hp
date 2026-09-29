// ==========================================
// SG BARNSTORF WEIHNACHTSMARKT - ENGINE
// ==========================================

const GOOGLE_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbyQg2LmxT_UbLXjFVKrNf9gXnqgk_ku4V_P1SZeSGqphn-WRTYI3a9l5szzkDfqEE881Q/exec';

// Standard-Inventar mit allen Kategorien & allen 5 Status (offen, vorbereitet, verteilt, eingekauft, erledigt)
const DEFAULT_INVENTAR_CATEGORIES = [
  {
    category: "🏛️ ORGA",
    items: [
      { name: "Anmeldung Teilnahme", note: "An Gemeinde Barnstorf", bedarf: "1", lager: "0", status: "offen", wer: "", pack: false, box: "" },
      { name: "Hütte Gemeinde", note: "Aufbau Tag & Zeit abklären", bedarf: "1", lager: "0", status: "offen", wer: "", pack: false, box: "" },
      { name: "Listen Roshop Unterstützung", note: "Aufhängen Schwarzes Brett", bedarf: "1", lager: "0", status: "offen", wer: "", pack: false, box: "" },
      { name: "Anzeige Gaststättengewerbe", note: "Gemeinde / Amt", bedarf: "1", lager: "0", status: "offen", wer: "", pack: false, box: "" }
    ]
  },
  {
    category: "🛠️ WERKZEUGE",
    items: [
      { name: "Hammer", note: "Auf- und Abbau", bedarf: "1", lager: "0", status: "offen", wer: "", pack: false, box: "" },
      { name: "Nagelzange", note: "Standzubehör", bedarf: "1", lager: "0", status: "offen", wer: "", pack: false, box: "" },
      { name: "Schere", note: "Verpackung & Deko", bedarf: "1", lager: "0", status: "offen", wer: "", pack: false, box: "" },
      { name: "Akkuschrauber + Bit-Set", note: "Inkl. Ersatzakku", bedarf: "1", lager: "1", status: "vorbereitet", wer: "Technik-Team", pack: false, box: "Werkzeugkiste" },
      { name: "Kabelbinder Set", note: "Befestigung Deko & Lichter", bedarf: "3", lager: "2", status: "eingekauft", wer: "SG Barnstorf", pack: true, box: "Box 1" },
      { name: "Panzertape / Gewebeband", note: "Kabelfixierung", bedarf: "2", lager: "2", status: "erledigt", wer: "Orga", pack: true, box: "Box 1" }
    ]
  },
  {
    category: "⚡ ELEKTRO & LICHT",
    items: [
      { name: "Verlängerungskabel Outdoor", note: "Schuko IP44", bedarf: "4", lager: "4", status: "erledigt", wer: "SG Barnstorf", pack: true, box: "Kiste Elektro" },
      { name: "Mehrfachsteckdosen", note: "IP44 Outdoor", bedarf: "5", lager: "5", status: "erledigt", wer: "SG Barnstorf", pack: true, box: "Kiste Elektro" },
      { name: "Lichterkette Warmweiß", note: "Standbeleuchtung", bedarf: "3", lager: "3", status: "verteilt", wer: "SG Barnstorf", pack: true, box: "Kiste Deko" }
    ]
  },
  {
    category: "🧇 WAFFELN, PUNSCH & GASTRO",
    items: [
      { name: "Doppel-Waffeleisen", note: "Gastro-Qualität", bedarf: "2", lager: "2", status: "erledigt", wer: "SG Barnstorf", pack: true, box: "Kiste Küche" },
      { name: "Kinderpunsch Einkocher", note: "27 Liter Thermotop", bedarf: "2", lager: "2", status: "erledigt", wer: "SG Barnstorf", pack: true, box: "Kiste Gastro" },
      { name: "Teigbehälter & Schöpfkelle", note: "Lebensmittelecht mit Deckel", bedarf: "2", lager: "2", status: "erledigt", wer: "SG Barnstorf", pack: true, box: "Kiste Küche" }
    ]
  },
  {
    category: "🛒 EINKAUF & CONSUMABLES",
    items: [
      { name: "Thermobecher (0,2l)", note: "Für Kinderpunsch-Ausschank", bedarf: "400", lager: "400", status: "eingekauft", wer: "Einkaufsteam", pack: true, box: "Verbrauch Kiste 1" },
      { name: "Servietten & Einwegteller", note: "Waffelausgabe", bedarf: "500", lager: "500", status: "eingekauft", wer: "Einkaufsteam", pack: true, box: "Verbrauch Kiste 2" },
      { name: "Waffelteig Zutaten", note: "Mehl, Eier, Butter, Milch, Zucker", bedarf: "15kg", lager: "15kg", status: "eingekauft", wer: "Küche", pack: false, box: "Kühlung" },
      { name: "Kinderpunsch Kanister", note: "Fruchtpunsch alkoholfrei", bedarf: "60L", lager: "60L", status: "eingekauft", wer: "Einkaufsteam", pack: false, box: "Gastro Lager" }
    ]
  },
  {
    category: "🪙 KASSE & HYGIENE",
    items: [
      { name: "Wechselgeldkassette", note: "Inkl. Geldscheinfächer & Schlüssel", bedarf: "1", lager: "1", status: "erledigt", wer: "Kassierer", pack: true, box: "Orga" },
      { name: "Desinfektion & Hygiene-Set", note: "Handdesinfektion & Einweg-Handschuhe", bedarf: "2", lager: "2", status: "erledigt", wer: "Hygienebeauftragter", pack: true, box: "Hygiene" }
    ]
  }
];

// App-Status
window.currentUserRole = localStorage.getItem('userRole') || 'admin';
window.currentFilterStatus = 'alle';
window.currentSearchTerm = '';

// Kassen-Zustand Initialisierung
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
  window.kasseData = savedKasse ? Object.assign({}, DEFAULT_KASSE_DATA, JSON.parse(savedKasse)) : { ...DEFAULT_KASSE_DATA };
} catch (e) {
  window.kasseData = { ...DEFAULT_KASSE_DATA };
}

// Initialisierung der Inventardaten aus LocalStorage oder Fallback
function getInitialInventarData() {
  try {
    const savedInv = localStorage.getItem('inventarData');
    if (savedInv) {
      const parsed = JSON.parse(savedInv);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch (e) {
    console.error('Fehler beim Lesen des LocalStorage:', e);
  }
  return JSON.parse(JSON.stringify(DEFAULT_INVENTAR_CATEGORIES));
}

window.inventarData = getInitialInventarData();

// Dynamic Toast Notification
function showToast(message, type = 'info') {
  let container = document.getElementById('toastContainer');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toastContainer';
    container.className = 'fixed bottom-5 right-5 z-50 flex flex-col gap-2 max-w-sm pointer-events-none';
    document.body.appendChild(container);
  }

  const toast = document.createElement('div');
  let bgClass = 'bg-slate-900/95 border-slate-700 text-slate-100';
  if (type === 'error') bgClass = 'bg-rose-950/95 border-rose-700 text-rose-100';
  if (type === 'success') bgClass = 'bg-emerald-950/95 border-emerald-700 text-emerald-100';

  toast.className = `pointer-events-auto px-4 py-3 rounded-xl border shadow-2xl text-xs font-bold backdrop-blur transition-all transform translate-y-2 opacity-0 flex items-center justify-between gap-3 ${bgClass}`;
  toast.innerHTML = `<span>${message}</span>`;

  container.appendChild(toast);
  requestAnimationFrame(() => toast.classList.remove('translate-y-2', 'opacity-0'));

  setTimeout(() => {
    toast.classList.add('opacity-0', 'translate-y-2');
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}
window.showToast = showToast;

// Theme Toggle & Dark Mode
function applyDarkMode(isDark) {
  if (isDark) {
    document.documentElement.classList.add('dark');
  } else {
    document.documentElement.classList.remove('dark');
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

// Navigation zwischen Ansichten
function switchView(viewName) {
  const views = document.querySelectorAll('main > div[id^="view"], div[id^="view"]');
  views.forEach(v => v.classList.add('hidden'));

  const lowerName = (viewName || '').toLowerCase();
  let targetId = 'view' + viewName.charAt(0).toUpperCase() + viewName.slice(1);
  if (lowerName === 'verkauf' || lowerName === 'kasse') {
    targetId = 'viewVerkauf';
  }

  const targetView = document.getElementById(targetId);
  if (targetView) {
    targetView.classList.remove('hidden');
    if (lowerName === 'inventar') {
      loadInventarFromGoogleSheets();
      renderInventar();
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

// Login & Rollensystem
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
    switchView('inventar');
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
  window.currentUserRole = role || 'admin';
  const roleLabel = document.getElementById('roleLabel');
  const roleIcon = document.getElementById('roleIcon');

  if (roleLabel) {
    roleLabel.innerText = role === 'admin' ? 'ADMIN' : (role === 'orga' ? 'ORGA' : (role === 'helfer' ? 'HELFER' : 'GAST'));
  }
  if (roleIcon) {
    roleIcon.innerText = role === 'admin' ? '🟢' : (role === 'orga' ? '🔵' : (role === 'helfer' ? '🟡' : '👁️'));
  }

  const adminControls = document.querySelectorAll('.admin-only-control');
  adminControls.forEach(el => {
    if (role === 'admin' || role === 'orga') {
      el.classList.remove('hidden');
    } else {
      el.classList.add('hidden');
    }
  });

  renderInventar();
  renderKasse();
}
window.applyRolePermissions = applyRolePermissions;

// Suche & Filter im Inventar
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

// Filter-Buttons inklusive ALLEN 5 Status (Alle, Offen, Vorbereitet, Verteilt, Eingekauft, Erledigt)
function renderFilterButtons() {
  const container = document.getElementById('filterButtonsContainer');
  if (!container) return;

  const filters = [
    { id: 'alle', label: 'Alle' },
    { id: 'offen', label: 'Offen' },
    { id: 'vorbereitet', label: 'Vorbereitet' },
    { id: 'verteilt', label: 'Verteilt' },
    { id: 'eingekauft', label: 'Eingekauft' },
    { id: 'erledigt', label: 'Erledigt' }
  ];

  container.innerHTML = filters.map(f => {
    const isActive = window.currentFilterStatus === f.id;
    let colorClass = '';

    if (isActive) {
      colorClass = 'bg-amber-500 text-slate-950 font-black border-amber-500 shadow-md scale-105';
    } else {
      if (f.id === 'offen') colorClass = 'bg-rose-950/40 text-rose-400 border-rose-800/60 hover:bg-rose-900/50';
      else if (f.id === 'vorbereitet') colorClass = 'bg-amber-950/40 text-amber-400 border-amber-800/60 hover:bg-amber-900/50';
      else if (f.id === 'verteilt') colorClass = 'bg-sky-950/40 text-sky-400 border-sky-800/60 hover:bg-sky-900/50';
      else if (f.id === 'eingekauft') colorClass = 'bg-purple-950/40 text-purple-400 border-purple-800/60 hover:bg-purple-900/50';
      else if (f.id === 'erledigt') colorClass = 'bg-emerald-950/40 text-emerald-400 border-emerald-800/60 hover:bg-emerald-900/50';
      else colorClass = 'bg-slate-900 text-slate-300 border-slate-800 hover:bg-slate-800';
    }

    return `<button onclick="window.setFilterStatus('${f.id}')" class="px-3.5 py-1.5 text-xs font-bold rounded-xl border transition-all ${colorClass}">${f.label}</button>`;
  }).join('');
}

// Rendering der Inventartabellen
function renderInventar() {
  renderFilterButtons();
  const container = document.getElementById('inventarTablesContainer');
  if (!container) return;

  if (!window.inventarData || !Array.isArray(window.inventarData) || window.inventarData.length === 0) {
    window.inventarData = getInitialInventarData();
  }

  let totalCount = 0;
  let completedCount = 0;

  window.inventarData.forEach(cat => {
    (cat.items || []).forEach(item => {
      totalCount++;
      if (item.status === 'erledigt' || item.pack) completedCount++;
    });
  });

  const progressPercent = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;
  const progressEl = document.getElementById('inventarProgressText');
  if (progressEl) {
    progressEl.innerText = `${progressPercent}% erledigt (${completedCount}/${totalCount})`;
  }

  let html = window.inventarData.map((cat, catIdx) => {
    const items = cat.items || [];

    const filteredItems = items.filter(item => {
      const name = (item.name || '').toLowerCase();
      const note = (item.note || '').toLowerCase();
      const wer = (item.wer || '').toLowerCase();
      const box = (item.box || '').toLowerCase();

      const matchesSearch = !window.currentSearchTerm || 
        name.includes(window.currentSearchTerm) || 
        note.includes(window.currentSearchTerm) || 
        wer.includes(window.currentSearchTerm) || 
        box.includes(window.currentSearchTerm);

      const status = (item.status || 'offen').toLowerCase();
      const matchesFilter = window.currentFilterStatus === 'alle' || status === window.currentFilterStatus;

      return matchesSearch && matchesFilter;
    });

    if (filteredItems.length === 0 && window.currentSearchTerm) return '';

    const rowsHtml = filteredItems.map((item) => {
      const realIndex = items.indexOf(item);
      const st = (item.status || 'offen').toLowerCase();

      let statusColor = 'text-rose-400 border-rose-500/40 bg-rose-500/10';
      if (st === 'vorbereitet') statusColor = 'text-amber-400 border-amber-500/40 bg-amber-500/10';
      if (st === 'verteilt') statusColor = 'text-sky-400 border-sky-500/40 bg-sky-500/10';
      if (st === 'eingekauft') statusColor = 'text-purple-400 border-purple-500/40 bg-purple-500/10';
      if (st === 'erledigt') statusColor = 'text-emerald-400 border-emerald-500/40 bg-emerald-500/10';

      return `
        <tr class="border-b border-slate-800/60 hover:bg-slate-800/30 transition text-xs">
          <!-- GEGENSTAND -->
          <td class="py-3 px-4">
            <div class="font-bold text-slate-100">${item.name || ''}</div>
            ${item.note ? `<div class="text-[10px] text-slate-400 mt-0.5">${item.note}</div>` : ''}
          </td>

          <!-- BEDARF -->
          <td class="py-3 px-3 text-center">
            <input type="text" value="${item.bedarf || '1'}" 
              onchange="window.updateInventarField(${catIdx}, ${realIndex}, 'bedarf', this.value)"
              class="w-12 text-center py-1 bg-slate-950 border border-slate-800 rounded font-bold text-slate-200 focus:border-amber-500 focus:outline-none" />
          </td>

          <!-- LAGER -->
          <td class="py-3 px-3 text-center">
            <input type="text" value="${item.lager || '0'}" 
              onchange="window.updateInventarField(${catIdx}, ${realIndex}, 'lager', this.value)"
              class="w-12 text-center py-1 bg-slate-950 border border-slate-800 rounded font-bold text-emerald-400 focus:border-amber-500 focus:outline-none" />
          </td>

          <!-- STATUS -->
          <td class="py-3 px-3">
            <select onchange="window.updateInventarField(${catIdx}, ${realIndex}, 'status', this.value)" 
              class="px-2.5 py-1 text-xs font-bold rounded-lg border focus:outline-none ${statusColor}">
              <option value="offen" class="bg-slate-900 text-rose-400" ${st === 'offen' ? 'selected' : ''}>Offen</option>
              <option value="vorbereitet" class="bg-slate-900 text-amber-400" ${st === 'vorbereitet' ? 'selected' : ''}>Vorbereitet</option>
              <option value="verteilt" class="bg-slate-900 text-sky-400" ${st === 'verteilt' ? 'selected' : ''}>Verteilt</option>
              <option value="eingekauft" class="bg-slate-900 text-purple-400" ${st === 'eingekauft' ? 'selected' : ''}>Eingekauft</option>
              <option value="erledigt" class="bg-slate-900 text-emerald-400" ${st === 'erledigt' ? 'selected' : ''}>Erledigt</option>
            </select>
          </td>

          <!-- WER -->
          <td class="py-3 px-3">
            <input type="text" placeholder="Name..." value="${item.wer || ''}" 
              onchange="window.updateInventarField(${catIdx}, ${realIndex}, 'wer', this.value)"
              class="w-28 px-2.5 py-1 bg-slate-950 border border-slate-800 rounded text-slate-300 placeholder-slate-600 focus:border-amber-500 focus:outline-none" />
          </td>

          <!-- PACK -->
          <td class="py-3 px-3 text-center">
            <input type="checkbox" ${item.pack ? 'checked' : ''} 
              onchange="window.updateInventarField(${catIdx}, ${realIndex}, 'pack', this.checked)"
              class="w-4 h-4 rounded border-slate-700 bg-slate-900 text-amber-500 focus:ring-amber-500" />
          </td>

          <!-- BOX -->
          <td class="py-3 px-4">
            <input type="text" placeholder="Box..." value="${item.box || ''}" 
              onchange="window.updateInventarField(${catIdx}, ${realIndex}, 'box', this.value)"
              class="w-28 px-2.5 py-1 bg-slate-950 border border-slate-800 rounded text-slate-300 focus:border-amber-500 focus:outline-none" />
          </td>
        </tr>
      `;
    }).join('');

    return `
      <div class="bg-slate-900/90 rounded-2xl border border-slate-800 shadow-xl overflow-hidden space-y-1">
        <div class="bg-slate-950/80 px-5 py-3.5 border-b border-slate-800/80 flex justify-between items-center">
          <h3 class="font-black text-sm text-amber-400 flex items-center gap-2">
            <span>${cat.category || 'Kategorie'}</span>
          </h3>
          <span class="text-[11px] font-bold text-slate-400 bg-slate-800 px-2.5 py-1 rounded-full">${filteredItems.length} Einträge</span>
        </div>
        <div class="overflow-x-auto">
          <table class="w-full text-left border-collapse">
            <thead>
              <tr class="text-[10px] font-black uppercase tracking-wider text-slate-400 border-b border-slate-800/80 bg-slate-950/30">
                <th class="py-2.5 px-4">GEGENSTAND</th>
                <th class="py-2.5 px-3 text-center">BEDARF</th>
                <th class="py-2.5 px-3 text-center">LAGER</th>
                <th class="py-2.5 px-3">STATUS</th>
                <th class="py-2.5 px-3">WER</th>
                <th class="py-2.5 px-3 text-center">PACK</th>
                <th class="py-2.5 px-4">BOX</th>
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

  container.innerHTML = html || `<div class="p-8 text-center text-slate-500 text-xs font-semibold">Keine Gegenstände für diese Suche gefunden.</div>`;
}
window.renderInventar = renderInventar;

function updateInventarField(catIdx, itemIdx, field, value) {
  if (!window.inventarData[catIdx] || !window.inventarData[catIdx].items[itemIdx]) return;
  window.inventarData[catIdx].items[itemIdx][field] = value;
  localStorage.setItem('inventarData', JSON.stringify(window.inventarData));
  renderInventar();
  syncAllWithGoogleSheets();
}
window.updateInventarField = updateInventarField;

// Kasse & Schnellverkauf Logik
function updateKassePrice(item, priceVal) {
  const price = Math.max(0, parseFloat(priceVal) || 0);
  window.kasseData[item + 'Price'] = price;
  localStorage.setItem('kasseData', JSON.stringify(window.kasseData));
  renderKasse();
  renderStatistik();
  syncAllWithGoogleSheets();
}
window.updateKassePrice = updateKassePrice;

function changeKasseCount(item, type, delta) {
  const key = item + (type === 'paid' ? 'Paid' : 'Free');
  window.kasseData[key] = Math.max(0, (window.kasseData[key] || 0) + delta);
  localStorage.setItem('kasseData', JSON.stringify(window.kasseData));
  renderKasse();
  renderStatistik();
  syncAllWithGoogleSheets();
}
window.changeKasseCount = changeKasseCount;

function renderKasse() {
  const setEl = (id, val) => { const el = document.getElementById(id); if (el) el.innerText = val; };

  setEl('countKinderpunschPaid', window.kasseData.kinderpunschPaid || 0);
  setEl('countKinderpunschFree', window.kasseData.kinderpunschFree || 0);
  setEl('countWaffelPaid', window.kasseData.waffelPaid || 0);
  setEl('countWaffelFree', window.kasseData.waffelFree || 0);

  const punschPrice = window.kasseData.kinderpunschPrice || 2.00;
  const waffelPrice = window.kasseData.waffelPrice || 2.00;

  setEl('displayKinderpunschPrice', `${punschPrice.toFixed(2).replace('.', ',')} € / Becher`);
  setEl('displayWaffelPrice', `${waffelPrice.toFixed(2).replace('.', ',')} € / Stück`);

  const totalRev = ((window.kasseData.kinderpunschPaid || 0) * punschPrice) + ((window.kasseData.waffelPaid || 0) * waffelPrice);
  setEl('kasseLiveTotalEuros', totalRev.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €');
}
window.renderKasse = renderKasse;

function renderStatistik() {
  const pPaid = window.kasseData.kinderpunschPaid || 0;
  const pFree = window.kasseData.kinderpunschFree || 0;
  const wPaid = window.kasseData.waffelPaid || 0;
  const wFree = window.kasseData.waffelFree || 0;

  const pPrice = window.kasseData.kinderpunschPrice || 2.00;
  const wPrice = window.kasseData.waffelPrice || 2.00;

  const totalRev = (pPaid * pPrice) + (wPaid * wPrice);

  const setEl = (id, txt) => { const el = document.getElementById(id); if (el) el.innerText = txt; };

  setEl('statTotalRevenue', totalRev.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €');
  setEl('statTotalPaidItems', (pPaid + wPaid) + ' Stk.');
  setEl('statTotalFreeItems', (pFree + wFree) + ' Stk.');
  setEl('statTotalAllItems', (pPaid + wPaid + pFree + wFree) + ' Stk.');

  setEl('statKinderpunschPaid', `${pPaid} Stk. (${(pPaid * pPrice).toLocaleString('de-DE', { minimumFractionDigits: 2 })} €)`);
  setEl('statKinderpunschFree', `${pFree} Stk.`);
  setEl('statKinderpunschTotal', `${pPaid + pFree} Stk.`);

  setEl('statWaffelPaid', `${wPaid} Stk. (${(wPaid * wPrice).toLocaleString('de-DE', { minimumFractionDigits: 2 })} €)`);
  setEl('statWaffelFree', `${wFree} Stk.`);
  setEl('statWaffelTotal', `${wPaid + wFree} Stk.`);
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

// Synchronisation mit Google Sheets
async function loadInventarFromGoogleSheets() {
  try {
    const res = await fetch(GOOGLE_SCRIPT_URL);
    if (res.ok) {
      let data = await res.json();
      if (typeof data === 'string') { try { data = JSON.parse(data); } catch (e) {} }

      let invArr = Array.isArray(data) ? data : (data && Array.isArray(data.inventarData) ? data.inventarData : null);
      if (invArr && invArr.length > 0) {
        window.inventarData = invArr;
        localStorage.setItem('inventarData', JSON.stringify(window.inventarData));
        renderInventar();
      }
    }
  } catch (e) {
    console.warn('Google Sheets nicht erreichbar, nutze lokalen Speicher:', e);
  }
}
window.loadInventarFromGoogleSheets = loadInventarFromGoogleSheets;

async function loadKasseFromGoogleSheets() {
  try {
    const res = await fetch(GOOGLE_SCRIPT_URL);
    if (res.ok) {
      let data = await res.json();
      if (typeof data === 'string') { try { data = JSON.parse(data); } catch (e) {} }

      if (data && data.kasseData) {
        window.kasseData = Object.assign({}, DEFAULT_KASSE_DATA, data.kasseData);
        localStorage.setItem('kasseData', JSON.stringify(window.kasseData));
        renderKasse();
        renderStatistik();
      }
    }
  } catch (e) {
    console.warn('Kassen-Sync Fehler:', e);
  }
}
window.loadKasseFromGoogleSheets = loadKasseFromGoogleSheets;

async function syncAllWithGoogleSheets() {
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
  } catch (e) {
    console.warn('Fehler beim Speichern:', e);
  }
}
window.syncAllWithGoogleSheets = syncAllWithGoogleSheets;

// Initialisierung bei App-Start
function initApp() {
  try {
    initTheme();
    applyRolePermissions(window.currentUserRole);
    renderInventar();
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
