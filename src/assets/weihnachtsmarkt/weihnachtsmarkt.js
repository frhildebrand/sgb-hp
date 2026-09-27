const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbzm4pz4LD6vwqwkDQXqIypYRVx9m49oliAevZPGolZYm_JKFmWN526TLE-2Z3fGP8tJ/exec";
const storeOptions = ["Aldi", "E-Center", "Famila", "Kaufland", "Kruber", "Lidl", "Netto", "Online", "Penny", "Rewe"];

let itemsData = [];
let appState = {};
let currentFilter = 'all';
let currentRole = 'betrachter'; 
let adminPassword = "SGJugend26";
let editingItemId = null;
let activityLog = [];

async function initApp() {
  // 1. Lade Gegenstände aus dem Unterordner
  try {
    const res = await fetch('/assets/weihnachtsmarkt/weihnachtsmarkt-data.json');
    itemsData = await res.json();
  } catch (e) {
    console.error("Fehler beim Laden von weihnachtsmarkt-data.json", e);
  }

  // 2. Lokale Daten laden & Sofort darstellen
  loadFromLocal();
  itemsData.forEach(item => initItemState(item));
  
  renderChecklist();
  updateProgress();
  updateRecipeScaling();
  calculateSalesStats();
  applyRolePermissions();
  renderActivityLog();

  // 3. Online-Sync im Hintergrund
  loadStateFromSheet();

  document.getElementById('searchInput')?.addEventListener('input', renderChecklist);
}

function loadFromLocal() {
  const local = JSON.parse(localStorage.getItem('sg_wm_state_v22')) || {};
  appState = local;
  if (appState.customItemsList) itemsData = appState.customItemsList;
  if (appState.adminPassword) adminPassword = appState.adminPassword;
  if (appState.globalNotice) showNoticeBanner(appState.globalNotice);
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
      if (appState.customItemsList && Array.isArray(appState.customItemsList)) itemsData = appState.customItemsList;
      if (appState.adminPassword) adminPassword = appState.adminPassword;
      if (appState.globalNotice) showNoticeBanner(appState.globalNotice);
      if (appState.activityLog) activityLog = appState.activityLog;
      
      localStorage.setItem('sg_wm_state_v22', JSON.stringify(appState));
      setSyncStatus(true);
      
      itemsData.forEach(item => initItemState(item));
      renderChecklist();
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
  appState.adminPassword = adminPassword;
  appState.activityLog = activityLog;
  localStorage.setItem('sg_wm_state_v22', JSON.stringify(appState));
  updateProgress();

  if (SCRIPT_URL) {
    try {
      await fetch(SCRIPT_URL, {
        method: "POST",
        headers: { "Content-Type": "text/plain;charset=utf-8" },
        body: JSON.stringify(appState)
      });
      setSyncStatus(true);
    } catch (err) { setSyncStatus(false); }
  }
}

function logActivity(text) {
  const time = new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
  activityLog.unshift(`[${time}] [${currentRole.toUpperCase()}] ${text}`);
  if (activityLog.length > 15) activityLog.pop();
  renderActivityLog();
}

function renderActivityLog() {
  const list = document.getElementById('activityLogList');
  if (!list) return;
  list.innerHTML = activityLog.length === 0 
    ? `<li class="italic text-slate-400">Keine Aktivitäten.</li>`
    : activityLog.map(log => `<li class="border-b border-amber-200/40 pb-0.5">${log}</li>`).join('');
}

function clearActivityLog() { activityLog = []; saveState(); renderActivityLog(); }

function showNoticeBanner(text) {
  const banner = document.getElementById('noticeBanner');
  const txt = document.getElementById('noticeBannerText');
  if (banner && txt && text) { txt.innerText = text; banner.classList.remove('hidden'); }
}

function dismissNotice() { document.getElementById('noticeBanner')?.classList.add('hidden'); }

function setGlobalNotice() {
  const msg = prompt("Wichtige Durchsage eingeben:", appState.globalNotice || "");
  if (msg !== null) {
    appState.globalNotice = msg.trim();
    saveState();
    if (appState.globalNotice) { showNoticeBanner(appState.globalNotice); logActivity(`Notice: "${appState.globalNotice}"`); } 
    else dismissNotice();
  }
}

