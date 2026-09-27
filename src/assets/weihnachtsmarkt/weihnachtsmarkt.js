const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbzm4pz4LD6vwqwkDQXqIypYRVx9m49oliAevZPGolZYm_JKFmWN526TLE-2Z3fGP8tJ/exec";

// Passwörter & Detaillierte Rechte-Konfiguration
let roleConfig = {
  helfer: {
    pwd: "SGHelfer",
    canCash: true,
    canPacked: true,
    canQty: false,
    canStock: false,
    canBox: true,
    canStatus: false,
    canPrices: false,
    canLog: false
  },
  orga: {
    pwd: "SGOrga",
    canCash: true,
    canPacked: true,
    canQty: true,
    canStock: true,
    canBox: true,
    canStatus: true,
    canPrices: true,
    canLog: true
  },
  admin: {
    pwd: "SGJugend26"
    // Admin darf automatisch immer ALLES
  }
};

const DEFAULT_ITEMS = [
  {"id": 1, "cat": "🏛️ Orga", "title": "Anmeldung Teilnahme", "details": "An Gemeinde"},
  {"id": 2, "cat": "🏛️ Orga", "title": "Hütte Gemeinde", "details": "Aufbau Tag & Zeit abklären"},
  {"id": 3, "cat": "🏛️ Orga", "title": "Listen Roshop Unterstützung", "details": "Aufhängen Schwarzes Brett"},
  {"id": 4, "cat": "🏛️ Orga", "title": "Anzeige Gaststättengewerbe", "details": "Gemeinde / Amt"},
  {"id": 5, "cat": "🛠️ Werkzeuge", "title": "Hammer"},
  {"id": 6, "cat": "🛠️ Werkzeuge", "title": "Nagelzange"},
  {"id": 7, "cat": "🛠️ Werkzeuge", "title": "Schere"},
  {"id": 8, "cat": "🛠️ Werkzeuge", "title": "Schraubendreher"},
  {"id": 9, "cat": "🛠️ Werkzeuge", "title": "Seitenschneider"},
  {"id": 10, "cat": "🛠️ Werkzeuge", "title": "Taschenlampe"},
  {"id": 11, "cat": "📦 Material & Befestigung", "title": "Büroklammern"},
  {"id": 12, "cat": "📦 Material & Befestigung", "title": "Draht"},
  {"id": 13, "cat": "📦 Material & Befestigung", "title": "Heftzwecken"},
  {"id": 14, "cat": "📦 Material & Befestigung", "title": "Kabelbinder"},
  {"id": 15, "cat": "📦 Material & Befestigung", "title": "Kreppband"},
  {"id": 16, "cat": "📦 Material & Befestigung", "title": "Nägel"},
  {"id": 74, "cat": "📦 Material & Befestigung", "title": "Panzertape"},
  {"id": 17, "cat": "📦 Material & Befestigung", "title": "Schrauben"},
  {"id": 18, "cat": "⚡ Elektrik & Licht", "title": "Lichterketten Kurz", "defaultStockQty": "2", "defaultWatts": 10, "isPower": true},
  {"id": 19, "cat": "⚡ Elektrik & Licht", "title": "Lichterketten Lang", "defaultStockQty": "2", "defaultWatts": 20, "isPower": true},
  {"id": 20, "cat": "⚡ Elektrik & Licht", "title": "Lichterketten Sterne", "defaultStockQty": "2", "defaultWatts": 15, "isPower": true},
  {"id": 76, "cat": "⚡ Elektrik & Licht", "title": "Lichtschlauch", "defaultStockQty": "1", "defaultWatts": 25, "isPower": true},
  {"id": 21, "cat": "⚡ Elektrik & Licht", "title": "Mehrfachstecker 3er", "details": "3-fach Verteilungsstecker", "isPower": true, "defaultStockQty": "2", "defaultWatts": 3680, "isCable": true},
  {"id": 22, "cat": "⚡ Elektrik & Licht", "title": "Mehrfachstecker 5er", "details": "5-fach Verteilungsstecker", "isPower": true, "defaultStockQty": "2", "defaultWatts": 3680, "isCable": true},
  {"id": 23, "cat": "⚡ Elektrik & Licht", "title": "Verlängerungskabel 3m", "details": "Stromkabel Verlängerung", "isPower": true, "defaultStockQty": "2", "defaultWatts": 3680, "isCable": true},
  {"id": 24, "cat": "🔌 Geräte", "title": "Einkochautomat", "defaultQty": "2", "defaultStockQty": "2", "defaultWatts": 1800, "isPower": true},
  {"id": 25, "cat": "🔌 Geräte", "title": "Waffeleisen", "defaultQty": "3", "defaultStockQty": "3", "defaultWatts": 1200, "isPower": true},
  {"id": 26, "cat": "🔌 Geräte", "title": "Wasserkocher", "defaultQty": "1", "defaultWatts": 2200, "defaultStockQty": "1", "isPower": true},
  {"id": 27, "cat": "💶 Kasse & Finanzen", "title": "Geldtasche"},
  {"id": 28, "cat": "💶 Kasse & Finanzen", "title": "Kasse"},
  {"id": 29, "cat": "💶 Kasse & Finanzen", "title": "Preisschilder Punsch"},
  {"id": 30, "cat": "💶 Kasse & Finanzen", "title": "Preisschilder Waffeln"},
  {"id": 31, "cat": "💶 Kasse & Finanzen", "title": "Spendenente"},
  {"id": 32, "cat": "💶 Kasse & Finanzen", "title": "Wechselgeld"},
  {"id": 33, "cat": "✨ Standdeko", "title": "Bodenschutz/Malervlies"},
  {"id": 34, "cat": "✨ Standdeko", "title": "Keksteller"},
  {"id": 35, "cat": "✨ Standdeko", "title": "Kerzengläser"},
  {"id": 36, "cat": "✨ Standdeko", "title": "SG Banner"},
  {"id": 37, "cat": "✨ Standdeko", "title": "Tischdecken"},
  {"id": 38, "cat": "🍎 Zutaten (Waffeln & Punsch)", "title": "Wintertee", "details": "Verschiedene Sorten", "defaultQty": "10 Btl.", "defaultPackageSize": "20 Btl.", "isShop": true, "isIngredient": true},
  {"id": 39, "cat": "🍎 Zutaten (Waffeln & Punsch)", "title": "Glühfix", "defaultQty": "5 Btl.", "defaultPackageSize": "10 Btl.", "isShop": true, "isIngredient": true},
  {"id": 40, "cat": "🍎 Zutaten (Waffeln & Punsch)", "title": "Zimtstangen", "defaultQty": "2 Stk", "defaultPackageSize": "5 Stk", "isShop": true, "isIngredient": true},
  {"id": 41, "cat": "🍎 Zutaten (Waffeln & Punsch)", "title": "Orangensaft", "defaultQty": "1,0 l", "defaultPackageSize": "1 l", "isShop": true, "isIngredient": true},
  {"id": 42, "cat": "🍎 Zutaten (Waffeln & Punsch)", "title": "Apfelsaft", "defaultQty": "2,5 l", "defaultPackageSize": "1 l", "isShop": true, "isIngredient": true},
  {"id": 43, "cat": "🍎 Zutaten (Waffeln & Punsch)", "title": "Roter Traubensaft", "defaultQty": "2,5 l", "defaultPackageSize": "1 l", "isShop": true, "isIngredient": true},
  {"id": 45, "cat": "🍎 Zutaten (Waffeln & Punsch)", "title": "Öl (Waffeln)", "defaultPackageSize": "1 Flasche", "isShop": true, "isIngredient": true},
  {"id": 46, "cat": "🍎 Zutaten (Waffeln & Punsch)", "title": "Puderzucker", "defaultPackageSize": "250 g", "isShop": true, "isIngredient": true},
  {"id": 47, "cat": "🍎 Zutaten (Waffeln & Punsch)", "title": "Servietten", "defaultPackageSize": "100 Stk", "isShop": true, "isIngredient": true},
  {"id": 48, "cat": "🛒 Einkäufe & Verbrauchsmaterial", "title": "Geschirrhandtuch", "isShop": true},
  {"id": 49, "cat": "🛒 Einkäufe & Verbrauchsmaterial", "title": "Küchenrolle", "isShop": true},
  {"id": 50, "cat": "🛒 Einkäufe & Verbrauchsmaterial", "title": "Mülltüten", "isShop": true},
  {"id": 51, "cat": "🛒 Einkäufe & Verbrauchsmaterial", "title": "Spekulatius", "isShop": true},
  {"id": 52, "cat": "🛒 Einkäufe & Verbrauchsmaterial", "title": "Spülmittel", "isShop": true},
  {"id": 53, "cat": "🛒 Einkäufe & Verbrauchsmaterial", "title": "Teelichter", "isShop": true},
  {"id": 54, "cat": "🛒 Einkäufe & Verbrauchsmaterial", "title": "Waschlappen", "isShop": true},
  {"id": 55, "cat": "🥣 Stand-Equipment & Zubehör", "title": "Esslöffel"},
  {"id": 56, "cat": "🥣 Stand-Equipment & Zubehör", "title": "Holzgabeln"},
  {"id": 57, "cat": "🥣 Stand-Equipment & Zubehör", "title": "Ölpinsel inkl. Flasche"},
  {"id": 58, "cat": "🥣 Stand-Equipment & Zubehör", "title": "Sieb für Puderzucker"},
  {"id": 59, "cat": "🥣 Stand-Equipment & Zubehör", "title": "Spaghettikelle (Punschkelle)"},
  {"id": 60, "cat": "🥣 Stand-Equipment & Zubehör", "title": "Suppenkellen"},
  {"id": 75, "cat": "📋 Sonstiges", "title": "Musikbox / Bluetooth-Lautsprecher"},
  {"id": 61, "cat": "📋 Sonstiges", "title": "Eddings"},
  {"id": 63, "cat": "📋 Sonstiges", "title": "Erste Hilfe Set"},
  {"id": 64, "cat": "📋 Sonstiges", "title": "Feuerzeug"},
  {"id": 65, "cat": "📋 Sonstiges", "title": "Kehrblech & Handfeger"},
  {"id": 66, "cat": "📋 Sonstiges", "title": "Kugelschreiber"},
  {"id": 67, "cat": "📋 Sonstiges", "title": "Listen Roshop"},
  {"id": 68, "cat": "📋 Sonstiges", "title": "Rezeptzettel"},
  {"id": 69, "cat": "📋 Sonstiges", "title": "Schüssel Lappen Waschen"},
  {"id": 70, "cat": "📋 Sonstiges", "title": "Steckmülleimer"},
  {"id": 71, "cat": "📋 Sonstiges", "title": "Stehtische"},
  {"id": 72, "cat": "📋 Sonstiges", "title": "Taschenmesser"},
  {"id": 73, "cat": "📋 Sonstiges", "title": "Weihnachtsmützen"}
];

