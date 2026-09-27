/**
 * SG Barnstorf Weihnachtsmarkt - Core JavaScript
 * Binds dynamically to window.DEFAULT_ROLE_CONFIG and window.DEFAULT_ITEMS
 */

const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbzm4pz4LD6vwqwkDQXqIypYRVx9m49oliAevZPGolZYm_JKFmWN526TLE-2Z3fGP8tJ/exec";

// Fallbacks, falls die data.js mal nicht geladen ist
let roleConfig = window.DEFAULT_ROLE_CONFIG || {
  helfer: { pwd: "SGHelfer", canCash: true, canPacked: true, canQty: false, canStock: false, canBox: true, canStatus: false, canPrices: false, canLog: false },
  orga: { pwd: "SGOrga", canCash: true, canPacked: true, canQty: true, canStock: true, canBox: true, canStatus: true, canPrices: true, canLog: true },
  admin: { pwd: "SGJugend26" }
};

let itemsData = window.DEFAULT_ITEMS || [];
let appState = {};
let currentFilter = 'all';
let currentRole = 'betrachter'; // betrachter, helfer, orga, admin
let currentView = 'main';
let activityLog = [];

/* ==========================================================================
   INITIALISIERUNG & CLOUD-SYNC
   ========================================================================== */

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initApp);
} else {
  initApp();
}

async function initApp() {
  loadFromLocal();
  itemsData.forEach(item => initItemState(item));

  switchView('main');
  updateProgress();
  updateRecipeScaling();
  calculatePowerLoad();
  calculateSalesStats();
  applyRolePermissions();
  renderActivityLog();

  loadStateFromSheet();
  
  // Event-Listener für Suche
  document.getElementById('searchInput')?.addEventListener('input', renderChecklist);
}

function loadFromLocal() {
  const local = JSON.parse(localStorage.getItem('sg_wm_state_v26')) || {};
  appState = local;
  if (appState.customItemsList && appState.customItemsList.length > 0) itemsData = appState.customItemsList;
  if (appState.roleConfig) roleConfig = appState.roleConfig;
  if (appState.activityLog) activityLog = appState.activityLog;
}

async function loadStateFromSheet() {
  setSyncStatus(null, "⏳ Verbinde...");
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 4000);

    const res = await fetch(SCRIPT_URL + '?t=' + new Date().getTime(), { signal: controller.signal });
    clearTimeout(timeoutId);
    
    const cloudData = await res.json();
    if (cloudData && Object.keys(cloudData).length > 0) {
      appState = cloudData;
      if (appState.customItemsList && appState.customItemsList.length > 0) itemsData = appState.customItemsList;
      if (appState.roleConfig) roleConfig = appState.roleConfig;
      if (appState.activityLog) activityLog = appState.activityLog;
      
      localStorage.setItem('sg_wm_state_v26', JSON.stringify(appState));
      setSyncStatus(true);
      
      itemsData.forEach(item => initItemState(item));
      renderChecklist();
      renderBoxOverview();
      updateProgress();
      calculateSalesStats();
    }
  } catch(e) {
    setSyncStatus(false);
  }
}

function setSyncStatus(isOk, textOverride) {
  const el = document.getElementById('syncStatus');
  if (!el) return;
  if (textOverride) el.innerHTML = textOverride;
  else if (isOk) el.innerHTML = `🟢 Synced (${new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})})`;
  else el.innerHTML = `🟡 Offline Mode`;
}

function initItemState(item) {
  if (!appState[item.id]) {
    appState[item.id] = { 
      status: 'Offen', assignedTo: '', packed: false, boxNum: '', 
      qty: item.defaultQty || '', stockQty: item.defaultStockQty || '',
      packageSize: item.defaultPackageSize || '', store: '', price: ''
    };
  }
}

async function saveState() {
  appState.customItemsList = itemsData;
  appState.roleConfig = roleConfig;
  appState.activityLog = activityLog;
  localStorage.setItem('sg_wm_state_v26', JSON.stringify(appState));
  
  updateProgress();
  renderBoxOverview();

  if (SCRIPT_URL) {
    try {
      await fetch(SCRIPT_URL, {
        method: "POST",
        headers: { "Content-Type": "text/plain;charset=utf-8" },
        body: JSON.stringify(appState)
      });
      setSyncStatus(true);
    } catch (err) { 
      setSyncStatus(false); 
    }
  }
}

