const storeOptions = ["Aldi", "E-Center", "Famila", "Kaufland", "Kruber", "Lidl", "Netto", "Online", "Penny", "Rewe"];

let itemsData = [
  // Orga
  { id: 1, cat: "🏛️ Orga", title: "Anmeldung Teilnahme", details: "An Gemeinde", isShop: false },
  { id: 2, cat: "🏛️ Orga", title: "Hütte Gemeinde", details: "Aufbau Tag & Zeit abklären", isShop: false },
  { id: 3, cat: "🏛️ Orga", title: "Listen Roshop Unterstützung", details: "Aufhängen Schwarzes Brett", isShop: false },
  { id: 4, cat: "🏛️ Orga", title: "Anzeige Gaststättengewerbe", details: "Gemeinde / Amt", isShop: false },
  
  // Werkzeuge
  { id: 5, cat: "🛠️ Werkzeuge", title: "Hammer", details: "", isShop: false },
  { id: 6, cat: "🛠️ Werkzeuge", title: "Nagelzange", details: "", isShop: false },
  { id: 7, cat: "🛠️ Werkzeuge", title: "Schere", details: "", isShop: false },
  { id: 8, cat: "🛠️ Werkzeuge", title: "Schraubendreher", details: "", isShop: false },
  { id: 9, cat: "🛠️ Werkzeuge", title: "Seitenschneider", details: "", isShop: false },
  { id: 10, cat: "🛠️ Werkzeuge", title: "Taschenlampe", details: "", isShop: false },
  
  // Material
  { id: 11, cat: "📦 Material & Befestigung", title: "Büroklammern", details: "", isShop: false },
  { id: 12, cat: "📦 Material & Befestigung", title: "Draht", details: "", isShop: false },
  { id: 13, cat: "📦 Material & Befestigung", title: "Heftzwecken", details: "", isShop: false },
  { id: 14, cat: "📦 Material & Befestigung", title: "Kabelbinder", details: "", isShop: false },
  { id: 15, cat: "📦 Material & Befestigung", title: "Kreppband", details: "", isShop: false },
  { id: 16, cat: "📦 Material & Befestigung", title: "Nägel", details: "", isShop: false },
  { id: 74, cat: "📦 Material & Befestigung", title: "Panzertape", details: "", isShop: false },
  { id: 17, cat: "📦 Material & Befestigung", title: "Schrauben", details: "", isShop: false },
  
  // Elektrik
  { id: 18, cat: "⚡ Elektrik & Licht", title: "Lichterketten Kurz", details: "", defaultStockQty: "2", defaultWatts: 10, isPower: true, isShop: false },
  { id: 19, cat: "⚡ Elektrik & Licht", title: "Lichterketten Lang", details: "", defaultStockQty: "2", defaultWatts: 20, isPower: true, isShop: false },
  { id: 20, cat: "⚡ Elektrik & Licht", title: "Lichterketten Sterne", details: "", defaultStockQty: "2", defaultWatts: 15, isPower: true, isShop: false },
  { id: 76, cat: "⚡ Elektrik & Licht", title: "Lichtschlauch", details: "", defaultStockQty: "1", defaultWatts: 25, isPower: true, isShop: false },
  { id: 21, cat: "⚡ Elektrik & Licht", title: "Mehrfachstecker 3er", details: "3-fach Verteilungsstecker", isPower: true, defaultStockQty: "2", defaultWatts: 3680, isCable: true, isShop: false },
  { id: 22, cat: "⚡ Elektrik & Licht", title: "Mehrfachstecker 5er", details: "5-fach Verteilungsstecker", isPower: true, defaultStockQty: "2", defaultWatts: 3680, isCable: true, isShop: false },
  { id: 23, cat: "⚡ Elektrik & Licht", title: "Verlängerungskabel 3m", details: "Stromkabel Verlängerung", isPower: true, defaultStockQty: "2", defaultWatts: 3680, isCable: true, isShop: false },
  
  // Geräte
  { id: 24, cat: "🔌 Geräte", title: "Einkochautomat", details: "", defaultQty: "2", defaultStockQty: "2", defaultWatts: 1800, isPower: true, isShop: false },
  { id: 25, cat: "🔌 Geräte", title: "Waffeleisen", details: "", defaultQty: "3", defaultStockQty: "3", defaultWatts: 1200, isPower: true, isShop: false },
  { id: 26, cat: "🔌 Geräte", title: "Wasserkocher", details: "", defaultQty: "1", defaultWatts: 2200, defaultStockQty: "1", isPower: true, isShop: false },
  
  // Kasse
  { id: 27, cat: "💶 Kasse & Finanzen", title: "Geldtasche", details: "", isShop: false },
  { id: 28, cat: "💶 Kasse & Finanzen", title: "Kasse", details: "", isShop: false },
  { id: 29, cat: "💶 Kasse & Finanzen", title: "Preisschilder Punsch", details: "", isShop: false },
  { id: 30, cat: "💶 Kasse & Finanzen", title: "Preisschilder Waffeln", details: "", isShop: false },
  { id: 31, cat: "💶 Kasse & Finanzen", title: "Spendenente", details: "", isShop: false },
  { id: 32, cat: "💶 Kasse & Finanzen", title: "Wechselgeld", details: "", isShop: false },
  
  // Standdeko
  { id: 33, cat: "✨ Standdeko", title: "Bodenschutz/Malervlies", details: "", isShop: false },
  { id: 34, cat: "✨ Standdeko", title: "Keksteller", details: "", isShop: false },
  { id: 35, cat: "✨ Standdeko", title: "Kerzengläser", details: "", isShop: false },
  { id: 36, cat: "✨ Standdeko", title: "SG Banner", details: "", isShop: false },
  { id: 37, cat: "✨ Standdeko", title: "Tischdecken", details: "", defaultQty: "", isShop: false },
  
  // Zutaten
  { id: 38, cat: "🍎 Zutaten (Waffeln & Punsch)", title: "Wintertee", details: "Verschiedene Sorten", defaultQty: "10 Btl.", defaultPackageSize: "20 Btl.", isShop: true, isIngredient: true },
  { id: 39, cat: "🍎 Zutaten (Waffeln & Punsch)", title: "Glühfix", details: "", defaultQty: "5 Btl.", defaultPackageSize: "10 Btl.", isShop: true, isIngredient: true },
  { id: 40, cat: "🍎 Zutaten (Waffeln & Punsch)", title: "Zimtstangen", details: "", defaultQty: "2 Stk", defaultPackageSize: "5 Stk", isShop: true, isIngredient: true },
  { id: 41, cat: "🍎 Zutaten (Waffeln & Punsch)", title: "Orangensaft", details: "", defaultQty: "1,0 l", defaultPackageSize: "1 l", isShop: true, isIngredient: true },
  { id: 42, cat: "🍎 Zutaten (Waffeln & Punsch)", title: "Apfelsaft", details: "", defaultQty: "2,5 l", defaultPackageSize: "1 l", isShop: true, isIngredient: true },
  { id: 43, cat: "🍎 Zutaten (Waffeln & Punsch)", title: "Roter Traubensaft", details: "", defaultQty: "2,5 l", defaultPackageSize: "1 l", isShop: true, isIngredient: true },
  { id: 45, cat: "🍎 Zutaten (Waffeln & Punsch)", title: "Öl (Waffeln)", details: "", defaultPackageSize: "1 Flasche", isShop: true, isIngredient: true },
  { id: 46, cat: "🍎 Zutaten (Waffeln & Punsch)", title: "Puderzucker", details: "", defaultPackageSize: "250 g", isShop: true, isIngredient: true },
  { id: 47, cat: "🍎 Zutaten (Waffeln & Punsch)", title: "Servietten", details: "", defaultPackageSize: "100 Stk", isShop: true, isIngredient: true },
  
  // Einkäufe
  { id: 48, cat: "🛒 Einkäufe & Verbrauchsmaterial", title: "Geschirrhandtuch", details: "", isShop: true },
  { id: 49, cat: "🛒 Einkäufe & Verbrauchsmaterial", title: "Küchenrolle", details: "", isShop: true },
  { id: 50, cat: "🛒 Einkäufe & Verbrauchsmaterial", title: "Mülltüten", details: "", isShop: true },
  { id: 51, cat: "🛒 Einkäufe & Verbrauchsmaterial", title: "Spekulatius", details: "", isShop: true },
  { id: 52, cat: "🛒 Einkäufe & Verbrauchsmaterial", title: "Spülmittel", details: "", isShop: true },
  { id: 53, cat: "🛒 Einkäufe & Verbrauchsmaterial", title: "Teelichter", details: "", isShop: true },
  { id: 54, cat: "🛒 Einkäufe & Verbrauchsmaterial", title: "Waschlappen", details: "", isShop: true },
  
  // Equipment
  { id: 55, cat: "🥣 Stand-Equipment & Zubehör", title: "Esslöffel", details: "", isShop: false },
  { id: 56, cat: "🥣 Stand-Equipment & Zubehör", title: "Holzgabeln", details: "", isShop: false },
  { id: 57, cat: "🥣 Stand-Equipment & Zubehör", title: "Ölpinsel inkl. Flasche", details: "", isShop: false },
  { id: 58, cat: "🥣 Stand-Equipment & Zubehör", title: "Sieb für Puderzucker", details: "", isShop: false },
  { id: 59, cat: "🥣 Stand-Equipment & Zubehör", title: "Spaghettikelle (Punschkelle)", details: "", isShop: false },
  { id: 60, cat: "🥣 Stand-Equipment & Zubehör", title: "Suppenkellen", details: "", isShop: false },
  
  // Sonstiges
  { id: 75, cat: "📋 Sonstiges", title: "Musikbox / Bluetooth-Lautsprecher", details: "", isShop: false },
  { id: 61, cat: "📋 Sonstiges", title: "Eddings", details: "", isShop: false },
  { id: 63, cat: "📋 Sonstiges", title: "Erste Hilfe Set", details: "", isShop: false },
  { id: 64, cat: "📋 Sonstiges", title: "Feuerzeug", details: "", isShop: false },
  { id: 65, cat: "📋 Sonstiges", title: "Kehrblech & Handfeger", details: "", isShop: false },
  { id: 66, cat: "📋 Sonstiges", title: "Kugelschreiber", details: "", isShop: false },
  { id: 67, cat: "📋 Sonstiges", title: "Listen Roshop", details: "", isShop: false },
  { id: 68, cat: "📋 Sonstiges", title: "Rezeptzettel", details: "", isShop: false },
  { id: 69, cat: "📋 Sonstiges", title: "Schüssel Lappen Waschen", details: "", isShop: false },
  { id: 70, cat: "📋 Sonstiges", title: "Steckmülleimer", details: "", isShop: false },
  { id: 71, cat: "📋 Sonstiges", title: "Stehtische", details: "", isShop: false },
  { id: 72, cat: "📋 Sonstiges", title: "Taschenmesser", details: "", isShop: false },
  { id: 73, cat: "📋 Sonstiges", title: "Weihnachtsmützen", details: "", isShop: false }
];