function toggleRoleModal() { document.getElementById('roleModal')?.classList.remove('hidden'); }
function closeRoleModal() { document.getElementById('roleModal')?.classList.add('hidden'); }

function selectRole(role) {
  currentRole = role;
  closeRoleModal();
  applyRolePermissions();
  logActivity(`Rolle gewechselt: ${role}`);
}

function promptAdminLogin() {
  const pwd = prompt("Admin-Passwort:");
  if (pwd === adminPassword) {
    currentRole = 'admin'; closeRoleModal(); applyRolePermissions(); logActivity("Admin eingeloggt");
  } else if (pwd !== null) alert("Falsches Passwort!");
}

function applyRolePermissions() {
  const badge = document.getElementById('roleBadge');
  const adminPanel = document.getElementById('adminPanel');
  const isBetrachter = currentRole === 'betrachter';
  const isHelfer = currentRole === 'helfer';
  const isOrga = currentRole === 'orga';
  const isAdmin = currentRole === 'admin';

  if (badge) {
    if (isAdmin) badge.className = 'px-3 py-1.5 rounded-xl text-xs font-bold bg-amber-400 text-slate-950 shadow-sm', badge.innerHTML = '🔓 Rolle: ADMIN';
    else if (isOrga) badge.className = 'px-3 py-1.5 rounded-xl text-xs font-bold bg-sky-500/30 text-sky-100 border border-sky-300/40 shadow-sm', badge.innerHTML = '📋 Rolle: ORGA-TEAM';
    else if (isHelfer) badge.className = 'px-3 py-1.5 rounded-xl text-xs font-bold bg-emerald-500/30 text-emerald-100 border border-emerald-300/40 shadow-sm', badge.innerHTML = '🤝 Rolle: HELFER';
    else badge.className = 'px-3 py-1.5 rounded-xl text-xs font-bold bg-white/10 text-emerald-100 border border-white/20 shadow-sm', badge.innerHTML = '👁️ Rolle: BETRACHTER (Nur Lesen)';
  }

  if (adminPanel) adminPanel.classList.toggle('hidden', !isAdmin);

  document.querySelectorAll('input, select').forEach(el => {
    if (el.id === 'searchInput' || el.id === 'adminToggleBtn' || el.id === 'punschLiters') return;
    if (isBetrachter) el.disabled = true;
    else if (isHelfer) el.disabled = !(el.classList.contains('role-helfer-field') || el.type === 'checkbox' || el.tagName === 'SELECT');
    else el.disabled = false;
  });

  renderChecklist();
}

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
      <li><b>${Math.ceil(2 * factor)} Stk.</b> Zimtstangen <i>(nicht kaufen)</i></li>
      <li><b>${Math.ceil(5 * factor)} Btl.</b> Glühfix</li>
    `;
  }
}

function syncIngredientsToShoppingList() {
  const factor = parseFloat(document.getElementById('punschLiters')?.value || 8) / 8.0;
  const updates = { 38: `${Math.ceil(10 * factor)} Btl.`, 39: `${Math.ceil(5 * factor)} Btl.`, 40: `${Math.ceil(2 * factor)} Stk`, 41: `${(1.0 * factor).toFixed(1)} l`, 42: `${(2.5 * factor).toFixed(1)} l`, 43: `${(2.5 * factor).toFixed(1)} l` };
  Object.keys(updates).forEach(id => { if (appState[id]) appState[id].qty = updates[id]; });
  saveState(); renderChecklist(); logActivity("Punsch-Zutaten synchronisiert"); alert("Zutaten übernommen!");
}

function calculateSalesStats() {
  const sPunsch = parseInt(document.getElementById('soldPunsch')?.value || 0);
  const pPunsch = parseFloat(document.getElementById('pricePunsch')?.value || 2.50);
  const sWaffles = parseInt(document.getElementById('soldWaffles')?.value || 0);
  const pWaffles = parseFloat(document.getElementById('priceWaffles')?.value || 2.00);
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

function getStatusClass(s) {
  if (s === 'Vorbereitet') return 'status-vorbereitet';
  if (s === 'Verteilt') return 'status-verteilt';
  if (s === 'Erledigt' || s === 'Eingekauft') return 'status-erledigt';
  return 'status-offen';
}

function renderChecklist() {
  const searchVal = (document.getElementById('searchInput')?.value || '').toLowerCase();
  const container = document.getElementById('checklist');
  if (!container) return;
  container.innerHTML = '';

  const isAdmin = currentRole === 'admin', isBetrachter = currentRole === 'betrachter';
  const categories = [...new Set(itemsData.map(item => item.cat))];

  categories.forEach(cat => {
    const catItems = itemsData.filter(item => {
      initItemState(item);
      const state = appState[item.id];
      const matchesSearch = item.title.toLowerCase().includes(searchVal) || (item.details && item.details.toLowerCase().includes(searchVal));
      const matchesFilter = currentFilter === 'all' || state.status === currentFilter;
      return item.cat === cat && matchesSearch && matchesFilter;
    });

    if (catItems.length > 0 || isAdmin) {
      const catWrapper = document.createElement('div');
      catWrapper.className = 'bg-white border border-slate-200/80 rounded-3xl p-4 sm:p-6 shadow-sm print:border-none print:shadow-none print:p-0 print:mb-6';
      
      const isOrga = (cat === '🏛️ Orga'), isIngredientCat = (cat === '🍎 Zutaten (Waffeln & Punsch)');

      let rowsHtml = catItems.map(item => {
        const state = appState[item.id];
        const isDone = state.status === 'Erledigt' || state.status === 'Eingekauft';
        const disabledAttr = isBetrachter ? 'disabled' : '';
        const statusOpts = item.isShop ? ['Offen', 'Vorbereitet', 'Verteilt', 'Eingekauft'] : ['Offen', 'Vorbereitet', 'Verteilt', 'Erledigt'];

        return `
          <tr class="hover:bg-slate-50 transition ${isDone ? 'opacity-70 bg-emerald-50/30' : ''}">
            <td class="py-3 px-3">
              <div class="font-semibold ${isDone ? 'line-through text-slate-400' : 'text-slate-900'}">${item.title}</div>
              ${item.details ? `<div class="text-xs text-slate-500">${item.details}</div>` : ''}
            </td>
            ${!isOrga ? `
              <td class="py-3 px-2">
                <input type="text" value="${state.qty || ''}" placeholder="-" ${disabledAttr} onchange="updateItem(${item.id}, 'qty', this.value)" class="role-orga-field bg-white border border-slate-300 rounded-lg px-2 py-1 text-xs w-20" />
              </td>
              ${!isIngredientCat ? `
                <td class="py-3 px-2">
                  <input type="text" value="${state.stockQty || ''}" placeholder="0" ${disabledAttr} onchange="updateItem(${item.id}, 'stockQty', this.value)" class="role-orga-field bg-amber-50/80 border border-amber-300 rounded-lg px-2 py-1 text-xs w-16" />
                </td>
              ` : ''}
            ` : ''}
            <td class="py-3 px-2">
              <select onchange="updateItem(${item.id}, 'status', this.value)" ${disabledAttr} class="border rounded-lg px-2 py-1 text-xs font-semibold w-full ${getStatusClass(state.status)}">
                ${statusOpts.map(o => `<option value="${o}" ${state.status === o ? 'selected' : ''}>${o}</option>`).join('')}
              </select>
            </td>
            <td class="py-3 px-2">
              <input type="text" placeholder="Name..." value="${state.assignedTo || ''}" ${disabledAttr} onchange="updateItem(${item.id}, 'assignedTo', this.value)" class="role-orga-field bg-white border border-slate-300 rounded-lg px-2.5 py-1 text-xs w-full" />
            </td>
            ${!isOrga ? `
              <td class="py-3 px-2 text-center align-middle">
                <input type="checkbox" ${state.packed ? 'checked' : ''} ${disabledAttr} onchange="updateItem(${item.id}, 'packed', this.checked)" class="role-helfer-field w-5 h-5 accent-emerald-600 rounded cursor-pointer mx-auto block" />
              </td>
              <td class="py-3 px-2 text-center">
                <input type="number" min="1" max="12" value="${state.boxNum || ''}" ${disabledAttr} onchange="updateItem(${item.id}, 'boxNum', this.value)" class="role-orga-field bg-white border border-slate-300 rounded-lg px-1 py-1 text-xs text-center w-12 mx-auto" />
              </td>
            ` : ''}
            ${isAdmin ? `
              <td class="py-3 px-2 text-center whitespace-nowrap print:hidden">
                <button onclick="openEditItemModal(${item.id})" class="text-slate-500 hover:text-emerald-700 font-bold px-1 text-sm">✏️</button>
                <button onclick="deleteItem(${item.id})" class="text-slate-500 hover:text-red-700 font-bold px-1 text-sm">🗑️</button>
              </td>
            ` : ''}
          </tr>
        `;
      }).join('');

      catWrapper.innerHTML = `
        <h2 class="text-lg font-bold text-emerald-950 mb-4 flex items-center justify-between border-b border-slate-100 pb-2">
          <span>${cat}</span>
          ${isAdmin ? `<div class="flex gap-2 print:hidden"><button onclick="renameCategory('${cat}')" class="text-xs px-2 py-1 bg-slate-100 rounded-lg">✏️ Umbenennen</button><button onclick="deleteCategory('${cat}')" class="text-xs px-2 py-1 bg-red-50 text-red-600 rounded-lg">🗑️ Löschen</button></div>` : ''}
        </h2>
        <div class="table-container">
          <table class="w-full text-left text-xs sm:text-sm text-slate-800 border-collapse min-w-[650px]">
            <thead>
              <tr class="border-b border-slate-200 text-slate-500 text-xs uppercase bg-slate-50/50">
                <th class="py-2.5 px-3">${isOrga ? 'Aufgabe / Details' : 'Gegenstand'}</th>
                ${!isOrga ? '<th class="py-2.5 px-2 w-[12%]">Benötigt</th>' : ''}
                ${!isOrga && !isIngredientCat ? '<th class="py-2.5 px-2 w-[10%] text-amber-900 font-bold">Auf Lager</th>' : ''}
                <th class="py-2.5 px-2 w-[16%]">Status</th>
                <th class="py-2.5 px-2 w-[16%]">${isOrga ? 'Ansprechpartner' : 'Verantwortlich'}</th>
                ${!isOrga ? '<th class="py-2.5 px-2 w-[7%] text-center">Gepackt?</th>' : ''}
                ${!isOrga ? '<th class="py-2.5 px-2 w-[8%] text-center">Box</th>' : ''}
                ${isAdmin ? '<th class="py-2.5 px-2 w-[8%] text-center print:hidden">Admin</th>' : ''}
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
  saveState(); renderChecklist();
}

function updateProgress() {
  const total = itemsData.length;
  const count = itemsData.filter(i => appState[i.id] && (appState[i.id].status === 'Erledigt' || appState[i.id].status === 'Eingekauft')).length;
  const percent = total > 0 ? Math.round((count / total) * 100) : 0;
  if (document.getElementById('progressBar')) document.getElementById('progressBar').style.width = percent + '%';
  if (document.getElementById('progressText')) document.getElementById('progressText').innerText = percent + '% erledigt (' + count + '/' + total + ')';
}

function setFilter(filter, btn) {
  currentFilter = filter;
  document.querySelectorAll('.filter-btn').forEach(b => b.className = 'filter-btn px-4 py-2 rounded-xl border border-slate-200 bg-white text-slate-700 font-medium text-xs sm:text-sm');
  btn.className = 'filter-btn active px-4 py-2 rounded-xl border border-emerald-600 bg-emerald-600 text-white font-bold text-xs sm:text-sm shadow-sm';
  renderChecklist();
}

// Start beim Laden
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initApp);
} else {
  initApp();
}
