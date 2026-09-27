const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbzm4pz4LD6vwqwkDQXqIypYRVx9m49oliAevZPGolZYm_JKFmWN526TLE-2Z3fGP8tJ/exec";

let roleConfig = window.DEFAULT_ROLE_CONFIG || {};
let itemsData = window.DEFAULT_ITEMS || [];
let appState = {};
let currentRole = 'betrachter';

document.addEventListener('DOMContentLoaded', () => {
  loadFromLocal();
  itemsData.forEach(item => initItemState(item));
  
  renderChecklist();
  updatePunschRecipe();
  updateProgress();
  loadStateFromSheet();

  document.getElementById('searchInput')?.addEventListener('input', renderChecklist);
});

function loadFromLocal() {
  const local = JSON.parse(localStorage.getItem('sg_wm_state_v26')) || {};
  appState = local;
  if (appState.roleConfig) roleConfig = appState.roleConfig;
}

async function loadStateFromSheet() {
  try {
    const res = await fetch(SCRIPT_URL + '?t=' + new Date().getTime());
    const cloudData = await res.json();
    if (cloudData && Object.keys(cloudData).length > 0) {
      appState = cloudData;
      localStorage.setItem('sg_wm_state_v26', JSON.stringify(appState));
      itemsData.forEach(item => initItemState(item));
      renderChecklist();
      updateProgress();
      setSyncStatus(true);
    }
  } catch(e) { setSyncStatus(false); }
}

function setSyncStatus(isOk) {
  const el = document.getElementById('syncStatus');
  if (el) el.innerText = isOk ? "🟢 Synced" : "🟡 Offline Mode";
}

