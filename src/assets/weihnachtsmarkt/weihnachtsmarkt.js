const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbzm4pz4LD6vwqwkDQXqIypYRVx9m49oliAevZPGolZYm_JKFmWN526TLE-2Z3fGP8tJ/exec";

let roleConfig = window.DEFAULT_ROLE_CONFIG || {};
let itemsData = window.DEFAULT_ITEMS || [];
let appState = {};
let currentRole = 'betrachter';

document.addEventListener('DOMContentLoaded', () => {
  loadFromLocal();
  itemsData.forEach(item => initItemState(item));
  switchView('main');
  updateProgress();
  calculatePowerLoad();
  calculateSalesStats();
  applyRolePermissions();
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
      renderBoxOverview();
      updateProgress();
      setSyncStatus(true);
    }
  } catch(e) { setSyncStatus(false); }
}

function setSyncStatus(isOk) {
  const el = document.getElementById('syncStatus');
  if (el) el.innerText = isOk ? "🟢 Synced" : "🟡 Offline";
}

function initItemState(item) {
  if (!appState[item.id]) {
    appState[item.id] = { status: 'Offen', assignedTo: '', packed: false, boxNum: '', qty: item.defaultQty || '', stockQty: item.defaultStockQty || '' };
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

function toggleNavMenu() { document.getElementById('navDropdown')?.classList.toggle('hidden'); }

function switchView(v) {
  if (v === 'admin' && currentRole !== 'admin') {
    const pwd = prompt("Admin-Passwort:");
    if (pwd === roleConfig.admin?.pwd) { currentRole = 'admin'; applyRolePermissions(); }
    else { if(pwd !== null) alert("Falsch!"); return; }
  }

  document.getElementById('navDropdown')?.classList.add('hidden');
  ['viewChecklist', 'viewBoxes', 'viewRecipes', 'viewPower', 'viewSales', 'viewAdmin'].forEach(id => document.getElementById(id)?.classList.add('hidden'));

  const targetMap = { main: 'viewChecklist', boxes: 'viewBoxes', recipes: 'viewRecipes', power: 'viewPower', sales: 'viewSales', admin: 'viewAdmin' };
  document.getElementById(targetMap[v] || 'viewChecklist')?.classList.remove('hidden');

  if (v === 'main') renderChecklist();
  if (v === 'boxes') renderBoxOverview();
  if (v === 'recipes') updateRecipeScaling();
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
      card.className = 'bg-white text-slate-900 rounded-2xl p-4 shadow-sm border border-slate-200';

      let rows = catItems.map(item => {
        const st = appState[item.id];
        return `
          <tr class="border-b border-slate-100 text-xs">
            <td class="py-2.5 px-2 font-bold">${item.title} ${item.details ? `<br><span class="text-[10px] text-slate-500 font-normal">${item.details}</span>` : ''}</td>
            <td class="py-2.5 px-1">
              <select onchange="updateItem(${item.id}, 'status', this.value)" class="border rounded px-1 py-0.5 font-semibold text-xs bg-slate-50">
                ${['Offen', 'Vorbereitet', 'Verteilt', 'Erledigt'].map(o => `<option value="${o}" ${st.status === o ? 'selected' : ''}>${o}</option>`).join('')}
              </select>
            </td>
            <td class="py-2.5 px-1">
              <input type="text" value="${st.assignedTo || ''}" placeholder="Name..." onchange="updateItem(${item.id}, 'assignedTo', this.value)" class="border rounded px-1.5 py-0.5 text-xs w-full" />
            </td>
            <td class="py-2.5 px-1 text-center">
              <input type="checkbox" ${st.packed ? 'checked' : ''} onchange="updateItem(${item.id}, 'packed', this.checked)" class="w-4 h-4 accent-emerald-600 cursor-pointer" />
            </td>
            <td class="py-2.5 px-1 text-center">
              <input type="number" value="${st.boxNum || ''}" onchange="updateItem(${item.id}, 'boxNum', this.value)" class="border rounded text-center w-10 text-xs p-0.5" />
            </td>
          </tr>
        `;
      }).join('');

      card.innerHTML = `
        <h3 class="font-bold border-b pb-2 mb-2 text-sm text-slate-900">${cat}</h3>
        <div class="overflow-x-auto">
          <table class="w-full text-left">
            <thead>
              <tr class="text-[11px] uppercase bg-slate-100 font-bold text-slate-800">
                <th class="p-2">Gegenstand</th>
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
}

function updateProgress() {
  const total = itemsData.length;
  const count = itemsData.filter(i => appState[i.id]?.status === 'Erledigt').length;
  const pct = total > 0 ? Math.round((count / total) * 100) : 0;
  if (document.getElementById('progressBar')) document.getElementById('progressBar').style.width = pct + '%';
}

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

  Object.keys(boxes).sort((a,b)=>a-b).forEach(b => {
    const div = document.createElement('div');
    div.className = 'bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-1 text-xs';
    div.innerHTML = `<div class="font-bold text-amber-400 border-b border-slate-800 pb-1">Box #${b}</div><ul class="list-disc pl-4 text-slate-300">${boxes[b].map(t => `<li>${t}</li>`).join('')}</ul>`;
    container.appendChild(div);
  });
}

