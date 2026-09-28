// ==========================================
// SG BARNSTORF WEIHNACHTSMARKT - MAIN ENGINE
// ==========================================

const GOOGLE_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbyQg2LmxT_UbLXjFVKrNf9gXnqgk_ku4V_P1SZeSGqphn-WRTYI3a9l5szzkDfqEE881Q/exec';

// Globale Zustandsvariablen
window.currentUserRole = localStorage.getItem('userRole') || 'gast';
window.inventarData = [];
window.isEditMode = false;
window.currentFilterStatus = 'alle';
window.currentSearchTerm = '';
window.onlyPackedFilter = false;

// ------------------------------------------
// 1. THEME ENGINE (DARK / LIGHT MODE)
// ------------------------------------------
window.initTheme = function() {
  const savedTheme = localStorage.getItem('theme');
  const systemPrefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
  window.applyDarkMode(savedTheme === 'dark' || (!savedTheme && systemPrefersDark));
};

window.applyDarkMode = function(isDark) {
  if (isDark) {
    document.documentElement.classList.add('dark');
    if (document.body) document.body.classList.add('dark');
  } else {
    document.documentElement.classList.remove('dark');
    if (document.body) document.body.classList.remove('dark');
  }
  const icon = document.getElementById('themeToggleIcon');
  if (icon) icon.innerText = isDark ? '☀️' : '🌙';
};

window.toggleTheme = function() {
  const isDarkCurrently = document.documentElement.classList.contains('dark');
  const newDarkState = !isDarkCurrently;
  localStorage.setItem('theme', newDarkState ? 'dark' : 'light');
  window.applyDarkMode(newDarkState);
};

// ------------------------------------------
// 2. NAVIGATION & ROLLENMANAGEMENT
// ------------------------------------------
window.switchView = function(viewName) {
  // Gäste dürfen nur Aushang und Login sehen
  if (window.currentUserRole === 'gast' && viewName !== 'aushang' && viewName !== 'login') {
    alert('Bitte melde dich an, um auf diesen Bereich zuzugreifen.');
    return;
  }

  // Alle Ansichten ausblenden
  const views = document.querySelectorAll('main > div[id^="view"]');
  views.forEach(v => v.classList.add('hidden'));

  // Ziel-Ansicht einblenden
  const targetId = 'view' + viewName.charAt(0).toUpperCase() + viewName.slice(1);
  const targetView = document.getElementById(targetId);
  if (targetView) {
    targetView.classList.remove('hidden');
    if (viewName === 'inventar') {
      window.loadInventarFromGoogleSheets();
    }
  }

  // Burger-Menü nach Klick schließen
  const navModal = document.getElementById('navigationModal');
  if (navModal) navModal.classList.add('hidden');
};

window.toggleBurgerMenu = function() {
  const navModal = document.getElementById('navigationModal');
  if (navModal) {
    navModal.classList.toggle('hidden');
  }
};

window.tryLogin = function(role, inputId) {
  const passwords = { helfer: '1', orga: '2', admin: '3' };
  const input = document.getElementById(inputId);
  const password = input ? input.value.trim() : '';
  const errorBox = document.getElementById('loginErrorMessage');

  if (password === passwords[role]) {
    if (errorBox) errorBox.classList.add('hidden');
    if (input) input.value = '';
    window.setRole(role);
  } else if (errorBox) {
    errorBox.classList.remove('hidden');
    const errText = document.getElementById('loginErrorText');
    if (errText) errText.innerText = 'Falsches Passwort.';
  }
};

window.setRole = function(role) {
  window.currentUserRole = role;
  localStorage.setItem('userRole', role);
  window.applyRolePermissions(role);
};