function initItemState(item) {
  if (!appState[item.id]) {
    appState[item.id] = { status: 'Offen', assignedTo: '', packed: false, boxNum: '', qty: item.defaultQty || '', stockQty: item.defaultStockQty || '', bought: false, store: '', price: 0 };
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

function openModal(id) {
  document.getElementById(id)?.classList.remove('hidden');
  if (id === 'modalBoxes') renderBoxOverview();
  if (id === 'modalStock') renderStockTable();
  if (id === 'modalPower') renderPowerPlanner();
  if (id === 'modalShopping') renderShoppingTable();
}

function closeModal(id) {
  document.getElementById(id)?.classList.add('hidden');
}

function updatePunschRecipe() {
  const liters = parseFloat(document.getElementById('punschCalcInput')?.value || 8);
  if (document.getElementById('recipeLitersLabel')) document.getElementById('recipeLitersLabel').innerText = `${liters} Liter`;
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

function renderChecklist() {
  const container = document.getElementById('checklist');
  if (!container) return;
  container.innerHTML = '';

  const search = (document.getElementById('searchInput')?.value || '').toLowerCase();
  const categories = [...new Set(itemsData.map(i => i.cat))];

  categories.forEach(cat => {
    const catItems = itemsData.filter(i => {
      initItemState(i);
      return i.cat === cat && i.title.toLowerCase().includes(search);
    });

    if (catItems.length > 0) {
      const card = document.createElement('div');
      card.className = 'bg-white text-slate-900 rounded-2xl p-4 shadow-sm border border-slate-200 mb-4';

      let rows = catItems.map(item => {
        const st = appState[item.id];
        const isDone = st.status === 'Erledigt';
        return `
          <tr class="border-b border-slate-100 text-xs hover:bg-slate-50 transition">
            <td class="py-2.5 px-2 font-bold ${isDone ? 'line-through text-slate-400' : 'text-slate-900'}">
              ${item.title} ${item.details ? `<br><span class="text-[10px] text-slate-500 font-normal">${item.details}</span>` : ''}
            </td>
            <td class="py-2.5 px-1">
              <select onchange="updateItem(${item.id}, 'status', this.value)" class="border rounded-lg px-2 py-1 font-semibold text-xs ${getStatusClass(st.status)}">
                ${['Offen', 'Vorbereitet', 'Verteilt', 'Erledigt'].map(o => `<option value="${o}" ${st.status === o ? 'selected' : ''}>${o}</option>`).join('')}
              </select>
            </td>
            <td class="py-2.5 px-1">
              <input type="text" value="${st.assignedTo || ''}" placeholder="Name..." onchange="updateItem(${item.id}, 'assignedTo', this.value)" class="border border-slate-300 rounded-lg px-2 py-1 text-xs w-full text-slate-900" />
            </td>
            <td class="py-2.5 px-1 text-center">
              <input type="checkbox" ${st.packed ? 'checked' : ''} onchange="updateItem(${item.id}, 'packed', this.checked)" class="w-4 h-4 accent-emerald-600 cursor-pointer" />
            </td>
            <td class="py-2.5 px-1 text-center">
              <input type="number" min="1" max="12" value="${st.boxNum || ''}" onchange="updateItem(${item.id}, 'boxNum', this.value)" class="border border-slate-300 rounded-lg text-center w-10 text-xs py-1 text-slate-900 font-bold" />
            </td>
          </tr>
        `;
      }).join('');

      card.innerHTML = `
        <h3 class="font-bold border-b pb-2 mb-2 text-sm text-slate-900">${cat}</h3>
        <div class="overflow-x-auto">
          <table class="w-full text-left border-collapse">
            <thead>
              <tr class="text-[11px] uppercase bg-slate-100 font-extrabold text-slate-700 border-b">
                <th class="p-2">Gegenstand</th>
                <th class="p-1 w-[20%]">Status</th>
                <th class="p-1 w-[20%]">Wer</th>
                <th class="p-1 text-center w-[10%]">Pack</th>
                <th class="p-1 text-center w-[10%]">Box</th>
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

function getStatusClass(s) {
  if (s === 'Vorbereitet') return 'bg-amber-100 text-amber-900 border-amber-300';
  if (s === 'Verteilt') return 'bg-sky-100 text-sky-900 border-sky-300';
  if (s === 'Erledigt') return 'bg-emerald-100 text-emerald-900 border-emerald-300';
  return 'bg-slate-100 text-slate-800 border-slate-300';
}

function updateProgress() {
  const total = itemsData.length;
  const count = itemsData.filter(i => appState[i.id]?.status === 'Erledigt').length;
  const pct = total > 0 ? Math.round((count / total) * 100) : 0;
  if (document.getElementById('progressBar')) document.getElementById('progressBar').style.width = pct + '%';
  if (document.getElementById('progressText')) document.getElementById('progressText').innerText = pct + '% erledigt (' + count + '/' + total + ')';
}

function renderBoxOverview() {
  const container = document.getElementById('boxOverviewGrid');
  if (!container) return;
  container.innerHTML = '';

  for (let b = 1; b <= 12; b++) {
    const boxItems = itemsData.filter(i => appState[i.id]?.boxNum == b);
    const packedCount = boxItems.filter(i => appState[i.id]?.packed).length;

    const boxCard = document.createElement('div');
    boxCard.className = 'bg-slate-50 border border-slate-200/80 p-3.5 rounded-xl space-y-2';
    boxCard.innerHTML = `
      <div class="flex justify-between items-center font-bold text-xs text-slate-800 border-b pb-1.5">
        <span>📦 Box ${b}</span>
        <span class="text-emerald-800 bg-emerald-100 border border-emerald-300 px-2 py-0.5 rounded-md text-[10px] font-bold">${packedCount}/${boxItems.length} gepackt</span>
      </div>
      <ul class="text-xs text-slate-600 space-y-1 list-disc pl-4 font-medium">
        ${boxItems.length > 0 ? boxItems.map(i => `<li class="${appState[i.id]?.packed ? 'line-through text-slate-400' : ''}">${i.title}</li>`).join('') : '<li class="italic text-slate-400 list-none">Noch keine Gegenstände dieser Box zugewiesen.</li>'}
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
    if (st && st.stockQty) {
      const tr = document.createElement('tr');
      tr.className = 'hover:bg-slate-50';
      tr.innerHTML = `
        <td class="p-2.5 font-bold text-slate-500">${item.cat}</td>
        <td class="p-2.5 font-bold text-slate-900">${item.title}</td>
        <td class="p-2.5 text-center font-extrabold text-amber-800 bg-amber-50">${st.stockQty}</td>
        <td class="p-2.5 text-center text-slate-500 font-bold">${st.qty || '-'}</td>
        <td class="p-2.5 text-center font-bold text-slate-700">${st.status}</td>
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
    tag.className = 'bg-white border border-slate-300 rounded-lg px-2.5 py-1 font-bold text-slate-800 shadow-sm flex items-center gap-2 cursor-pointer hover:border-sky-400';
    tag.innerHTML = `<span>${item.title}</span> <span class="bg-sky-100 text-sky-800 px-1.5 py-0.5 rounded text-[10px] font-extrabold">${item.defaultWatts || 0} W</span>`;
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
    tr.className = 'hover:bg-slate-50';
    tr.innerHTML = `
      <td class="p-2.5 text-center"><input type="checkbox" ${st.bought ? 'checked' : ''} onchange="updateItem(${item.id}, 'bought', this.checked)" class="w-4 h-4 accent-amber-600 rounded cursor-pointer" /></td>
      <td class="p-2.5 font-bold text-slate-900">${item.title}</td>
      <td class="p-2.5 text-slate-600">${st.qty || '-'}</td>
      <td class="p-2.5 text-slate-500">${item.packageSize || '-'}</td>
      <td class="p-2.5 text-center font-bold">1x</td>
      <td class="p-2.5"><input type="text" value="${st.store || ''}" placeholder="Geschäft..." onchange="updateItem(${item.id}, 'store', this.value)" class="border border-slate-300 rounded-lg px-2 py-1 text-xs w-full text-slate-900" /></td>
      <td class="p-2.5 text-right"><input type="number" step="0.01" value="${st.price || ''}" placeholder="0.00" onchange="updateItem(${item.id}, 'price', this.value); renderShoppingTable();" class="border border-slate-300 rounded-lg px-2 py-1 text-xs w-20 text-right text-slate-900 font-bold" /> €</td>
      <td class="p-2.5 text-right font-extrabold text-slate-900">${price.toFixed(2).replace('.',',')} €</td>
    `;
    tbody.appendChild(tr);
  });

  if (document.getElementById('shoppingTotalCost')) document.getElementById('shoppingTotalCost').innerText = totalCost.toFixed(2).replace('.',',') + ' €';
}

function uploadRoshopImage(tag, input) {
  if (input.files && input.files[0]) {
    const reader = new FileReader();
    reader.onload = function(e) {
      const container = document.getElementById(tag === 'samstag' ? 'imgSamstagContainer' : 'imgSonntagContainer');
      if (container) container.innerHTML = `<img src="${e.target.result}" class="max-h-56 rounded-xl mx-auto border shadow-sm object-cover" />`;
    };
    reader.readAsDataURL(input.files[0]);
  }
}

function addNewItemPrompt() {
  const title = prompt("Name des neuen Gegenstands:");
  if (title) {
    const cat = prompt("Kategorie (z.B. 📦 Material & Befestigung):", "📋 Sonstiges");
    const newId = Date.now();
    itemsData.push({ id: newId, cat: cat || "📋 Sonstiges", title: title });
    initItemState({ id: newId });
    saveState();
    renderChecklist();
  }
}

function transferIngredientsToShopping() {
  alert("Zutaten wurden erfolgreich mit der Einkaufsliste synchronisiert!");
  openModal('modalShopping');
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

function uploadBackup() {
  const input = document.createElement('input');
  input.type = 'file';
  input.onchange = e => {
    const file = e.target.files[0];
    const reader = new FileReader();
    reader.readAsText(file, 'UTF-8');
    reader.onload = readerEvent => {
      appState = JSON.parse(readerEvent.target.result);
      saveState();
      location.reload();
    };
  };
  input.click();
}

function changePasswordPrompt() {
  const newPwd = prompt("Neues Passwort für Admin:");
  if (newPwd) { roleConfig.admin.pwd = newPwd; saveState(); alert("Passwort geändert!"); }
}

function resetSeasonPrompt() {
  if (confirm("Möchtest du wirklich alle Haken und Einträge für die neue Saison zurücksetzen?")) {
    appState = {};
    saveState();
    location.reload();
  }
}

function toggleRoleModal() { openModal('roleModal'); }
function selectRoleWithPassword(role) {
  if (role === 'betrachter') { currentRole = 'betrachter'; closeModal('roleModal'); applyRolePermissions(); return; }
  const pwd = prompt(`Passwort für ${role.toUpperCase()}:`);
  if (pwd === roleConfig[role]?.pwd) { currentRole = role; closeModal('roleModal'); applyRolePermissions(); }
  else if (pwd !== null) alert("Falsches Passwort!");
}

function applyRolePermissions() {
  const badge = document.getElementById('roleBadge');
  if (badge) badge.innerText = `${currentRole.toUpperCase()}`;
}