const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbzm4pz4LD6vwqwkDQXqIypYRVx9m49oliAevZPGolZYm_JKFmWN526TLE-2Z3fGP8tJ/exec";
let appState = {};
let currentFilter = 'all';
let currentRole = 'betrachter'; 
let adminPassword = "SGJugend26";
let editingItemId = null;
let activityLog = [];

// Sofort-Initalisierung aus dem lokalen Speicher (Keine Ladeverzögerung mehr!)
function initApp() {
  loadFromLocal();
  itemsData.forEach(item => initItemState(item));
  
  // Rendere die Seite sofort!
  renderChecklist();
  updateProgress();
  updateRecipeScaling();
  calculateSalesStats();
  applyRolePermissions();
  renderActivityLog();

  // Erst im Hintergrund sanft mit Google Sheets abgleichen
  loadStateFromSheet();

  const searchInp = document.getElementById('searchInput');
  if (searchInp) searchInp.addEventListener('input', renderChecklist);
}

function loadFromLocal() {
  const local = JSON.parse(localStorage.getItem('sg_wm_state_v21')) || {};
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
    const timeoutId = setTimeout(() => controller.abort(), 4000); // Max 4 Sek. Warten

    const res = await fetch(SCRIPT_URL + '?t=' + new Date().getTime(), { signal: controller.signal });
    clearTimeout(timeoutId);
    
    const cloudData = await res.json();
    if (cloudData && Object.keys(cloudData).length > 0) {
      appState = cloudData;
      if (appState.customItemsList && Array.isArray(appState.customItemsList)) itemsData = appState.customItemsList;
      if (appState.adminPassword) adminPassword = appState.adminPassword;
      if (appState.globalNotice) showNoticeBanner(appState.globalNotice);
      if (appState.activityLog) activityLog = appState.activityLog;
      
      localStorage.setItem('sg_wm_state_v21', JSON.stringify(appState));
      setSyncStatus(true);
      
      // Re-Rendere nach erfolgreichem Online-Sync
      itemsData.forEach(item => initItemState(item));
      renderChecklist();
      updateProgress();
      calculateSalesStats();
    }
  } catch(e) {
    console.log("Offline / Fetch übersprungen - Lokale Daten aktiv.");
    setSyncStatus(false);
  }
}