let itemsData = [];
let appState = {};
let currentFilter = 'all';
let currentRole = 'betrachter'; 
let currentView = 'main'; // 'main', 'recipes', 'sales', 'admin'
let activityLog = [];

async function initApp() {
  try {
    const res = await fetch('/assets/weihnachtsmarkt/weihnachtsmarkt-data.json');
    if (res.ok) itemsData = await res.json();
    else throw new Error();
  } catch (e) {
    try {
      const resAlt = await fetch('/assets/weihnachtsmarkt-data.json');
      if (resAlt.ok) itemsData = await resAlt.json();
      else itemsData = [...DEFAULT_ITEMS];
    } catch(err) {
      itemsData = [...DEFAULT_ITEMS];
    }
  }

  loadFromLocal();
  itemsData.forEach(item => initItemState(item));

  switchView('main');
  updateProgress();
  updateRecipeScaling();
  calculateSalesStats();
  applyRolePermissions();
  renderActivityLog();

  loadStateFromSheet();
  document.getElementById('searchInput')?.addEventListener('input', renderChecklist);
}

function loadFromLocal() {
  const local = JSON.parse(localStorage.getItem('sg_wm_state_v25')) || {};
  appState = local;
  if (appState.customItemsList && appState.customItemsList.length > 0) itemsData = appState.customItemsList;
  if (appState.roleConfig) roleConfig = appState.roleConfig;
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
      if (appState.customItemsList && appState.customItemsList.length > 0) itemsData = appState.customItemsList;
      if (appState.roleConfig) roleConfig = appState.roleConfig;
      if (appState.globalNotice) showNoticeBanner(appState.globalNotice);
      if (appState.activityLog) activityLog = appState.activityLog;
      
      localStorage.setItem('sg_wm_state_v25', JSON.stringify(appState));
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
  appState.roleConfig = roleConfig;
  appState.activityLog = activityLog;
  localStorage.setItem('sg_wm_state_v25', JSON.stringify(appState));
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

function toggleNavMenu() {
  document.getElementById('navDropdown')?.classList.toggle('hidden');
}

function switchView(viewName) {
  if (viewName === 'admin' && currentRole !== 'admin') {
    const pwdPrompt = prompt("Für das Admin Control Center ist das Admin-Passwort erforderlich:");
    if (pwdPrompt === roleConfig.admin.pwd) {
      currentRole = 'admin';
      applyRolePermissions();
    } else {
      if (pwdPrompt !== null) alert("Falsches Admin-Passwort!");
      return;
    }
  }

  currentView = viewName;
  document.getElementById('navDropdown')?.classList.add('hidden');

  // Bereiche schalten
  document.getElementById('viewChecklist')?.classList.toggle('hidden', viewName !== 'main');
  document.getElementById('viewRecipes')?.classList.toggle('hidden', viewName !== 'recipes');
  document.getElementById('viewSales')?.classList.toggle('hidden', viewName !== 'sales');
  document.getElementById('viewAdmin')?.classList.toggle('hidden', viewName !== 'admin');

  const titleEl = document.getElementById('currentViewTitle');
  if (titleEl) {
    if (viewName === 'main') titleEl.innerText = "📋 Hauptliste & Inventar";
    if (viewName === 'recipes') titleEl.innerText = "☕ Rezepte & Zutaten";
    if (viewName === 'sales') titleEl.innerText = "🏬 Standkasse & Verkauf";
    if (viewName === 'admin') titleEl.innerText = "👑 Admin Control Center";
  }

  if (viewName === 'main') renderChecklist();
  if (viewName === 'admin') openRoleSettingsModal();
}

function selectRoleWithPassword(role) {
  if (role === 'betrachter') {
    currentRole = 'betrachter';
    closeRoleModal();
    applyRolePermissions();
    logActivity("Rolle: Betrachter");
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
    if (isAdmin) badge.className = 'px-3 py-1.5 rounded-xl text-xs font-bold bg-amber-400 text-slate-950 shadow-sm', badge.innerHTML = '🔓 Rolle: ADMIN';
    else if (currentRole === 'orga') badge.className = 'px-3 py-1.5 rounded-xl text-xs font-bold bg-sky-500/30 text-sky-100 border border-sky-300/40 shadow-sm', badge.innerHTML = '📋 Rolle: ORGA';
    else if (currentRole === 'helfer') badge.className = 'px-3 py-1.5 rounded-xl text-xs font-bold bg-emerald-500/30 text-emerald-100 border border-emerald-300/40 shadow-sm', badge.innerHTML = '🤝 Rolle: HELFER';
    else badge.className = 'px-3 py-1.5 rounded-xl text-xs font-bold bg-white/10 text-emerald-100 border border-white/20 shadow-sm', badge.innerHTML = '👁️ Rolle: BETRACHTER';
  }

  const perms = roleConfig[currentRole] || {};
  const cashBtns = document.querySelectorAll('.cash-btn');
  cashBtns.forEach(btn => btn.disabled = !perms.canCash && !isAdmin);

  renderChecklist();
}

function openRoleSettingsModal() {
  ['helfer', 'orga', 'admin'].forEach(r => {
    const pEl = document.getElementById(`pwd_${r}`);
    if (pEl) pEl.value = roleConfig[r].pwd || '';
    
    if (r !== 'admin') {
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
    if (pEl) roleConfig[r].pwd = pEl.value.trim() || roleConfig[r].pwd;
    
    if (r !== 'admin') {
      ['cash', 'packed', 'qty', 'stock', 'box', 'status', 'prices', 'log'].forEach(p => {
        const checkEl = document.getElementById(`perm_${r}_${p}`);
        if (checkEl) roleConfig[r][`can${p.charAt(0).toUpperCase() + p.slice(1)}`] = checkEl.checked;
      });
    }
  });

  saveState();
  applyRolePermissions();
  alert("Rollen-Rechte & Passwörter erfolgreich im System gespeichert!");
}

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

    if (catItems.length > 0 || isAdmin) {
      const catWrapper = document.createElement('div');
      catWrapper.className = 'bg-white border border-slate-200/80 rounded-3xl p-4 sm:p-6 shadow-sm print:border-none print:shadow-none print:p-0 print:mb-6';
      
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
          <tr class="hover:bg-slate-50 transition ${isDone ? 'opacity-70 bg-emerald-50/30' : ''}">
            <td class="py-3 px-3">
              <div class="font-semibold ${isDone ? 'line-through text-slate-400' : 'text-slate-900'}">${item.title}</div>
              ${item.details ? `<div class="text-xs text-slate-500">${item.details}</div>` : ''}
            </td>
            ${!isOrga ? `
              <td class="py-3 px-2">
                <input type="text" value="${state.qty || ''}" placeholder="-" ${disQty} onchange="updateItem(${item.id}, 'qty', this.value)" class="bg-white border border-slate-300 rounded-lg px-2 py-1 text-xs w-20" />
              </td>
              ${!isIngredientCat ? `
                <td class="py-3 px-2">
                  <input type="text" value="${state.stockQty || ''}" placeholder="0" ${disStock} onchange="updateItem(${item.id}, 'stockQty', this.value)" class="bg-amber-50/80 border border-amber-300 rounded-lg px-2 py-1 text-xs w-16" />
                </td>
              ` : ''}
            ` : ''}
            <td class="py-3 px-2">
              <select onchange="updateItem(${item.id}, 'status', this.value)" ${disStatus} class="border rounded-lg px-2 py-1 text-xs font-semibold w-full ${getStatusClass(state.status)}">
                ${statusOpts.map(o => `<option value="${o}" ${state.status === o ? 'selected' : ''}>${o}</option>`).join('')}
              </select>
            </td>
            <td class="py-3 px-2">
              <input type="text" placeholder="Name..." value="${state.assignedTo || ''}" ${disStatus} onchange="updateItem(${item.id}, 'assignedTo', this.value)" class="bg-white border border-slate-300 rounded-lg px-2.5 py-1 text-xs w-full" />
            </td>
            ${!isOrga ? `
              <td class="py-3 px-2 text-center align-middle">
                <input type="checkbox" ${state.packed ? 'checked' : ''} ${disPacked} onchange="updateItem(${item.id}, 'packed', this.checked)" class="w-5 h-5 accent-emerald-600 rounded cursor-pointer mx-auto block" />
              </td>
              <td class="py-3 px-2 text-center">
                <input type="number" min="1" max="12" value="${state.boxNum || ''}" ${disBox} onchange="updateItem(${item.id}, 'boxNum', this.value)" class="bg-white border border-slate-300 rounded-lg px-1 py-1 text-xs text-center w-12 mx-auto" />
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

function toggleRoleModal() { document.getElementById('roleModal')?.classList.remove('hidden'); }
function closeRoleModal() { document.getElementById('roleModal')?.classList.add('hidden'); }

// Init beim Start
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initApp);
} else {
  initApp();
}
