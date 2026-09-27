const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbzm4pz4LD6vwqwkDQXqIypYRVx9m49oliAevZPGolZYm_JKFmWN526TLE-2Z3fGP8tJ/exec";

let roleConfig = window.DEFAULT_ROLE_CONFIG || {};
let itemsData = window.DEFAULT_ITEMS || [];
let appState = { sales: { waffel: 0, punsch: 0 }, roshopImg: {} };
let currentRole = 'betrachter';
let activeFilterTag = 'ALL';

document.addEventListener('DOMContentLoaded', () => {
  loadFromLocal();
  itemsData.forEach(item => initItemState(item));
  
  renderChecklist();
  updatePunschRecipe();
  updateProgress();
  loadStateFromSheet();

  document.getElementById('searchInput')?.addEventListener('input', renderChecklist);
});

function toggleDarkMode() {
  document.documentElement.classList.toggle('dark');
}

function toggleBurgerMenu() {
  const drawer = document.getElementById('burgerDrawer');
  if (drawer) drawer.classList.toggle('hidden');
}

// ZENTRALES FULLPAGE SEITEN-UMSCHALTEN (KEINE MODALS MEHR)
function switchView(viewKey) {
  if (document.getElementById('burgerDrawer') && !document.getElementById('burgerDrawer').classList.contains('hidden')) {
    toggleBurgerMenu();
  }

  // Schutz für Admin Panel
  if (viewKey === 'adminpanel' && currentRole !== 'admin') {
    alert("Nur Admins haben Zugriff auf das Control Center!");
    return;
  }

  // Alle Views verbergen
  const allViews = ['Aushang', 'Inventar', 'Verkauf', 'Einkaufsliste', 'Verkabelung', 'Lagerbestand', 'Boxenuebersicht', 'Rezepte', 'Adminpanel'];
  allViews.forEach(v => {
    document.getElementById('view' + v)?.classList.add('hidden');
  });

  // Gewählte View anzeigen
  const targetKey = viewKey.charAt(0).toUpperCase() + viewKey.slice(1);
  const targetView = document.getElementById('view' + targetKey);
  if (targetView) {
    targetView.classList.remove('hidden');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  // Spezifische Renderer aufrufen
  if (viewKey === 'inventar') renderChecklist();
  if (viewKey === 'verkauf') updateSalesUI();
  if (viewKey === 'boxenuebersicht') renderBoxOverview();
  if (viewKey === 'lagerbestand') renderStockTable();
  if (viewKey === 'verkabelung') renderPowerPlanner();
  if (viewKey === 'einkaufsliste') renderShoppingTable();
  if (viewKey === 'adminpanel') renderAdminPermissions();
}

function closeModal(id) {
  document.getElementById(id)?.classList.add('hidden');
}

function openModal(id) {
  document.getElementById(id)?.classList.remove('hidden');
}

function setFilterTag(tag) {
  activeFilterTag = tag;
  const buttons = document.querySelectorAll('#filterTags button');
  
  buttons.forEach(btn => {
    btn.classList.remove('ring-2', 'ring-amber-500', 'scale-105');
  });

  if (event && event.target) {
    event.target.classList.add('ring-2', 'ring-amber-500', 'scale-105');
  }

  renderChecklist();
}

function loadFromLocal() {
  const local = JSON.parse(localStorage.getItem('sg_wm_state_v26')) || {};
  appState = local;
  if (!appState.sales) appState.sales = { waffel: 0, punsch: 0 };
  if (!appState.roshopImg) appState.roshopImg = {};
  if (appState.roleConfig) roleConfig = appState.roleConfig;

  renderRoshopImages();
}

async function loadStateFromSheet() {
  try {
    const res = await fetch(SCRIPT_URL + '?t=' + new Date().getTime());
    const cloudData = await res.json();
    if (cloudData && Object.keys(cloudData).length > 0) {
      appState = cloudData;
      if (!appState.sales) appState.sales = { waffel: 0, punsch: 0 };
      if (!appState.roshopImg) appState.roshopImg = {};
      localStorage.setItem('sg_wm_state_v26', JSON.stringify(appState));
      itemsData.forEach(item => initItemState(item));
      renderChecklist();
      renderRoshopImages();
      updateProgress();
      updateSalesUI();
      setSyncStatus(true);
    }
  } catch(e) { setSyncStatus(false); }
}

function setSyncStatus(isOk) {
  const el = document.getElementById('syncStatus');
  if (el) el.innerText = isOk ? "🟢 Synchronisiert" : "🟡 Offline Modus";
}

function initItemState(item) {
  if (!appState[item.id]) {
    appState[item.id] = { 
      status: 'Offen', 
      assignedTo: '', 
      packed: false, 
      boxNum: '', 
      reqQty: item.defaultQty || '1', 
      stockQty: item.defaultStockQty || '0', 
      bought: false, store: '', price: 0 
    };
  }
}

async function saveState() {
  localStorage.setItem('sg_wm_state_v26', JSON.stringify(appState));
  updateProgress();
  if (SCRIPT_URL) {
    try {
      await fetch(SCRIPT_URL, { method: "POST", headers: { "Content-Type": "text/plain;charset=utf-8" }, body: JSON.stringify(appState) });
      setSyncStatus(true);
    } catch (e) { setSyncStatus(false); }
  }
}

function canEdit(permKey) {
  if (currentRole === 'admin') return true;
  if (currentRole === 'betrachter') return false;
  return !!(roleConfig[currentRole] && roleConfig[currentRole][permKey]);
}

function renderChecklist() {
  const container = document.getElementById('checklist');
  if (!container) return;
  container.innerHTML = '';

  const search = (document.getElementById('searchInput')?.value || '').toLowerCase();
  const categories = [...new Set(itemsData.map(i => i.cat))];

  categories.forEach(cat => {
    const catItems = itemsData.filter(i => {
      initItemState(i);
      const st = appState[i.id];
      const matchSearch = i.title.toLowerCase().includes(search) || (st.assignedTo || '').toLowerCase().includes(search);
      
      let matchTag = true;
      if (activeFilterTag === 'GEPACKT') matchTag = st.packed;
      else if (activeFilterTag !== 'ALL') matchTag = st.status === activeFilterTag;

      return i.cat === cat && matchSearch && matchTag;
    });

    if (catItems.length > 0) {
      const card = document.createElement('div');
      card.className = 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 rounded-2xl p-4 shadow-sm border border-slate-200 dark:border-slate-800 mb-4';

      let rows = catItems.map(item => {
        const st = appState[item.id];
        const isDone = st.status === 'Erledigt';
        return `
          <tr class="border-b border-slate-100 dark:border-slate-800 text-xs hover:bg-slate-50 dark:hover:bg-slate-950 transition">
            <td class="py-2.5 px-2 font-bold ${isDone ? 'line-through text-slate-400' : ''}">
              ${item.title} ${item.details ? `<br><span class="text-[10px] text-slate-500 font-normal">${item.details}</span>` : ''}
            </td>
            <td class="py-2.5 px-1 text-center font-bold text-amber-600">
              <input type="text" ${!canEdit('canQty') ? 'disabled' : ''} value="${st.reqQty || '1'}" onchange="updateItem(${item.id}, 'reqQty', this.value)" class="w-10 text-center bg-slate-50 dark:bg-slate-950 border rounded p-1 text-xs" />
            </td>
            <td class="py-2.5 px-1 text-center font-bold text-emerald-500">
              <input type="text" ${!canEdit('canQty') ? 'disabled' : ''} value="${st.stockQty || '0'}" onchange="updateItem(${item.id}, 'stockQty', this.value)" class="w-10 text-center bg-slate-50 dark:bg-slate-950 border rounded p-1 text-xs" />
            </td>
            <td class="py-2.5 px-1">
              <select ${!canEdit('canStatus') ? 'disabled' : ''} onchange="updateItem(${item.id}, 'status', this.value)" class="border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-1 font-semibold text-xs bg-slate-50 dark:bg-slate-950 focus:outline-none">
                ${['Offen', 'Vorbereitet', 'Verteilt', 'Erledigt'].map(o => `<option value="${o}" ${st.status === o ? 'selected' : ''}>${o}</option>`).join('')}
              </select>
            </td>
            <td class="py-2.5 px-1">
              <input type="text" ${!canEdit('canName') ? 'disabled' : ''} value="${st.assignedTo || ''}" placeholder="Name..." onchange="updateItem(${item.id}, 'assignedTo', this.value)" class="border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 rounded-lg px-2 py-1 text-xs w-full focus:outline-none" />
            </td>
            <td class="py-2.5 px-1 text-center">
              <input type="checkbox" ${!canEdit('canPacked') ? 'disabled' : ''} ${st.packed ? 'checked' : ''} onchange="updateItem(${item.id}, 'packed', this.checked)" class="w-4 h-4 accent-emerald-500 cursor-pointer" />
            </td>
            <td class="py-2.5 px-1 text-center">
              <input type="number" ${!canEdit('canBox') ? 'disabled' : ''} min="1" max="12" value="${st.boxNum || ''}" onchange="updateItem(${item.id}, 'boxNum', this.value)" class="border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 rounded-lg text-center w-10 text-xs py-1 font-bold focus:outline-none" />
            </td>
          </tr>
        `;
      }).join('');

      card.innerHTML = `
        <div class="bg-amber-100/80 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800/60 rounded-xl px-3 py-2 mb-3">
          <h3 class="font-black text-xs uppercase tracking-wider text-amber-950 dark:text-amber-300">${cat}</h3>
        </div>
        <div class="overflow-x-auto">
          <table class="w-full text-left border-collapse">
            <thead>
              <tr class="text-[10px] uppercase bg-slate-50 dark:bg-slate-950 text-slate-500 font-extrabold border-b border-slate-200 dark:border-slate-800">
                <th class="p-2">Gegenstand</th>
                <th class="p-1 text-center">Bedarf</th>
                <th class="p-1 text-center">Lager</th>
                <th class="p-1">Status</th>
                <th class="p-1">Wer</th>
                <th class="p-1 text-center">Pack</th>
                <th class="p-1 text-center">Box</th>
              </tr>
            </thead>
            <tbody>${rows}</tbody>
          </table>
        </div>
      `;
      container.appendChild(card);
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
  const count = itemsData.filter(i => appState[i.id]?.status === 'Erledigt').length;
  const pct = total > 0 ? Math.round((count / total) * 100) : 0;
  if (document.getElementById('progressBar')) document.getElementById('progressBar').style.width = pct + '%';
  if (document.getElementById('progressText')) document.getElementById('progressText').innerText = pct + '% erledigt (' + count + '/' + total + ')';
}

function uploadRoshopImage(tag, input) {
  if (currentRole !== 'admin') { alert("Nur Admins dürfen Plakate hochladen!"); return; }
  if (input.files && input.files[0]) {
    const reader = new FileReader();
    reader.onload = function(e) {
      if (!appState.roshopImg) appState.roshopImg = {};
      appState.roshopImg[tag] = e.target.result;
      saveState();
      renderRoshopImages();
    };
    reader.readAsDataURL(input.files[0]);
  }
}

function renderRoshopImages() {
  ['samstag', 'sonntag'].forEach(tag => {
    const container = document.getElementById(tag === 'samstag' ? 'imgSamstagContainer' : 'imgSonntagContainer');
    if (container && appState.roshopImg && appState.roshopImg[tag]) {
      container.innerHTML = `<img src="${appState.roshopImg[tag]}" class="max-h-80 rounded-xl mx-auto border shadow-sm object-cover" />`;
    }
  });
}

function addSale(type, amount) {
  if (!canEdit('canCash')) { alert("Keine Berechtigung!"); return; }
  if (!appState.sales) appState.sales = { waffel: 0, punsch: 0 };
  appState.sales[type] = Math.max(0, (appState.sales[type] || 0) + amount);
  saveState();
  updateSalesUI();
}

function updateSalesUI() {
  const waffeln = appState.sales?.waffel || 0;
  const punsch = appState.sales?.punsch || 0;

  const priceWaffel = 2.50;
  const pricePunsch = 2.00;

  const waffelnEuro = waffeln * priceWaffel;
  const punschEuro = punsch * pricePunsch;
  const totalRev = waffelnEuro + punschEuro;
  const totalCount = waffeln + punsch;

  if (document.getElementById('countWaffeln')) document.getElementById('countWaffeln').innerText = waffeln;
  if (document.getElementById('countPunsch')) document.getElementById('countPunsch').innerText = punsch;
  
  if (document.getElementById('totalWaffelnEuro')) document.getElementById('totalWaffelnEuro').innerText = waffelnEuro.toFixed(2).replace('.', ',') + " € Einnahmen";
  if (document.getElementById('totalPunschEuro')) document.getElementById('totalPunschEuro').innerText = punschEuro.toFixed(2).replace('.', ',') + " € Einnahmen";

  if (document.getElementById('statTotalItems')) document.getElementById('statTotalItems').innerText = totalCount + " Stk.";
  if (document.getElementById('statTotalRevenue')) document.getElementById('statTotalRevenue').innerText = totalRev.toFixed(2).replace('.', ',') + " €";

  let bestseller = "-";
  if (waffeln > punsch) bestseller = "Waffeln 🥯";
  else if (punsch > waffeln) bestseller = "Punsch ☕";
  else if (waffeln > 0) bestseller = "Gleichstand";
  if (document.getElementById('statBestseller')) document.getElementById('statBestseller').innerText = bestseller;
}

function renderBoxOverview() {
  const container = document.getElementById('boxOverviewGrid');
  if (!container) return;
  container.innerHTML = '';

  for (let b = 1; b <= 12; b++) {
    const boxItems = itemsData.filter(i => appState[i.id]?.boxNum == b);
    const packedCount = boxItems.filter(i => appState[i.id]?.packed).length;

    const boxCard = document.createElement('div');
    boxCard.className = 'bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 p-3.5 rounded-xl space-y-2';
    boxCard.innerHTML = `
      <div class="flex justify-between items-center font-bold text-xs border-b border-slate-200 dark:border-slate-800 pb-1.5">
        <span>📦 Box ${b}</span>
        <span class="text-emerald-500 bg-emerald-500/10 px-2 py-0.5 rounded text-[10px] font-bold">${packedCount}/${boxItems.length} gepackt</span>
      </div>
      <ul class="text-xs space-y-1 list-disc pl-4 font-medium">
        ${boxItems.length > 0 ? boxItems.map(i => `<li class="${appState[i.id]?.packed ? 'line-through text-slate-400' : ''}">${i.title}</li>`).join('') : '<li class="italic text-slate-400 list-none">Keine Artikel zugewiesen</li>'}
      </ul>
    `;
    container.appendChild(boxCard);
  }
}

function renderStockTable() {
  const tbody = document.getElementById('stockTableBody');
  if (!tbody) return;
  tbody.innerHTML = '';

  itemsData.forEach(item => {
    const st = appState[item.id];
    if (st) {
      const tr = document.createElement('tr');
      tr.className = 'hover:bg-slate-50 dark:hover:bg-slate-950';
      tr.innerHTML = `
        <td class="p-2 font-bold text-slate-500">${item.cat}</td>
        <td class="p-2 font-bold">${item.title}</td>
        <td class="p-2 text-center font-bold text-amber-500">${st.reqQty || '1'}</td>
        <td class="p-2 text-center font-extrabold text-emerald-500">${st.stockQty || '0'}</td>
        <td class="p-2 text-center font-bold">${st.status}</td>
      `;
      tbody.appendChild(tr);
    }
  });
}

function renderPowerPlanner() {
  const pool = document.getElementById('powerPool');
  if (!pool) return;
  pool.innerHTML = '';

  const powerItems = itemsData.filter(i => i.defaultWatts || i.cat.includes('Elektrik') || i.cat.includes('Geräte'));
  powerItems.forEach(item => {
    const tag = document.createElement('div');
    tag.className = 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg px-2.5 py-1 font-bold flex items-center gap-2 shadow-sm';
    tag.innerHTML = `<span>${item.title}</span> <span class="bg-sky-500/10 text-sky-500 px-1.5 py-0.5 rounded text-[10px] font-extrabold">${item.defaultWatts || 0} W</span>`;
    pool.appendChild(tag);
  });
}

function renderShoppingTable() {
  const tbody = document.getElementById('shoppingTableBody');
  if (!tbody) return;
  tbody.innerHTML = '';

  let totalCost = 0;
  const shopItems = itemsData.filter(i => i.isShop || i.cat.includes('Zutaten') || i.cat.includes('Einkäufe'));

  shopItems.forEach(item => {
    const st = appState[item.id];
    const price = parseFloat(st.price || 0);
    totalCost += price;

    const tr = document.createElement('tr');
    tr.className = 'hover:bg-slate-50 dark:hover:bg-slate-950';
    tr.innerHTML = `
      <td class="p-2 text-center"><input type="checkbox" ${!canEdit('canShopBought') ? 'disabled' : ''} ${st.bought ? 'checked' : ''} onchange="updateItem(${item.id}, 'bought', this.checked)" class="w-4 h-4 accent-amber-500 rounded" /></td>
      <td class="p-2 font-bold">${item.title}</td>
      <td class="p-2 text-slate-500">${st.reqQty || '-'}</td>
      <td class="p-2 text-slate-500">${item.packageSize || '-'}</td>
      <td class="p-2"><input type="text" ${!canEdit('canShopStore') ? 'disabled' : ''} value="${st.store || ''}" placeholder="Laden..." onchange="updateItem(${item.id}, 'store', this.value)" class="border border-slate-200 dark:border-slate-800 bg-transparent rounded px-2 py-1 text-xs w-full" /></td>
      <td class="p-2 text-right"><input type="number" step="0.01" ${!canEdit('canShopPrice') ? 'disabled' : ''} value="${st.price || ''}" placeholder="0.00" onchange="updateItem(${item.id}, 'price', this.value); renderShoppingTable();" class="border border-slate-200 dark:border-slate-800 bg-transparent rounded px-2 py-1 text-xs w-20 text-right font-bold" /> €</td>
    `;
    tbody.appendChild(tr);
  });

  if (document.getElementById('shoppingTotalCost')) document.getElementById('shoppingTotalCost').innerText = totalCost.toFixed(2).replace('.',',') + ' €';
}

function updatePunschRecipe() {
  const liters = parseFloat(document.getElementById('punschCalcInput')?.value || 8);
  const factor = liters / 8.0;

  const list = document.getElementById('recipeIngredientsList');
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

function renderAdminPermissions() {
  const container = document.getElementById('adminPermissionsGrid');
  if (!container) return;
  container.innerHTML = '';

  ['helfer', 'orga'].forEach(role => {
    const roleBlock = document.createElement('div');
    roleBlock.className = 'bg-slate-50 dark:bg-slate-950 p-4 rounded-xl border border-slate-200 dark:border-slate-800 space-y-3';
    
    let checkboxes = Object.keys(roleConfig[role] || {})
      .filter(k => k.startsWith('can'))
      .map(perm => `
        <label class="flex items-center gap-2 text-xs font-semibold cursor-pointer">
          <input type="checkbox" ${roleConfig[role][perm] ? 'checked' : ''} onchange="toggleRolePerm('${role}', '${perm}', this.checked)" class="accent-amber-500 rounded" />
          <span>${perm}</span>
        </label>
      `).join('');

    roleBlock.innerHTML = `
      <h4 class="font-extrabold text-xs uppercase tracking-wider text-amber-500">${role.toUpperCase()} Einzelrechte</h4>
      <div class="grid grid-cols-2 sm:grid-cols-3 gap-2">${checkboxes}</div>
    `;
    container.appendChild(roleBlock);
  });
}

function toggleRolePerm(role, perm, val) {
  if (!roleConfig[role]) roleConfig[role] = {};
  roleConfig[role][perm] = val;
  appState.roleConfig = roleConfig;
  saveState();
}

function addNewItemPrompt() {
  const title = prompt("Name des neuen Gegenstands:");
  if (title) {
    const cat = prompt("Kategorie:", "📋 Sonstiges");
    const newId = Date.now();
    itemsData.push({ id: newId, cat: cat || "📋 Sonstiges", title: title });
    initItemState({ id: newId });
    saveState();
    renderChecklist();
  }
}

function downloadBackup() {
  const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(appState));
  const downloadAnchor = document.createElement('a');
  downloadAnchor.setAttribute("href", dataStr);
  downloadAnchor.setAttribute("download", "weihnachtsmarkt_backup.json");
  document.body.appendChild(downloadAnchor);
  downloadAnchor.click();
  downloadAnchor.remove();
}

function resetSeasonPrompt() {
  if (confirm("Möchtest du wirklich alle Haken und Einträge für die neue Saison zurücksetzen?")) {
    appState = { sales: { waffel: 0, punsch: 0 }, roshopImg: {} };
    saveState();
    location.reload();
  }
}

function selectRoleWithPassword(role) {
  if (role === 'betrachter') { currentRole = 'betrachter'; closeModal('roleModal'); applyRolePermissions(); return; }
  const pwd = prompt(`Passwort für ${role.toUpperCase()}:`);
  if (pwd === (roleConfig[role]?.pwd || (role === 'admin' ? 'SGJugend26' : ''))) {
    currentRole = role;
    closeModal('roleModal');
    applyRolePermissions();
  } else if (pwd !== null) {
    alert("Falsches Passwort!");
  }
}

function applyRolePermissions() {
  const badge = document.getElementById('roleBadge');
  if (badge) badge.innerText = `${currentRole.toUpperCase()}`;
  renderChecklist();
}