function setSyncStatus(isOk, textOverride) {
  const el = document.getElementById('syncStatus');
  if (!el) return;
  if (textOverride) {
    el.innerHTML = textOverride;
  } else if (isOk) {
    const time = new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
    el.innerHTML = `🟢 Synced (${time})`;
  } else {
    el.innerHTML = `🟡 Offline Mode`;
  }
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

if (!appState.socketCables) appState.socketCables = { 1: "Direkt Mehrfachstecker 3er", 2: "Verlängerung 3m + Mehrfachstecker 3er", 3: "Verlängerung 3m + Mehrfachstecker 5er" };
if (!appState.socketCableMaxWatts) appState.socketCableMaxWatts = { 1: 3680, 2: 3680, 3: 3680 };
if (!appState.powerAssignments) appState.powerAssignments = {};
if (!appState.instanceWatts) appState.instanceWatts = {};
if (!appState.salesStats) appState.salesStats = { soldPunsch: 0, pricePunsch: 2.50, soldWaffles: 0, priceWaffles: 2.00, standFee: 0.00, otherRevenue: 0.00 };

async function saveState() {
  appState.customItemsList = itemsData;
  appState.adminPassword = adminPassword;
  appState.activityLog = activityLog;
  localStorage.setItem('sg_wm_state_v21', JSON.stringify(appState));
  updateProgress();

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

function logActivity(text) {
  const time = new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
  activityLog.unshift(`[${time}] [${currentRole.toUpperCase()}] ${text}`);
  if (activityLog.length > 15) activityLog.pop();
  renderActivityLog();
}

function renderActivityLog() {
  const list = document.getElementById('activityLogList');
  if (!list) return;
  if (activityLog.length === 0) {
    list.innerHTML = `<li class="italic text-slate-400">Keine Aktivitäten protokolliert.</li>`;
  } else {
    list.innerHTML = activityLog.map(log => `<li class="border-b border-amber-200/40 pb-0.5">${log}</li>`).join('');
  }
}

function clearActivityLog() {
  activityLog = [];
  saveState();
  renderActivityLog();
}

function showNoticeBanner(text) {
  const banner = document.getElementById('noticeBanner');
  const txt = document.getElementById('noticeBannerText');
  if (banner && txt && text) {
    txt.innerText = text;
    banner.classList.remove('hidden');
  }
}

function dismissNotice() {
  document.getElementById('noticeBanner')?.classList.add('hidden');
}

function setGlobalNotice() {
  const msg = prompt("Wichtige Durchsage eingeben:", appState.globalNotice || "");
  if (msg !== null) {
    appState.globalNotice = msg.trim();
    saveState();
    if (appState.globalNotice) {
      showNoticeBanner(appState.globalNotice);
      logActivity(`Notice gesetzt: "${appState.globalNotice}"`);
    } else {
      dismissNotice();
    }
  }
}

function toggleRoleModal() { document.getElementById('roleModal')?.classList.remove('hidden'); }
function closeRoleModal() { document.getElementById('roleModal')?.classList.add('hidden'); }

function selectRole(role) {
  currentRole = role;
  closeRoleModal();
  applyRolePermissions();
  logActivity(`Rolle gewechselt zu ${role}`);
}

function promptAdminLogin() {
  const pwd = prompt("Bitte Admin-Passwort eingeben:");
  if (pwd === adminPassword) {
    currentRole = 'admin';
    closeRoleModal();
    applyRolePermissions();
    logActivity("Admin eingeloggt");
  } else if (pwd !== null) {
    alert("Falsches Passwort!");
  }
}

function applyRolePermissions() {
  const badge = document.getElementById('roleBadge');
  const adminPanel = document.getElementById('adminPanel');
  const isBetrachter = currentRole === 'betrachter';
  const isHelfer = currentRole === 'helfer';
  const isOrga = currentRole === 'orga';
  const isAdmin = currentRole === 'admin';

  if (badge) {
    if (isAdmin) {
      badge.innerHTML = '🔓 Rolle: ADMIN';
      badge.className = 'px-3 py-1.5 rounded-xl text-xs font-bold bg-amber-400 text-slate-950 shadow-sm';
    } else if (isOrga) {
      badge.innerHTML = '📋 Rolle: ORGA-TEAM';
      badge.className = 'px-3 py-1.5 rounded-xl text-xs font-bold bg-sky-500/30 text-sky-100 border border-sky-300/40 shadow-sm';
    } else if (isHelfer) {
      badge.innerHTML = '🤝 Rolle: HELFER';
      badge.className = 'px-3 py-1.5 rounded-xl text-xs font-bold bg-emerald-500/30 text-emerald-100 border border-emerald-300/40 shadow-sm';
    } else {
      badge.innerHTML = '👁️ Rolle: BETRACHTER (Nur Lesen)';
      badge.className = 'px-3 py-1.5 rounded-xl text-xs font-bold bg-white/10 text-emerald-100 border border-white/20 shadow-sm';
    }
  }

  if (adminPanel) adminPanel.classList.toggle('hidden', !isAdmin);

  document.querySelectorAll('input, select').forEach(el => {
    if (el.id === 'searchInput' || el.id === 'adminToggleBtn' || el.id === 'punschLiters') return;
    
    if (isBetrachter) {
      el.disabled = true;
    } else if (isHelfer) {
      const isHelferAllowed = el.classList.contains('role-helfer-field') || el.type === 'checkbox' || el.tagName === 'SELECT';
      el.disabled = !isHelferAllowed;
    } else {
      el.disabled = false;
    }
  });

  renderChecklist();
}

function updateRecipeScaling() {
  const punschLiters = parseFloat(document.getElementById('punschLiters')?.value || 8);
  const lbl = document.getElementById('punschLitersLabel');
  if (lbl) lbl.innerText = `${punschLiters} Liter`;

  const factor = punschLiters / 8.0;
  const punschList = document.getElementById('punschRecipeList');
  if (punschList) {
    punschList.innerHTML = `
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
  const punschLiters = parseFloat(document.getElementById('punschLiters')?.value || 8);
  const factor = punschLiters / 8.0;

  const ingredientUpdates = {
    38: `${Math.ceil(10 * factor)} Btl.`,
    39: `${Math.ceil(5 * factor)} Btl.`,
    40: `${Math.ceil(2 * factor)} Stk`,
    41: `${(1.0 * factor).toFixed(1).replace('.0','')} l`,
    42: `${(2.5 * factor).toFixed(1).replace('.0','')} l`,
    43: `${(2.5 * factor).toFixed(1).replace('.0','')} l`
  };

  Object.keys(ingredientUpdates).forEach(id => {
    if (appState[id]) appState[id].qty = ingredientUpdates[id];
  });

  saveState();
  renderChecklist();
  logActivity(`Punsch-Zutaten für ${punschLiters}L synchronisiert`);
  alert("Punsch-Zutaten wurden in die Einkaufsliste übernommen!");
}

function calculateSalesStats() {
  const sPunsch = parseInt(document.getElementById('soldPunsch')?.value || 0);
  const pPunsch = parseFloat(document.getElementById('pricePunsch')?.value || 2.50);
  const sWaffles = parseInt(document.getElementById('soldWaffles')?.value || 0);
  const pWaffles = parseFloat(document.getElementById('priceWaffles')?.value || 2.00);
  const fee = parseFloat(document.getElementById('standFee')?.value || 0.00);
  const otherRev = parseFloat(document.getElementById('otherRevenue')?.value || 0.00);

  const revenue = (sPunsch * pPunsch) + (sWaffles * pWaffles) + otherRev;

  let shoppingCost = 0;
  itemsData.filter(i => i.isShop).forEach(item => {
    const state = appState[item.id];
    if (state) {
      const needNum = parseVal(state.qty);
      const packNum = parseVal(state.packageSize);
      let calcPackages = 1;
      if (needNum > 0 && packNum > 0) calcPackages = Math.ceil(needNum / packNum);
      else if (needNum > 0) calcPackages = Math.ceil(needNum);
      const unitPrice = parseVal(state.price);
      shoppingCost += calcPackages * unitPrice;
    }
  });

  const totalExpenses = shoppingCost + fee;
  const profit = revenue - totalExpenses;

  const revEl = document.getElementById('statRevenue');
  const expEl = document.getElementById('statExpenses');
  const proEl = document.getElementById('statProfit');

  if (revEl) revEl.innerText = revenue.toFixed(2).replace('.', ',') + ' €';
  if (expEl) expEl.innerText = totalExpenses.toFixed(2).replace('.', ',') + ' €';
  if (proEl) proEl.innerText = profit.toFixed(2).replace('.', ',') + ' €';

  appState.salesStats = { soldPunsch: sPunsch, pricePunsch: pPunsch, soldWaffles: sWaffles, priceWaffles: pWaffles, standFee: fee, otherRevenue: otherRev };
  saveState();
}

function changeAdminPassword() {
  const newPwd = prompt("Neues Admin-Passwort eingeben:", adminPassword);
  if (newPwd && newPwd.trim() !== "") {
    adminPassword = newPwd.trim();
    saveState();
    logActivity("Admin-Passwort geändert");
    alert("Passwort geändert!");
  }
}

function resetSeason() {
  if (confirm("⚠️ Saison-Reset durchführen?")) {
    itemsData.forEach(item => {
      if (appState[item.id]) {
        appState[item.id].status = 'Offen';
        appState[item.id].assignedTo = '';
        appState[item.id].packed = false;
      }
    });
    saveState();
    renderChecklist();
    logActivity("Saison-Reset durchgeführt");
    alert("Reset abgeschlossen!");
  }
}

function exportDataJSON() {
  const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(appState, null, 2));
  const dlAnchorElem = document.createElement('a');
  dlAnchorElem.setAttribute("href", dataStr);
  dlAnchorElem.setAttribute("download", `SG_Barnstorf_Weihnachtsmarkt_Backup_${new Date().toISOString().slice(0,10)}.json`);
  dlAnchorElem.click();
}

function importDataJSON() {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = 'application/json';
  input.onchange = e => {
    const file = e.target.files[0];
    const reader = new FileReader();
    reader.readAsText(file, 'UTF-8');
    reader.onload = readerEvent => {
      try {
        const content = JSON.parse(readerEvent.target.result);
        if (content) {
          appState = content;
          if (appState.customItemsList) itemsData = appState.customItemsList;
          if (appState.adminPassword) adminPassword = appState.adminPassword;
          saveState();
          renderChecklist();
          alert("Backup wiederhergestellt!");
        }
      } catch(err) {
        alert("Fehler beim Einlesen!");
      }
    }
  }
  input.click();
}

function getExistingCategories() {
  return [...new Set(itemsData.map(item => item.cat))];
}

function openCreateItemModal() {
  editingItemId = null;
  document.getElementById('itemModalTitle').innerText = "➕ Neuer Gegenstand";
  document.getElementById('modalItemTitle').value = "";
  document.getElementById('modalItemDetails').value = "";
  populateCategoryDropdown();
  document.getElementById('itemModal').classList.remove('hidden');
}

function openEditItemModal(id) {
  editingItemId = id;
  const item = itemsData.find(i => i.id === id);
  if (!item) return;

  document.getElementById('itemModalTitle').innerText = "✏️ Gegenstand bearbeiten";
  document.getElementById('modalItemTitle').value = item.title;
  document.getElementById('modalItemDetails').value = item.details || "";
  populateCategoryDropdown(item.cat);
  document.getElementById('itemModal').classList.remove('hidden');
}

function populateCategoryDropdown(selectedCat = "") {
  const select = document.getElementById('modalItemCat');
  const customInput = document.getElementById('modalCustomCat');
  select.innerHTML = "";

  getExistingCategories().forEach(c => {
    const opt = document.createElement('option');
    opt.value = c;
    opt.innerText = c;
    if (c === selectedCat) opt.selected = true;
    select.appendChild(opt);
  });

  const newOpt = document.createElement('option');
  newOpt.value = "__NEW__";
  newOpt.innerText = "➕ [ Neue Kategorie ]";
  select.appendChild(newOpt);

  customInput.value = "";
  customInput.classList.add('hidden');
}

function handleCatSelectChange(selectEl) {
  const customInput = document.getElementById('modalCustomCat');
  if (selectEl.value === "__NEW__") customInput.classList.remove('hidden');
  else customInput.classList.add('hidden');
}

function saveItemFromModal() {
  const title = document.getElementById('modalItemTitle').value.trim();
  if (!title) { alert("Bitte einen Namen angeben!"); return; }

  const selectCat = document.getElementById('modalItemCat').value;
  const customCat = document.getElementById('modalCustomCat').value.trim();
  let finalCat = (selectCat === "__NEW__") ? customCat : selectCat;

  if (selectCat === "__NEW__" && !customCat) { alert("Bitte Kategorie eingeben!"); return; }

  const details = document.getElementById('modalItemDetails').value.trim();

  if (editingItemId !== null) {
    const item = itemsData.find(i => i.id === editingItemId);
    if (item) {
      item.title = title;
      item.cat = finalCat;
      item.details = details;
      logActivity(`Bearbeitet: "${title}"`);
    }
  } else {
    const newId = Date.now();
    const newItem = { id: newId, cat: finalCat, title: title, details: details, isShop: false };
    itemsData.push(newItem);
    initItemState(newItem);
    logActivity(`Neu: "${title}"`);
  }

  saveState();
  closeItemModal();
  renderChecklist();
}

function closeItemModal() { document.getElementById('itemModal').classList.add('hidden'); }

function deleteItem(id) {
  if (confirm("Gegenstand löschen?")) {
    const idx = itemsData.findIndex(i => i.id === id);
    if (idx !== -1) {
      const title = itemsData[idx].title;
      itemsData.splice(idx, 1);
      delete appState[id];
      saveState();
      renderChecklist();
      logActivity(`Gelöscht: "${title}"`);
    }
  }
}

function renameCategory(oldCat) {
  const newCat = prompt("Neuer Name:", oldCat);
  if (newCat && newCat.trim() !== "" && newCat !== oldCat) {
    itemsData.forEach(i => { if (i.cat === oldCat) i.cat = newCat.trim(); });
    saveState();
    renderChecklist();
    logActivity(`Kategorie umbenannt: "${oldCat}" -> "${newCat.trim()}"`);
  }
}

function deleteCategory(cat) {
  if (confirm(`Ganze Kategorie "${cat}" löschen?`)) {
    itemsData = itemsData.filter(i => i.cat !== cat);
    saveState();
    renderChecklist();
    logActivity(`Kategorie gelöscht: "${cat}"`);
  }
}

function updateItem(id, field, value) {
  if (!appState[id]) appState[id] = {};
  appState[id][field] = value;
  saveState();
  renderChecklist();
  const item = itemsData.find(i => i.id === id);
  if (item) logActivity(`"${item.title}" -> ${field}: ${value}`);
}

function updateProgress() {
  const total = itemsData.length;
  const count = itemsData.filter(i => {
    const s = appState[i.id] ? appState[i.id].status : 'Offen';
    return s === 'Erledigt' || s === 'Eingekauft';
  }).length;
  const percent = total > 0 ? Math.round((count / total) * 100) : 0;
  
  const bar = document.getElementById('progressBar');
  const txt = document.getElementById('progressText');
  if (bar) bar.style.width = percent + '%';
  if (txt) txt.innerText = percent + '% erledigt (' + count + '/' + total + ')';
}

function setFilter(filter, btn) {
  currentFilter = filter;
  document.querySelectorAll('.filter-btn').forEach(b => {
    b.classList.remove('bg-emerald-600', 'text-white', 'border-emerald-600', 'font-bold');
    b.classList.add('bg-white', 'text-slate-700', 'border-slate-200', 'font-medium');
  });
  btn.classList.remove('bg-white', 'text-slate-700', 'border-slate-200', 'font-medium');
  btn.classList.add('bg-emerald-600', 'text-white', 'border-emerald-600', 'font-bold');
  renderChecklist();
}

function getStatusClass(status) {
  if (status === 'Vorbereitet') return 'status-vorbereitet';
  if (status === 'Verteilt') return 'status-verteilt';
  if (status === 'Erledigt' || status === 'Eingekauft') return 'status-erledigt';
  return 'status-offen';
}

function renderChecklist() {
  const searchVal = (document.getElementById('searchInput')?.value || '').toLowerCase();
  const container = document.getElementById('checklist');
  if (!container) return;
  container.innerHTML = '';

  const isAdmin = currentRole === 'admin';
  const isBetrachter = currentRole === 'betrachter';

  const categories = [...new Set(itemsData.map(item => item.cat))];

  categories.forEach(cat => {
    const catItems = itemsData.filter(item => {
      initItemState(item);
      const state = appState[item.id];
      const matchesCat = item.cat === cat;
      const matchesSearch = item.title.toLowerCase().includes(searchVal) || 
                            (item.details && item.details.toLowerCase().includes(searchVal)) ||
                            (state.assignedTo && state.assignedTo.toLowerCase().includes(searchVal)) ||
                            (state.boxNum && state.boxNum.toString().includes(searchVal));
      let matchesFilter = true;
      if (currentFilter !== 'all') matchesFilter = (state.status === currentFilter);

      return matchesCat && matchesSearch && matchesFilter;
    });

    if (catItems.length > 0 || isAdmin) {
      const catWrapper = document.createElement('div');
      catWrapper.className = 'bg-white border border-slate-200/80 rounded-3xl p-4 sm:p-6 shadow-sm print:border-none print:shadow-none print:p-0 print:mb-6';

      const catTitle = document.createElement('h2');
      catTitle.className = 'text-lg font-bold text-emerald-950 mb-4 flex items-center justify-between border-b border-slate-100 pb-2';
      catTitle.innerHTML = `
        <span>${cat}</span>
        ${isAdmin ? `
          <div class="flex items-center gap-2 print:hidden">
            <button onclick="renameCategory('${cat}')" class="text-xs font-semibold px-2 py-1 bg-slate-100 text-slate-600 rounded-lg hover:bg-slate-200">✏️ Umbenennen</button>
            <button onclick="deleteCategory('${cat}')" class="text-xs font-semibold px-2 py-1 bg-red-50 text-red-600 rounded-lg hover:bg-red-100">🗑️ Löschen</button>
          </div>
        ` : ''}
      `;
      catWrapper.appendChild(catTitle);

      const tableContainer = document.createElement('div');
      tableContainer.className = 'table-container';

      const isOrga = (cat === '🏛️ Orga');
      const isIngredientCat = (cat === '🍎 Zutaten (Waffeln & Punsch)');

      const table = document.createElement('table');
      table.className = 'w-full text-left text-xs sm:text-sm text-slate-800 border-collapse min-w-[650px] print:min-w-0';

      table.innerHTML = `
        <thead>
          <tr class="border-b border-slate-200 text-slate-500 text-xs uppercase tracking-wider bg-slate-50/50 print:bg-transparent">
            <th class="py-2.5 px-3 ${isOrga ? 'w-[38%]' : 'w-[22%]'}">${isOrga ? 'Aufgabe / Details' : 'Gegenstand'}</th>
            ${!isOrga ? '<th class="py-2.5 px-2 w-[12%]">Benötigt</th>' : ''}
            ${!isOrga && !isIngredientCat ? '<th class="py-2.5 px-2 w-[10%] text-amber-900 font-bold">Auf Lager</th>' : ''}
            <th class="py-2.5 px-2 w-[16%]">Status</th>
            <th class="py-2.5 px-2 w-[16%]">${isOrga ? 'Ansprechpartner' : 'Verantwortlich'}</th>
            ${!isOrga ? '<th class="py-2.5 px-2 w-[7%] text-center">Gepackt?</th>' : ''}
            ${!isOrga ? '<th class="py-2.5 px-2 w-[8%] text-center">Box</th>' : ''}
            ${isAdmin ? '<th class="py-2.5 px-2 w-[8%] text-center print:hidden">Admin</th>' : ''}
          </tr>
        </thead>
        <tbody class="divide-y divide-slate-100"></tbody>
      `;

      const tbody = table.querySelector('tbody');

      catItems.forEach(item => {
        const state = appState[item.id];
        const isDone = state.status === 'Erledigt' || state.status === 'Eingekauft';
        
        const tr = document.createElement('tr');
        tr.className = `hover:bg-slate-50 transition ${isDone ? 'opacity-70 bg-emerald-50/30' : ''}`;

        const statusOptions = item.isShop 
          ? ['Offen', 'Vorbereitet', 'Verteilt', 'Eingekauft']
          : ['Offen', 'Vorbereitet', 'Verteilt', 'Erledigt'];

        const disabledAttr = isBetrachter ? 'disabled' : '';

        tr.innerHTML = `
          <td class="py-3 px-3">
            <div class="font-semibold ${isDone ? 'line-through text-slate-400' : 'text-slate-900'}">${item.title}</div>
            ${item.details ? `<div class="text-xs text-slate-500">${item.details}</div>` : ''}
          </td>
          ${!isOrga ? `
            <td class="py-3 px-2">
              <input type="text" value="${state.qty \vert{}\vert{} ''}" placeholder="-" ${disabledAttr}
                onchange="updateItem(${item.id}, 'qty', this.value)"
                class="role-orga-field bg-white border border-slate-300 rounded-lg px-2 py-1 text-xs text-slate-900 focus:border-emerald-500 focus:outline-none w-20 shadow-xs" />
            </td>
            ${!isIngredientCat ? `
              <td class="py-3 px-2">
                <input type="text" value="${state.stockQty || ''}" placeholder="0" ${disabledAttr}
                  onchange="updateItem(${item.id}, 'stockQty', this.value)"
                  class="role-orga-field bg-amber-50/80 border border-amber-300 rounded-lg px-2 py-1 text-xs text-amber-900 font-medium focus:border-amber-500 focus:outline-none w-16 shadow-xs" />
              </td>
            ` : ''}
          ` : ''}
          <td class="py-3 px-2">
            <select onchange="updateItem(${item.id}, 'status', this.value)" ${disabledAttr}
              class="border rounded-lg px-2 py-1 text-xs font-semibold focus:outline-none w-full shadow-xs ${getStatusClass(state.status)}">
              ${statusOptions.map(opt => `<option value="${opt}" ${state.status === opt ? 'selected' : ''}>${opt}</option>`).join('')}
            </select>
          </td>
          <td class="py-3 px-2">
            <input type="text" placeholder="Name..." value="${state.assignedTo || ''}" ${disabledAttr}
              onchange="updateItem(${item.id}, 'assignedTo', this.value)"
              class="role-orga-field bg-white border border-slate-300 rounded-lg px-2.5 py-1 text-xs text-slate-900 placeholder-slate-400 focus:border-emerald-500 focus:outline-none w-full shadow-xs" />
          </td>
          ${!isOrga ? `
            <td class="py-3 px-2 text-center align-middle">
              <input type="checkbox" ${state.packed ? 'checked' : ''} ${disabledAttr}
                onchange="updateItem(${item.id}, 'packed', this.checked)"
                class="role-helfer-field w-5 h-5 accent-emerald-600 rounded cursor-pointer mx-auto block" />
            </td>
            <td class="py-3 px-2 text-center">
              <input type="number" min="1" max="12" value="${state.boxNum \vert{}\vert{} ''}" ${disabledAttr}
                onchange="updateItem(${item.id}, 'boxNum', this.value)"
                class="role-orga-field bg-white border border-slate-300 rounded-lg px-1 py-1 text-xs text-slate-900 text-center focus:border-emerald-500 focus:outline-none w-12 mx-auto shadow-xs" />
            </td>
          ` : ''}
          ${isAdmin ? `
            <td class="py-3 px-2 text-center whitespace-nowrap print:hidden">
              <button onclick="openEditItemModal(${item.id})" class="text-slate-500 hover:text-emerald-700 font-bold px-1 text-sm">✏️</button>
              <button onclick="deleteItem(${item.id})" class="text-slate-500 hover:text-red-700 font-bold px-1 text-sm">🗑️</button>
            </td>
          ` : ''}
        `;
        tbody.appendChild(tr);
      });

      tableContainer.appendChild(table);
      catWrapper.appendChild(tableContainer);
      container.appendChild(catWrapper);
    }
  });
}

function parseVal(valStr) {
  if (!valStr) return 0;
  const match = valStr.toString().replace(',', '.').match(/([0-9.]+)/);
  return match ? parseFloat(match[1]) : 0;
}

function openShoppingModal() {
  const modal = document.getElementById('shoppingModal');
  const tbody = document.getElementById('shoppingTableBody');
  tbody.innerHTML = '';

  itemsData.filter(i => i.isShop).forEach(item => {
    initItemState(item);
    const state = appState[item.id];
    const isBought = state.status === 'Eingekauft';

    const needNum = parseVal(state.qty);
    const packNum = parseVal(state.packageSize);

    let calcPackages = 1;
    if (needNum > 0 && packNum > 0) calcPackages = Math.ceil(needNum / packNum);
    else if (needNum > 0) calcPackages = Math.ceil(needNum);

    const unitPrice = parseVal(state.price);
    const totalPrice = calcPackages * unitPrice;

    const tr = document.createElement('tr');
    tr.className = `hover:bg-slate-50 transition ${isBought ? 'bg-emerald-50/60' : ''}`;

    const storeOptionsHtml = `
      <option value="">-- Geschäft --</option>
      ${storeOptions.map(store => `<option value="${store}" ${state.store === store ? 'selected' : ''}>${store}</option>`).join('')}
    `;

    tr.innerHTML = `
      <td class="py-2.5 px-3 text-center align-middle">
        <input type="checkbox" ${isBought ? 'checked' : ''} 
          onchange="toggleShopItemStatus(${item.id}, this.checked)"
          class="w-5 h-5 accent-emerald-600 rounded cursor-pointer mx-auto block" />
      </td>
      <td class="py-2.5 px-3">
        <div class="font-semibold ${isBought ? 'line-through text-emerald-800' : 'text-slate-900'}">${item.title}</div>
        ${item.details ? `<div class="text-xs text-slate-400">${item.details}</div>` : ''}
      </td>
      <td class="py-2.5 px-2 text-center text-slate-700 font-medium">${state.qty || '-'}</td>
      <td class="py-2.5 px-2 text-center">
        <input type="text" value="${state.packageSize || ''}" placeholder="z.B. 1 l"
          onchange="updateItem(${item.id}, 'packageSize', this.value); openShoppingModal();"
          class="bg-white border border-slate-300 rounded-lg px-2 py-1 text-xs text-slate-900 text-center w-20 shadow-xs focus:border-amber-500 focus:outline-none" />
      </td>
      <td class="py-2.5 px-2 text-center font-bold text-amber-900 bg-amber-50/60 rounded-lg whitespace-nowrap">
        ${calcPackages}x
      </td>
      <td class="py-2.5 px-2">
        <select onchange="updateItem(${item.id}, 'store', this.value)"
          class="bg-white border border-slate-300 rounded-lg px-2 py-1 text-xs text-slate-900 w-full shadow-xs focus:border-amber-500 focus:outline-none">
          ${storeOptionsHtml}
        </select>
      </td>
      <td class="py-2.5 px-2 text-right whitespace-nowrap">
        <input type="number" step="0.01" value="${state.price || ''}" placeholder="0.00"
          onchange="updateItem(${item.id}, 'price', this.value); openShoppingModal();"
          class="bg-white border border-slate-300 rounded-lg px-2 py-1 text-xs text-slate-900 text-right w-16 shadow-xs inline-block mr-1 focus:border-amber-500 focus:outline-none" /> €
      </td>
      <td class="py-2.5 px-2 text-right font-bold text-emerald-800 whitespace-nowrap">
        ${totalPrice.toFixed(2).replace('.', ',')} €
      </td>
    `;
    tbody.appendChild(tr);
  });

  calculateShopTotal();
  modal.classList.remove('hidden');
}

function toggleShopItemStatus(id, isChecked) {
  updateItem(id, 'status', isChecked ? 'Eingekauft' : 'Offen');
  openShoppingModal();
}

function calculateShopTotal() {
  let sum = 0;
  itemsData.filter(i => i.isShop).forEach(item => {
    const state = appState[item.id];
    if (state) {
      const needNum = parseVal(state.qty);
      const packNum = parseVal(state.packageSize);
      let calcPackages = 1;
      if (needNum > 0 && packNum > 0) calcPackages = Math.ceil(needNum / packNum);
      else if (needNum > 0) calcPackages = Math.ceil(needNum);
      const unitPrice = parseVal(state.price);
      sum += calcPackages * unitPrice;
    }
  });
  const totalEl = document.getElementById('shoppingTotal');
  if (totalEl) totalEl.innerText = sum.toFixed(2).replace('.', ',') + ' €';
}

function closeShoppingModal() { document.getElementById('shoppingModal').classList.add('hidden'); }

function openWiringModal() { renderWiringModal(); document.getElementById('wiringModal').classList.remove('hidden'); }

function updateSocketCable(socketNum, val) {
  if (!appState.socketCables) appState.socketCables = {};
  appState.socketCables[socketNum] = val;
  saveState();
}

function updateCableMaxWatt(socketNum, val) {
  if (!appState.socketCableMaxWatts) appState.socketCableMaxWatts = {};
  appState.socketCableMaxWatts[socketNum] = parseInt(val || 3680);
  saveState();
  calculateSocketsPower();
}

function getItemCount(item) {
  const state = appState[item.id] || {};
  const need = parseInt(state.qty);
  const stock = parseInt(state.stockQty);
  let count = 1;
  if (!isNaN(need) && need > 0) count = need;
  else if (!isNaN(stock) && stock > 0) count = stock;
  return Math.max(1, count);
}

function getPowerInstances() {
  const instances = [];
  itemsData.filter(i => i.isPower).forEach(item => {
    const count = getItemCount(item);
    for (let i = 1; i <= count; i++) {
      const key = `${item.id}-${i}`;
      const socket = (appState.powerAssignments && appState.powerAssignments[key]) || 'unassigned';
      const savedWatts = appState.instanceWatts && appState.instanceWatts[key] !== undefined 
        ? appState.instanceWatts[key] 
        : item.defaultWatts || 0;

      instances.push({
        key: key, itemId: item.id,
        title: count > 1 ? `${item.title} #${i}` : item.title,
        baseTitle: item.title, watts: parseInt(savedWatts),
        isCable: item.isCable, socket: socket
      });
    }
  });
  return instances;
}