/* ==========================================================================
   NAVIGATION & VIEW SWITCHING (Robust für alle Menüpunkte)
   ========================================================================== */

function toggleNavMenu() {
  document.getElementById('navDropdown')?.classList.toggle('hidden');
}

function switchView(viewName) {
  const viewMap = {
    'main': 'main',
    'inventar': 'main',
    'checklist': 'main',
    'boxes': 'boxes',
    'lagerbestand': 'boxes',
    'recipes': 'recipes',
    'rezepte': 'recipes',
    'power': 'power',
    'strom': 'power',
    'sales': 'sales',
    'kasse': 'sales',
    'verkauf': 'sales',
    'admin': 'admin'
  };

  const targetView = viewMap[viewName?.toLowerCase()] || 'main';

  if (targetView === 'admin' && currentRole !== 'admin') {
    const pwdPrompt = prompt("Admin-Passwort für Control Center erforderlich:");
    if (pwdPrompt === roleConfig.admin.pwd) {
      currentRole = 'admin';
      applyRolePermissions();
      logActivity("Admin-Bereich betreten");
    } else {
      if (pwdPrompt !== null) alert("Falsches Admin-Passwort!");
      return;
    }
  }

  currentView = targetView;
  document.getElementById('navDropdown')?.classList.add('hidden');

  // Alle Views ausblenden
  ['viewChecklist', 'viewBoxes', 'viewRecipes', 'viewPower', 'viewSales', 'viewAdmin'].forEach(id => {
    document.getElementById(id)?.classList.add('hidden');
  });

  // Ziel-View einblenden
  if (targetView === 'main') document.getElementById('viewChecklist')?.classList.remove('hidden');
  if (targetView === 'boxes') document.getElementById('viewBoxes')?.classList.remove('hidden');
  if (targetView === 'recipes') document.getElementById('viewRecipes')?.classList.remove('hidden');
  if (targetView === 'power') document.getElementById('viewPower')?.classList.remove('hidden');
  if (targetView === 'sales') document.getElementById('viewSales')?.classList.remove('hidden');
  if (targetView === 'admin') document.getElementById('viewAdmin')?.classList.remove('hidden');

  // Titel im Header aktualisieren
  const titleEl = document.getElementById('currentViewTitle');
  if (titleEl) {
    const titles = {
      main: '📋 Hauptliste & Inventar',
      boxes: '🏷️ Lagerbestand & Boxen',
      recipes: '☕ Rezepte & Zutaten',
      power: '⚡ Stromverbrauch-Rechner',
      sales: '💰 Standkasse & Verkauf',
      admin: '👑 Admin Control Center'
    };
    titleEl.innerText = titles[targetView] || '📋 Hauptliste & Inventar';
  }

  if (targetView === 'main') renderChecklist();
  if (targetView === 'boxes') renderBoxOverview();
  if (targetView === 'admin') openRoleSettingsModal();
}

/* ==========================================================================
   BENUTZERROLLEN & RECHTEVERWALTUNG
   ========================================================================== */

function toggleRoleModal() { document.getElementById('roleModal')?.classList.remove('hidden'); }
function closeRoleModal() { document.getElementById('roleModal')?.classList.add('hidden'); }

function selectRoleWithPassword(role) {
  if (role === 'betrachter') {
    currentRole = 'betrachter';
    closeRoleModal();
    applyRolePermissions();
    logActivity("Rolle gewechselt zu: BETRACHTER");
    return;
  }

  const pwdPrompt = prompt(`Passwort für Rolle "${role.toUpperCase()}" eingeben:`);
  if (pwdPrompt === roleConfig[role]?.pwd) {
    currentRole = role;
    closeRoleModal();
    applyRolePermissions();
    logActivity(`Rolle gewechselt zu: ${role.toUpperCase()}`);
  } else if (pwdPrompt !== null) {
    alert("Falsches Passwort!");
  }
}