window.applyRolePermissions = function(role) {
  window.currentUserRole = role;
  const burgerBtn = document.getElementById('burgerMenuBtn');
  const guestNotice = document.getElementById('guestLockNotice');
  const roleLabel = document.getElementById('roleLabel');
  const roleIcon = document.getElementById('roleIcon');
  const adminEditBtn = document.getElementById('adminInventarEditBtn');

  if (roleLabel) {
    roleLabel.innerText = role === 'admin' ? '🟢 ADMIN' : (role === 'orga' ? '🔵 ORGA' : (role === 'helfer' ? '🟡 HELFER' : 'GAST'));
  }

  if (adminEditBtn) {
    if (role === 'admin' || role === 'orga') adminEditBtn.classList.remove('hidden');
    else {
      adminEditBtn.classList.add('hidden');
      window.isEditMode = false;
    }
  }

  if (role === 'gast') {
    if (burgerBtn) burgerBtn.classList.add('hidden');
    if (guestNotice) guestNotice.classList.remove('hidden');
    if (roleIcon) roleIcon.innerText = '👁️';
    window.switchView('aushang');
  } else {
    if (burgerBtn) burgerBtn.classList.remove('hidden');
    if (guestNotice) guestNotice.classList.add('hidden');
    if (roleIcon) roleIcon.innerText = '🔓';
    window.switchView('aushang');
  }

  // Erneutes Rendern des Inventars
  if (window.inventarData && window.inventarData.length > 0) {
    window.renderInventar();
  }
};

// ------------------------------------------
// 3. INVENTAR & GOOGLE SHEETS SYSTEM
// ------------------------------------------
window.loadInventarFromGoogleSheets = async function() {
  const progressText = document.getElementById('inventarProgressText');
  if (progressText) progressText.innerText = 'Lade Daten...';

  // Fallback auf die lokalen Beispieldaten aus `weihnachtsmarkt-data.js`
  if ((!window.inventarData || window.inventarData.length === 0) && window.inventarCategories) {
    window.inventarData = JSON.parse(JSON.stringify(window.inventarCategories));
  }

  try {
    const res = await fetch(GOOGLE_SCRIPT_URL);
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data) && data.length > 0) {
        window.inventarData = data;
      }
    }
  } catch (e) {
    console.warn('Google Sheets Offline/Fehler - nutze lokale Daten:', e);
  }

  window.renderInventar();
};

window.setInventarFilter = function(filterStatus) {
  window.currentFilterStatus = filterStatus;
  window.onlyPackedFilter = false;
  window.updateFilterButtonsUI();
  window.renderInventar();
};

window.togglePackedFilter = function() {
  window.onlyPackedFilter = !window.onlyPackedFilter;
  window.updateFilterButtonsUI();
  window.renderInventar();
};

window.handleInventarSearch = function(val) {
  window.currentSearchTerm = (val || '').toLowerCase().trim();
  window.renderInventar();
};

window.updateFilterButtonsUI = function() {
  const buttons = document.querySelectorAll('[data-filter-btn]');
  buttons.forEach(btn => {
    const status = btn.getAttribute('data-filter-btn');
    if (status === 'packed') {
      if (window.onlyPackedFilter) {
        btn.className = "px-3 py-1.5 rounded-lg text-xs font-bold transition bg-amber-500/20 text-amber-300 border border-amber-500/50";
      } else {
        btn.className = "px-3 py-1.5 rounded-lg text-xs font-medium transition bg-slate-800 text-slate-300 hover:bg-slate-700 border border-slate-700";
      }
    } else {
      if (!window.onlyPackedFilter && window.currentFilterStatus === status) {
        btn.className = "px-3 py-1.5 rounded-lg text-xs font-bold transition bg-amber-500 text-slate-950 shadow-md";
      } else {
        btn.className = "px-3 py-1.5 rounded-lg text-xs font-medium transition bg-slate-800 text-slate-300 hover:bg-slate-700 border border-slate-700";
      }
    }
  });
};