function updateInstanceWatts(instKey, newWatts) {
  if (!appState.instanceWatts) appState.instanceWatts = {};
  appState.instanceWatts[instKey] = parseInt(newWatts || 0);
  saveState();
  calculateSocketsPower();
}

function populateCableDropdowns() {
  const cableOptionsHtml = [
    `<option value="Direkt Mehrfachstecker 3er">➡️ Direkt Mehrfachstecker 3er</option>`,
    `<option value="Direkt Mehrfachstecker 5er">➡️ Direkt Mehrfachstecker 5er</option>`,
    `<option value="Verlängerung 3m + Mehrfachstecker 3er">➡️ Verlängerung 3m + Mehrfachstecker 3er</option>`,
    `<option value="Verlängerung 3m + Mehrfachstecker 5er">➡️ Verlängerung 3m + Mehrfachstecker 5er</option>`,
    `<option value="Kabeltrommel + Mehrfachstecker 3er">➡️ Kabeltrommel + Mehrfachstecker 3er</option>`
  ];

  [1, 2, 3].forEach(sNum => {
    const el = document.getElementById(`socket${sNum}Cable`);
    if (el) {
      const curVal = (appState.socketCables && appState.socketCables[sNum]) || el.value;
      el.innerHTML = cableOptionsHtml.join('');
      if (curVal) el.value = curVal;
    }
    const maxEl = document.getElementById(`socket${sNum}CableMax`);
    if (maxEl && appState.socketCableMaxWatts) {
      maxEl.value = appState.socketCableMaxWatts[sNum] || 3680;
    }
  });
}