function applyRolePermissions() {
  const badge = document.getElementById('roleBadge');
  const isAdmin = currentRole === 'admin';

  if (badge) {
    if (isAdmin) {
      badge.className = 'px-3 py-1.5 rounded-xl text-xs font-bold bg-amber-400 text-slate-950 shadow-sm';
      badge.innerHTML = '🔓 Rolle: ADMIN';
    } else if (currentRole === 'orga') {
      badge.className = 'px-3 py-1.5 rounded-xl text-xs font-bold bg-sky-500/30 text-sky-100 border border-sky-300/40 shadow-sm';
      badge.innerHTML = '📋 Rolle: ORGA';
    } else if (currentRole === 'helfer') {
      badge.className = 'px-3 py-1.5 rounded-xl text-xs font-bold bg-emerald-500/30 text-emerald-100 border border-emerald-300/40 shadow-sm';
      badge.innerHTML = '🤝 Rolle: HELFER';
    } else {
      badge.className = 'px-3 py-1.5 rounded-xl text-xs font-bold bg-white/10 text-emerald-100 border border-white/20 shadow-sm';
      badge.innerHTML = '👁️ Rolle: BETRACHTER';
    }
  }

  const perms = roleConfig[currentRole] || {};
  const cashBtns = document.querySelectorAll('.cash-btn');
  cashBtns.forEach(btn => btn.disabled = !perms.canCash && !isAdmin);

  renderChecklist();
}

function openRoleSettingsModal() {
  ['helfer', 'orga', 'admin'].forEach(r => {
    const pEl = document.getElementById(`pwd_${r}`);
    if (pEl && roleConfig[r]) pEl.value = roleConfig[r].pwd || '';
    
    if (r !== 'admin' && roleConfig[r]) {
      ['cash', 'packed', 'qty', 'stock', 'box', 'status', 'prices', 'log'].forEach(p => {
        const checkEl = document.getElementById(`perm_${r}_${p}`);
        if (checkEl) checkEl.checked = !!roleConfig[r][`can${p.charAt(0).toUpperCase() + p.slice(1)}`];
      });
    }
  });
}

function saveRoleSettings() {
  ['helfer', 'orga', 'admin'].forEach(r => {
    const pEl = document.getElementById(`pwd_${r}`);
    if (pEl && roleConfig[r]) roleConfig[r].pwd = pEl.value.trim() || roleConfig[r].pwd;
    
    if (r !== 'admin' && roleConfig[r]) {
      ['cash', 'packed', 'qty', 'stock', 'box', 'status', 'prices', 'log'].forEach(p => {
        const checkEl = document.getElementById(`perm_${r}_${p}`);
        if (checkEl) roleConfig[r][`can${p.charAt(0).toUpperCase() + p.slice(1)}`] = checkEl.checked;
      });
    }
  });

  saveState();
  applyRolePermissions();
  alert("Berechtigungen & Passwörter erfolgreich gespeichert!");
}

/* ==========================================================================
   INVENTAR & CHECKLISTE (GEFIXTE DUNKLE TABELLEN-KONTRASTE)
   ========================================================================== */

function filterCategory(cat) {
  currentFilter = cat;
  renderChecklist();
}