window.renderInventar = function() {
  const container = document.getElementById('inventarTablesContainer');
  if (!container) return;

  if (!window.inventarData || window.inventarData.length === 0) {
    // Falls noch keine Daten vorhanden sind, mit lokaler Data initialisieren
    if (window.inventarCategories) {
      window.inventarData = JSON.parse(JSON.stringify(window.inventarCategories));
    } else {
      container.innerHTML = '<div class="p-8 text-center text-slate-400 text-sm">Keine Inventardaten vorhanden.</div>';
      return;
    }
  }

  let totalItems = 0;
  let completedItems = 0;
  let html = '';

  const isReadonly = window.currentUserRole === 'gast';

  window.inventarData.forEach((cat, catIdx) => {
    // Filterung der Items nach Suche und Status-Buttons
    const matchingItems = (cat.items || []).filter(item => {
      totalItems++;
      if (item.status === 'Erledigt' || item.pack) {
        completedItems++;
      }

      // 1. Textsuche
      if (window.currentSearchTerm) {
        const matchName = (item.name || '').toLowerCase().includes(window.currentSearchTerm);
        const matchSub = (item.sub || '').toLowerCase().includes(window.currentSearchTerm);
        const matchWer = (item.wer || '').toLowerCase().includes(window.currentSearchTerm);
        const matchBox = (item.box || '').toLowerCase().includes(window.currentSearchTerm);
        if (!matchName && !matchSub && !matchWer && !matchBox) return false;
      }

      // 2. Gepackt-Filter
      if (window.onlyPackedFilter) {
        return !!item.pack;
      }

      // 3. Status-Filter
      if (window.currentFilterStatus !== 'alle') {
        const itemStatus = (item.status || 'Offen').toLowerCase();
        if (itemStatus !== window.currentFilterStatus.toLowerCase()) return false;
      }

      return true;
    });

    // Wenn nach Filterung Items in der Kategorie übrig sind
    if (matchingItems.length > 0) {
      html += `
        <div class="bg-slate-900/90 rounded-2xl border border-slate-800/80 shadow-lg overflow-hidden">
          <div class="px-5 py-3.5 bg-slate-900 border-b border-slate-800/80 flex items-center justify-between">
            <h3 class="text-sm font-black tracking-wide text-amber-400 uppercase flex items-center gap-2">
              ${escapeHtml(cat.title)}
            </h3>
            <span class="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 border border-slate-700">
              ${matchingItems.length} Einträge
            </span>
          </div>
          <div class="overflow-x-auto">
            <table class="w-full text-left border-collapse text-xs">
              <thead>
                <tr class="border-b border-slate-800 text-[10px] font-extrabold uppercase text-slate-400 tracking-wider bg-slate-950/40">
                  <th class="py-2.5 px-4">Gegenstand</th>
                  <th class="py-2.5 px-2 text-center w-16">Bedarf</th>
                  <th class="py-2.5 px-2 text-center w-16">Lager</th>
                  <th class="py-2.5 px-2 w-32">Status</th>
                  <th class="py-2.5 px-2 w-44">Wer</th>
                  <th class="py-2.5 px-2 text-center w-14">Pack</th>
                  <th class="py-2.5 px-2 w-20">Box</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-slate-800/60">
      `;

      cat.items.forEach((item) => {
        const itemIdx = cat.items.indexOf(item);
        if (!matchingItems.includes(item)) return;

        html += `
          <tr class="hover:bg-slate-800/40 transition">
            <td class="py-2 px-4 font-semibold text-slate-100">
              <div class="leading-tight">${escapeHtml(item.name)}</div>
              ${item.sub ? `<div class="text-[10px] font-normal text-slate-400 mt-0.5">${escapeHtml(item.sub)}</div>` : ''}
            </td>
            <td class="py-2 px-2 text-center">
              <input type="number" value="${item.bedarf ?? 1}" min="0" ${isReadonly ? 'disabled' : ''}
                onchange="window.updateInventarItem(${catIdx}, ${itemIdx}, 'bedarf', parseInt(this.value) || 0)"
                class="w-12 text-center bg-slate-950/80 border border-slate-700/70 rounded-md py-1 px-1 text-slate-100 font-medium focus:border-amber-500 focus:outline-none disabled:opacity-60" />
            </td>
            <td class="py-2 px-2 text-center">
              <input type="number" value="${item.lager ?? 0}" min="0" ${isReadonly ? 'disabled' : ''}
                onchange="window.updateInventarItem(${catIdx}, ${itemIdx}, 'lager', parseInt(this.value) || 0)"
                class="w-12 text-center bg-slate-950/80 border border-slate-700/70 rounded-md py-1 px-1 text-emerald-400 font-bold focus:border-amber-500 focus:outline-none disabled:opacity-60" />
            </td>
            <td class="py-2 px-2">
              <select ${isReadonly ? 'disabled' : ''}
                onchange="window.updateInventarItem(${catIdx}, ${itemIdx}, 'status', this.value)"
                class="w-full bg-slate-950/80 border border-slate-700/70 rounded-md py-1 px-2 text-slate-200 font-medium focus:border-amber-500 focus:outline-none disabled:opacity-60">
                <option value="Offen" ${item.status === 'Offen' ? 'selected' : ''}>Offen</option>
                <option value="Vorbereitet" ${item.status === 'Vorbereitet' ? 'selected' : ''}>Vorbereitet</option>
                <option value="Verteilt" ${item.status === 'Verteilt' ? 'selected' : ''}>Verteilt</option>
                <option value="Erledigt" ${item.status === 'Erledigt' ? 'selected' : ''}>Erledigt</option>
              </select>
            </td>
            <td class="py-2 px-2">
              <input type="text" value="${escapeHtml(item.wer || '')}" placeholder="Name..." ${isReadonly ? 'disabled' : ''}
                onchange="window.updateInventarItem(${catIdx}, ${itemIdx}, 'wer', this.value)"
                class="w-full bg-slate-950/80 border border-slate-700/70 rounded-md py-1 px-2 text-slate-200 placeholder-slate-500 focus:border-amber-500 focus:outline-none disabled:opacity-60" />
            </td>
            <td class="py-2 px-2 text-center">
              <input type="checkbox" ${item.pack ? 'checked' : ''} ${isReadonly ? 'disabled' : ''}
                onchange="window.updateInventarItem(${catIdx}, ${itemIdx}, 'pack', this.checked)"
                class="w-4 h-4 rounded bg-slate-950 border-slate-700 text-amber-500 focus:ring-amber-500 focus:ring-offset-slate-900 accent-amber-500 disabled:opacity-60 cursor-pointer" />
            </td>
            <td class="py-2 px-2">
              <input type="text" value="${escapeHtml(item.box || '')}" placeholder="" ${isReadonly ? 'disabled' : ''}
                onchange="window.updateInventarItem(${catIdx}, ${itemIdx}, 'box', this.value)"
                class="w-full bg-slate-950/80 border border-slate-700/70 rounded-md py-1 px-1.5 text-center text-slate-200 uppercase focus:border-amber-500 focus:outline-none disabled:opacity-60" />
            </td>
          </tr>
        `;
      });

      html += `
              </tbody>
            </table>
          </div>
        </div>
      `;
    }
  });

  container.innerHTML = html || '<div class="p-8 text-center text-slate-400 text-sm">Keine passenden Einträge für diesen Filter gefunden.</div>';

  // Live Fortschrittsanzeige berechnen
  const percent = totalItems > 0 ? Math.round((completedItems / totalItems) * 100) : 0;
  const progressText = document.getElementById('inventarProgressText');
  if (progressText) {
    progressText.innerText = `${percent}% erledigt (${completedItems}/${totalItems})`;
  }
};

window.updateInventarItem = function(catIdx, itemIdx, field, val) {
  if (!window.inventarData[catIdx] || !window.inventarData[catIdx].items[itemIdx]) return;

  window.inventarData[catIdx].items[itemIdx][field] = val;

  // Hintergrund-Sync an Google Sheets
  window.syncWithGoogleSheets();

  // Fortschritts- & UI-Update
  window.renderInventar();
};

window.syncWithGoogleSheets = async function() {
  try {
    await fetch(GOOGLE_SCRIPT_URL, {
      method: 'POST',
      mode: 'no-cors',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(window.inventarData)
    });
  } catch (e) {
    console.warn('Fehler beim Speichern in Google Sheets:', e);
  }
};

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

// ------------------------------------------
// 4. AUTOSTART BEI SEITENAUFRUF
// ------------------------------------------
document.addEventListener('DOMContentLoaded', () => {
  window.initTheme();
  window.applyRolePermissions(window.currentUserRole);
});