function renderWiringModal() {
  const poolUnassigned = document.getElementById('unassignedPool');
  const poolSocket1 = document.getElementById('socket1Pool');
  const poolSocket2 = document.getElementById('socket2Pool');
  const poolSocket3 = document.getElementById('socket3Pool');

  if (poolUnassigned) poolUnassigned.innerHTML = '';
  if (poolSocket1) poolSocket1.innerHTML = '';
  if (poolSocket2) poolSocket2.innerHTML = '';
  if (poolSocket3) poolSocket3.innerHTML = '';

  const instances = getPowerInstances();
  populateCableDropdowns();

  instances.forEach(inst => {
    const card = document.createElement('div');
    card.id = `drag-item-${inst.key}`;
    card.draggable = true;
    card.ondragstart = (e) => drag(e, inst.key);
    card.className = `p-2 rounded-xl border bg-white shadow-xs flex items-center justify-between gap-1.5 cursor-grab active:cursor-grabbing hover:border-sky-400 transition select-none`;

    card.innerHTML = `
      <div class="flex items-center gap-1.5 overflow-hidden">
        <span class="text-slate-400 font-bold cursor-move text-xs">⋮⋮</span>
        <span class="font-semibold text-slate-800 text-xs truncate">${inst.title}</span>
      </div>
      <div class="flex items-center gap-1 shrink-0">
        <input type="number" value="${inst.watts}" step="50" onchange="updateInstanceWatts('${inst.key}', this.value)" 
          class="w-14 border border-sky-200 rounded text-right px-1 py-0.5 text-[10px] font-mono font-bold text-sky-900 bg-sky-50 focus:outline-none" />
        <span class="text-[10px] text-slate-500 font-bold">${inst.isCable ? 'W max' : 'W'}</span>
        <select onchange="moveInstanceSocket('${inst.key}', this.value)" class="text-[10px] border rounded bg-slate-50 py-0.5 px-1 cursor-pointer">
          <option value="unassigned" ${inst.socket === 'unassigned' ? 'selected' : ''}>Pool</option>
          <option value="socket1" ${inst.socket === 'socket1' ? 'selected' : ''}>Dose 1</option>
          <option value="socket2" ${inst.socket === 'socket2' ? 'selected' : ''}>Dose 2</option>
          <option value="socket3" ${inst.socket === 'socket3' ? 'selected' : ''}>Dose 3</option>
        </select>
      </div>
    `;

    if (inst.socket === 'socket1' && poolSocket1) poolSocket1.appendChild(card);
    else if (inst.socket === 'socket2' && poolSocket2) poolSocket2.appendChild(card);
    else if (inst.socket === 'socket3' && poolSocket3) poolSocket3.appendChild(card);
    else if (poolUnassigned) poolUnassigned.appendChild(card);
  });

  calculateSocketsPower();
}