function renderChecklist() {
  const searchVal = (document.getElementById('searchInput')?.value || '').toLowerCase();
  const container = document.getElementById('checklist');
  if (!container) return;
  container.innerHTML = '';

  const isAdmin = currentRole === 'admin';
  const perms = roleConfig[currentRole] || {};
  const categories = [...new Set(itemsData.map(item => item.cat))];

  categories.forEach(cat => {
    const catItems = itemsData.filter(item => {
      initItemState(item);
      const state = appState[item.id];
      const matchesSearch = item.title.toLowerCase().includes(searchVal) || (item.details && item.details.toLowerCase().includes(searchVal));
      const matchesFilter = currentFilter === 'all' || state.status === currentFilter;
      return item.cat === cat && matchesSearch && matchesFilter;
    });

    if (catItems.length > 0) {
      const catWrapper = document.createElement('div');
      catWrapper.className = 'bg-white border border-slate-200/80 rounded-3xl p-4 sm:p-6 shadow-sm mb-6';
      
      const isOrga = (cat === '🏛️ Orga'), isIngredientCat = (cat === '🍎 Zutaten (Waffeln & Punsch)');

      let rowsHtml = catItems.map(item => {
        const state = appState[item.id];
        const isDone = state.status === 'Erledigt' || state.status === 'Eingekauft';
        
        const disQty = (!perms.canQty && !isAdmin) ? 'disabled' : '';
        const disStock = (!perms.canStock && !isAdmin) ? 'disabled' : '';
        const disStatus = (!perms.canStatus && !isAdmin) ? 'disabled' : '';
        const disPacked = (!perms.canPacked && !isAdmin) ? 'disabled' : '';
        const disBox = (!perms.canBox && !isAdmin) ? 'disabled' : '';

        const statusOpts = item.isShop ? ['Offen', 'Vorbereitet', 'Verteilt', 'Eingekauft'] : ['Offen', 'Vorbereitet', 'Verteilt', 'Erledigt'];

        return `
          <tr class="hover:bg-slate-50 transition ${isDone ? 'opacity-75 bg-emerald-50/20' : ''}">
            <td class="py-3 px-3">
              <div class="font-semibold ${isDone ? 'line-through text-slate-400' : 'text-slate-900'}">${item.title}</div>
              ${item.details ? `<div class="text-xs text-slate-500">${item.details}</div>` : ''}
            </td>
            ${!isOrga ? `
              <td class="py-3 px-2">
                <input type="text" value="${state.qty || ''}" placeholder="-" ${disQty} onchange="updateItem(${item.id}, 'qty', this.value)" class="bg-white border border-slate-300 rounded-lg px-2 py-1 text-xs w-20 text-slate-900 font-medium" />
              </td>
              ${!isIngredientCat ? `
                <td class="py-3 px-2">
                  <input type="text" value="${state.stockQty || ''}" placeholder="0" ${disStock} onchange="updateItem(${item.id}, 'stockQty', this.value)" class="bg-amber-50/80 border border-amber-300 rounded-lg px-2 py-1 text-xs w-16 text-slate-900 font-medium" />
                </td>
              ` : ''}
            ` : ''}
            <td class="py-3 px-2">
              <select onchange="updateItem(${item.id}, 'status', this.value)" ${disStatus} class="border rounded-lg px-2 py-1 text-xs font-semibold w-full ${getStatusClass(state.status)}">
                ${statusOpts.map(o => `<option value="${o}" ${state.status === o ? 'selected' : ''}>${o}</option>`).join('')}
              </select>
            </td>
            <td class="py-3 px-2">
              <input type="text" placeholder="Name..." value="${state.assignedTo || ''}" ${disStatus} onchange="updateItem(${item.id}, 'assignedTo', this.value)" class="bg-white border border-slate-300 rounded-lg px-2.5 py-1 text-xs w-full text-slate-900" />
            </td>
            ${!isOrga ? `
              <td class="py-3 px-2 text-center align-middle">
                <input type="checkbox" ${state.packed ? 'checked' : ''} ${disPacked} onchange="updateItem(${item.id}, 'packed', this.checked)" class="w-5 h-5 accent-emerald-600 rounded cursor-pointer mx-auto block" />
              </td>
              <td class="py-3 px-2 text-center">
                <input type="number" min="1" max="12" value="${state.boxNum || ''}" ${disBox} onchange="updateItem(${item.id}, 'boxNum', this.value)" class="bg-white border border-slate-300 rounded-lg px-1 py-1 text-xs text-center w-12 mx-auto text-slate-900 font-medium" />
              </td>
            ` : ''}
          </tr>
        `;
      }).join('');

      catWrapper.innerHTML = `
        <h2 class="text-base font-bold text-slate-900 mb-3 flex items-center justify-between border-b border-slate-100 pb-2">
          <span>${cat}</span>
        </h2>
        <div class="overflow-x-auto">
          <table class="w-full text-left text-xs sm:text-sm border-collapse min-w-[650px]">
            <thead>
              <tr class="border-b border-slate-200 text-slate-900 font-extrabold text-xs uppercase bg-slate-100">
                <th class="py-3 px-3 text-slate-900 font-extrabold">${isOrga ? 'Aufgabe / Details' : 'Gegenstand'}</th>
                ${!isOrga ? '<th class="py-3 px-2 w-[12%] text-slate-900 font-extrabold">Benötigt</th>' : ''}
                ${!isOrga && !isIngredientCat ? '<th class="py-3 px-2 w-[10%] text-amber-900 font-extrabold">Auf Lager</th>' : ''}
                <th class="py-3 px-2 w-[18%] text-slate-900 font-extrabold">Status</th>
                <th class="py-3 px-2 w-[18%] text-slate-900 font-extrabold">${isOrga ? 'Ansprechpartner' : 'Verantwortlich'}</th>
                ${!isOrga ? '<th class="py-3 px-2 w-[8%] text-center text-slate-900 font-extrabold">Gepackt</th>' : ''}
                ${!isOrga ? '<th class="py-3 px-2 w-[8%] text-center text-slate-900 font-extrabold">Box</th>' : ''}
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-100">${rowsHtml}</tbody>
          </table>
        </div>
      `;
      container.appendChild(catWrapper);
    }
  });
}