function updateRecipeScaling() {
  const liters = parseFloat(document.getElementById('punschLiters')?.value || 8);
  if (document.getElementById('punschLitersLabel')) document.getElementById('punschLitersLabel').innerText = `${liters} Liter`;
  const f = liters / 8.0;
  const list = document.getElementById('punschRecipeList');
  if (list) {
    list.innerHTML = `
      <li><b>${(2.0*f).toFixed(1)} l</b> Wasser</li>
      <li><b>${Math.ceil(10*f)} Btl.</b> Wintertee</li>
      <li><b>${(1.0*f).toFixed(1)} l</b> Orangensaft</li>
      <li><b>${(2.5*f).toFixed(1)} l</b> Apfelsaft</li>
      <li><b>${(2.5*f).toFixed(1)} l</b> Traubensaft</li>
    `;
  }
}

function calculatePowerLoad() {
  const w = parseInt(document.getElementById('pwrWaffel')?.value || 0) * 1200;
  const p = parseInt(document.getElementById('pwrPunsch')?.value || 0) * 1800;
  if (document.getElementById('totalWatts')) document.getElementById('totalWatts').innerText = `${w + p} Watt`;
}

function addSale(type, amount) {
  const el = document.getElementById(type === 'punsch' ? 'soldPunsch' : 'soldWaffles');
  if (!el) return;
  el.value = Math.max(0, parseInt(el.value || 0) + amount);
  calculateSalesStats();
}

function calculateSalesStats() {
  const p = parseInt(document.getElementById('soldPunsch')?.value || 0) * 2.0;
  const w = parseInt(document.getElementById('soldWaffles')?.value || 0) * 2.0;
  if (document.getElementById('statRevenue')) document.getElementById('statRevenue').innerText = (p + w).toFixed(2).replace('.',',') + ' €';
}

function toggleRoleModal() { document.getElementById('roleModal')?.classList.remove('hidden'); }
function closeRoleModal() { document.getElementById('roleModal')?.classList.add('hidden'); }

function selectRoleWithPassword(role) {
  if (role === 'betrachter') { currentRole = 'betrachter'; closeRoleModal(); applyRolePermissions(); return; }
  const pwd = prompt(`Passwort für ${role.toUpperCase()}:`);
  if (pwd === roleConfig[role]?.pwd) { currentRole = role; closeRoleModal(); applyRolePermissions(); }
  else if (pwd !== null) alert("Falsch!");
}

function applyRolePermissions() {
  const badge = document.getElementById('roleBadge');
  if (badge) badge.innerText = `Rolle: ${currentRole.toUpperCase()}`;
}

function saveRoleSettings() {
  if (document.getElementById('pwd_helfer')) roleConfig.helfer.pwd = document.getElementById('pwd_helfer').value;
  if (document.getElementById('pwd_orga')) roleConfig.orga.pwd = document.getElementById('pwd_orga').value;
  saveState();
  alert("Gespeichert!");
}