function drag(e, instKey) { e.dataTransfer.setData("text/plain", instKey); }
function allowDrop(e) { e.preventDefault(); }
function drop(e, targetSocket) {
  e.preventDefault();
  const instKey = e.dataTransfer.getData("text/plain");
  if (instKey) moveInstanceSocket(instKey, targetSocket);
}

function moveInstanceSocket(instKey, targetSocket) {
  if (!appState.powerAssignments) appState.powerAssignments = {};
  appState.powerAssignments[instKey] = targetSocket;
  saveState();
  renderWiringModal();
}

function calculateSocketsPower() {
  let watts1 = 0, watts2 = 0, watts3 = 0;
  getPowerInstances().forEach(inst => {
    if (!inst.isCable) {
      if (inst.socket === 'socket1') watts1 += inst.watts;
      if (inst.socket === 'socket2') watts2 += inst.watts;
      if (inst.socket === 'socket3') watts3 += inst.watts;
    }
  });

  const amps1 = (watts1 / 230).toFixed(1).replace('.', ',');
  const amps2 = (watts2 / 230).toFixed(1).replace('.', ',');
  const amps3 = (watts3 / 230).toFixed(1).replace('.', ',');

  const w1 = document.getElementById('socket1Watts');
  const w2 = document.getElementById('socket2Watts');
  const w3 = document.getElementById('socket3Watts');

  if (w1) w1.innerText = `${watts1.toLocaleString('de-DE')} W / ${amps1} A`;
  if (w2) w2.innerText = `${watts2.toLocaleString('de-DE')} W / ${amps2} A`;
  if (w3) w3.innerText = `${watts3.toLocaleString('de-DE')} W / ${amps3} A`;

  const max1 = (appState.socketCableMaxWatts && appState.socketCableMaxWatts[1]) || 3680;
  const max2 = (appState.socketCableMaxWatts && appState.socketCableMaxWatts[2]) || 3680;
  const max3 = (appState.socketCableMaxWatts && appState.socketCableMaxWatts[3]) || 3680;

  document.getElementById('socket1Warn')?.classList.toggle('hidden', watts1 <= Math.min(3680, max1));
  document.getElementById('socket2Warn')?.classList.toggle('hidden', watts2 <= Math.min(3680, max2));
  document.getElementById('socket3Warn')?.classList.toggle('hidden', watts3 <= Math.min(3680, max3));
}