function updateItem(id, field, value) {
  if (!appState[id]) appState[id] = {};
  appState[id][field] = value;
  saveState(); 
  renderChecklist();
}

function updateProgress() {
  const total = itemsData.length;
  const count = itemsData.filter(i => appState[i.id] && (appState[i.id].status === 'Erledigt' || appState[i.id].status === 'Eingekauft')).length;
  const percent = total > 0 ? Math.round((count / total) * 100) : 0;
  if (document.getElementById('progressBar')) document.getElementById('progressBar').style.width = percent + '%';
  if (document.getElementById('progressText')) document.getElementById('progressText').innerText = percent + '% erledigt (' + count + '/' + total + ')';
}

function getStatusClass(s) {
  if (s === 'Vorbereitet') return 'bg-amber-100 text-amber-900 border-amber-300 font-semibold';
  if (s === 'Verteilt') return 'bg-sky-100 text-sky-900 border-sky-300 font-semibold';
  if (s === 'Erledigt' || s === 'Eingekauft') return 'bg-emerald-100 text-emerald-900 border-emerald-300 font-semibold';
  return 'bg-slate-100 text-slate-800 border-slate-300 font-semibold';
}

/* ==========================================================================
   BOXEN & LAGER-ÜBERSICHT
   ========================================================================== */

function renderBoxOverview() {
  const container = document.getElementById('boxOverviewGrid');
  if (!container) return;

  container.innerHTML = '';
  const boxes = {};

  itemsData.forEach(item => {
    const st = appState[item.id];
    if (st && st.boxNum) {
      if (!boxes[st.boxNum]) boxes[st.boxNum] = [];
      boxes[st.boxNum].push(item.title);
    }
  });

  const sortedBoxKeys = Object.keys(boxes).sort((a, b) => parseInt(a) - parseInt(b));

  if (sortedBoxKeys.length === 0) {
    container.innerHTML = `<div class="text-slate-400 italic text-sm text-center col-span-full py-4">Bisher wurden keinen Gegenständen Boxen zugewiesen.</div>`;
    return;
  }

  sortedBoxKeys.forEach(boxNum => {
    const boxCard = document.createElement('div');
    boxCard.className = 'bg-white border border-slate-200 p-4 rounded-2xl shadow-sm space-y-2';
    boxCard.innerHTML = `
      <div class="font-bold text-amber-600 text-sm flex items-center justify-between border-b border-slate-100 pb-2">
        <span>📦 Box / Lagerort #${boxNum}</span>
        <span class="bg-amber-50 text-amber-800 border border-amber-200 px-2 py-0.5 rounded-full text-xs font-semibold">${boxes[boxNum].length} Artikel</span>
      </div>
      <ul class="text-xs text-slate-700 space-y-1 list-disc pl-4">
        ${boxes[boxNum].map(title => `<li>${title}</li>`).join('')}
      </ul>
    `;
    container.appendChild(boxCard);
  });
}

/* ==========================================================================
   REZEPTE & STROMRECHNER
   ========================================================================== */

function updateRecipeScaling() {
  const punschLiters = parseFloat(document.getElementById('punschLiters')?.value || 8);
  if (document.getElementById('punschLitersLabel')) document.getElementById('punschLitersLabel').innerText = `${punschLiters} Liter`;
  const factor = punschLiters / 8.0;
  const list = document.getElementById('punschRecipeList');
  if (list) {
    list.innerHTML = `
      <li><b>${(2.0 * factor).toFixed(1).replace('.0','')} l</b> Wasser</li>
      <li><b>${Math.ceil(10 * factor)} Btl.</b> Wintertee</li>
      <li><b>${(1.0 * factor).toFixed(1).replace('.0','')} l</b> Orangensaft</li>
      <li><b>${(2.5 * factor).toFixed(1).replace('.0','')} l</b> Apfelsaft</li>
      <li><b>${(2.5 * factor).toFixed(1).replace('.0','')} l</b> Roter Traubensaft</li>
      <li><b>${Math.ceil(2 * factor)} Stk.</b> Zimtstangen</li>
      <li><b>${Math.ceil(5 * factor)} Btl.</b> Glühfix</li>
    `;
  }
}