function closeWiringModal() { document.getElementById('wiringModal').classList.add('hidden'); }

function openStockModal() {
  const modal = document.getElementById('stockModal');
  const tbody = document.getElementById('stockTableBody');
  if (!tbody) return;
  tbody.innerHTML = '';

  const stockedItems = itemsData.filter(item => {
    if (item.isIngredient) return false;
    initItemState(item);
    const state = appState[item.id];
    return state.stockQty && state.stockQty.toString().trim() !== '' && state.stockQty !== '0';
  });

  if (stockedItems.length === 0) {
    tbody.innerHTML = `<tr><td colspan="5" class="py-8 text-center text-slate-400 italic">Noch kein Lagerbestand eingetragen.</td></tr>`;
  } else {
    stockedItems.forEach(item => {
      const state = appState[item.id];
      const tr = document.createElement('tr');
      tr.className = 'hover:bg-slate-50 transition';
      tr.innerHTML = `
        <td class="py-2.5 px-3 text-xs font-semibold text-slate-500">${item.cat}</td>
        <td class="py-2.5 px-3 font-semibold text-slate-900">${item.title}</td>
        <td class="py-2.5 px-2 text-center font-bold text-amber-900 bg-amber-50 rounded-lg">${state.stockQty}</td>
        <td class="py-2.5 px-2 text-center text-slate-500">${state.qty || '-'}</td>
        <td class="py-2.5 px-2 text-center">
          <span class="text-xs px-2 py-0.5 rounded border font-medium ${getStatusClass(state.status)}">${state.status}</span>
        </td>
      `;
      tbody.appendChild(tr);
    });
  }

  modal.classList.remove('hidden');
}

function closeStockModal() { document.getElementById('stockModal').classList.add('hidden'); }

function openBoxOverview() {
  const modal = document.getElementById('boxModal');
  const content = document.getElementById('boxModalContent');
  if (!content) return;
  content.innerHTML = '';

  for (let b = 1; b <= 12; b++) {
    const boxItems = itemsData.filter(item => {
      const state = appState[item.id];
      return state && parseInt(state.boxNum) === b;
    });

    const packedCount = boxItems.filter(item => appState[item.id] && appState[item.id].packed).length;
    const totalCount = boxItems.length;
    const isComplete = totalCount > 0 && packedCount === totalCount;

    const boxDiv = document.createElement('div');
    boxDiv.className = `border rounded-2xl p-4 transition shadow-xs ${totalCount === 0 ? 'bg-slate-50/60 border-slate-200 opacity-60' : isComplete ? 'bg-emerald-50/60 border-emerald-300' : 'bg-white border-slate-200'}`;

    const boxHeader = document.createElement('div');
    boxHeader.className = 'border-b border-slate-100 pb-2 mb-3';
    boxHeader.innerHTML = `
      <div class="flex justify-between items-center mb-1">
        <h3 class="font-bold text-slate-900 text-sm sm:text-base flex items-center gap-2">
          <span>📦 Box ${b}</span>
          ${isComplete ? '<span class="text-xs bg-emerald-600 text-white px-2 py-0.5 rounded-full font-bold">✓ Gepackt</span>' : ''}
        </h3>
        <span class="text-xs font-semibold ${totalCount === 0 ? 'text-slate-400' : 'text-slate-600'}">
          ${packedCount}/${totalCount} gepackt
        </span>
      </div>
      ${totalCount > 0 ? `
        <div class="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
          <div class="bg-emerald-500 h-full transition-all duration-300" style="width: ${Math.round((packedCount/totalCount)*100)}%"></div>
        </div>
      ` : ''}
    `;
    boxDiv.appendChild(boxHeader);

    if (totalCount > 0) {
      const ul = document.createElement('ul');
      ul.className = 'divide-y divide-slate-100 text-xs sm:text-sm';
      boxItems.forEach(item => {
        const state = appState[item.id];
        const li = document.createElement('li');
        li.className = 'py-2 flex justify-between items-center gap-2';
        li.innerHTML = `
          <div class="flex items-center gap-2 overflow-hidden">
            <span class="${state.packed ? 'text-emerald-600 font-bold' : 'text-slate-300'}">
              ${state.packed ? '☑' : '☐'}
            </span>
            <span class="font-medium text-slate-800 truncate ${state.packed ? 'line-through text-slate-400' : ''}">${item.title}</span>
            ${state.qty ? `<span class="text-slate-400 text-xs shrink-0">(${state.qty})</span>` : ''}
          </div>
          <span class="text-[11px] px-2 py-0.5 rounded border shrink-0 font-medium ${getStatusClass(state.status)}">${state.status}</span>
        `;
        ul.appendChild(li);
      });
      boxDiv.appendChild(ul);
    } else {
      const emptyMsg = document.createElement('p');
      emptyMsg.className = 'text-xs text-slate-400 italic py-2';
      emptyMsg.innerText = 'Noch keine Gegenstände zugewiesen.';
      boxDiv.appendChild(emptyMsg);
    }

    content.appendChild(boxDiv);
  }

  modal.classList.remove('hidden');
}

function closeBoxOverview() { document.getElementById('boxModal').classList.add('hidden'); }

// Starten beim Laden des Dokuments
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initApp);
} else {
  initApp();
}