function calculatePowerLoad() {
  const waffel = parseInt(document.getElementById('pwrWaffel')?.value || 0) * 1200;
  const punsch = parseInt(document.getElementById('pwrPunsch')?.value || 0) * 1800;
  const wasser = parseInt(document.getElementById('pwrWasser')?.value || 0) * 2200;

  const total = waffel + punsch + wasser;
  const totalEl = document.getElementById('totalWatts');
  if (totalEl) totalEl.textContent = `${total} Watt`;
}

/* ==========================================================================
   KASSE & VERKAUFSSTATISTIKEN
   ========================================================================== */

function addSale(type, amount) {
  const perms = roleConfig[currentRole] || {};
  if (!perms.canCash && currentRole !== 'admin') {
    alert("Keine Berechtigung für die Standkasse.");
    return;
  }
  
  const el = document.getElementById(type === 'punsch' ? 'soldPunsch' : 'soldWaffles');
  if (!el) return;
  
  let currentVal = parseInt(el.value || 0);
  currentVal += amount;
  if (currentVal < 0) currentVal = 0;
  
  el.value = currentVal;
  calculateSalesStats();
  logActivity(`Kasse: ${amount > 0 ? '+' : ''}${amount} ${type.toUpperCase()}`);
}

function calculateSalesStats() {
  const sPunsch = parseInt(document.getElementById('soldPunsch')?.value || 0);
  const pPunsch = 2.00;
  const sWaffles = parseInt(document.getElementById('soldWaffles')?.value || 0);
  const pWaffles = 2.00;
  const fee = parseFloat(document.getElementById('standFee')?.value || 0.00);
  const otherRev = parseFloat(document.getElementById('otherRevenue')?.value || 0.00);

  let shoppingCost = 0;
  itemsData.filter(i => i.isShop).forEach(item => {
    const state = appState[item.id];
    if (state) {
      const needNum = parseVal(state.qty), packNum = parseVal(state.packageSize);
      let calcPackages = (needNum > 0 && packNum > 0) ? Math.ceil(needNum / packNum) : Math.ceil(needNum || 1);
      shoppingCost += calcPackages * parseVal(state.price);
    }
  });

  const revenue = (sPunsch * pPunsch) + (sWaffles * pWaffles) + otherRev;
  const totalExpenses = shoppingCost + fee;

  if (document.getElementById('statRevenue')) document.getElementById('statRevenue').innerText = revenue.toFixed(2).replace('.', ',') + ' €';
  if (document.getElementById('statExpenses')) document.getElementById('statExpenses').innerText = totalExpenses.toFixed(2).replace('.', ',') + ' €';
  if (document.getElementById('statProfit')) document.getElementById('statProfit').innerText = (revenue - totalExpenses).toFixed(2).replace('.', ',') + ' €';

  appState.salesStats = { soldPunsch: sPunsch, pricePunsch: pPunsch, soldWaffles: sWaffles, priceWaffles: pWaffles, standFee: fee, otherRevenue: otherRev };
  saveState();
}

function parseVal(valStr) {
  if (!valStr) return 0;
  const match = valStr.toString().replace(',', '.').match(/([0-9.]+)/);
  return match ? parseFloat(match[1]) : 0;
}

/* ==========================================================================
   LOG-SYSTEM
   ========================================================================== */

function logActivity(text) {
  const perms = roleConfig[currentRole] || {};
  if (!perms.canLog && currentRole !== 'admin') return;

  const time = new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
  activityLog.unshift(`[${time}] [${currentRole.toUpperCase()}] ${text}`);
  if (activityLog.length > 20) activityLog.pop();
  renderActivityLog();
}

function renderActivityLog() {
  const list = document.getElementById('activityLogList');
  if (!list) return;
  list.innerHTML = activityLog.length === 0 
    ? `<li class="italic text-slate-400">Keine Aktivitäten aufgezeichnet.</li>`
    : activityLog.map(log => `<li class="border-b border-slate-700/50 pb-1 font-mono">${log}</li>`).join('');
}
