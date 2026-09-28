// Status direkt beim Start auf Gast setzen, falls nichts gespeichert ist
let currentUserRole = localStorage.getItem('userRole') || 'gast';

const ROLE_PASSWORDS = {
  helfer: '1',
  orga: '2',
  admin: '3'
};

// --- DARKMODE ENGINE ---
function initTheme() {
  const savedTheme = localStorage.getItem('theme');
  const systemPrefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;

  if (savedTheme === 'dark' || (!savedTheme && systemPrefersDark)) {
    applyDarkMode(true);
  } else {
    applyDarkMode(false);
  }
}

function applyDarkMode(isDark) {
  if (isDark) {
    document.documentElement.classList.add('dark');
    document.body.classList.add('dark');
  } else {
    document.documentElement.classList.remove('dark');
    document.body.classList.remove('dark');
  }
  updateThemeIcon(isDark);
}

function toggleTheme() {
  const isDarkCurrently = document.documentElement.classList.contains('dark');
  const newDarkState = !isDarkCurrently;
  
  localStorage.setItem('theme', newDarkState ? 'dark' : 'light');
  applyDarkMode(newDarkState);
}

function updateThemeIcon(isDark) {
  const icon = document.getElementById('themeToggleIcon');
  if (icon) {
    icon.innerText = isDark ? '☀️' : '🌙';
  }
}

function renderInventar() {
  const container = document.getElementById('inventarTablesContainer');
  if (!container || !window.inventarCategories) return;

  container.innerHTML = window.inventarCategories.map(cat => `
    <div class="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm">
      <div class="bg-slate-100 dark:bg-slate-800/80 px-4 py-3 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
        <h3 class="font-extrabold text-xs text-amber-600 dark:text-amber-400 uppercase tracking-wider">${cat.title}</h3>
      </div>
      <div class="overflow-x-auto">
        <table class="w-full text-left text-xs border-collapse">
          <thead>
            <tr class="border-b border-slate-200 dark:border-slate-800 text-[10px] font-bold uppercase text-slate-400 dark:text-slate-500 bg-slate-50/50 dark:bg-slate-900/50">
              <th class="py-2.5 px-4">GEGENSTAND</th>
              <th class="py-2.5 px-2 text-center w-16">BEDARF</th>
              <th class="py-2.5 px-2 text-center w-16">LAGER</th>
              <th class="py-2.5 px-2 text-center w-24">STATUS</th>
              <th class="py-2.5 px-2 w-32">WER</th>
              <th class="py-2.5 px-2 text-center w-12">PACK</th>
              <th class="py-2.5 px-2 text-center w-12">BOX</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-100 dark:divide-slate-800/60">
            ${cat.items.map(item => `
              <tr class="hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors">
                <td class="py-2.5 px-4 font-bold text-slate-800 dark:text-slate-200">
                  <div>${item.name}</div>${item.sub ? `<div class="text-[10px] font-normal text-slate-400 dark:text-slate-500">${item.sub}</div>` : ''}
                </td>
                <td class="py-2.5 px-2 text-center">
                  <span class="px-2 py-1 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg font-bold text-slate-700 dark:text-slate-300 text-[11px]">${item.bedarf}</span>
                </td>
                <td class="py-2.5 px-2 text-center">
                  <span class="px-2 py-1 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg font-bold text-slate-700 dark:text-slate-300 text-[11px]">${item.lager}</span>
                </td>
                <td class="py-2.5 px-2 text-center">
                  <span class="px-2 py-1 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-[10px] font-semibold text-slate-600 dark:text-slate-300">${item.status}</span>
                </td>
                <td class="py-2.5 px-2">
                  <input type="text" placeholder="Name..." value="${item.wer || ''}" class="w-full px-2 py-1 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-lg text-[11px] focus:outline-none focus:ring-1 focus:ring-amber-500">
                </td>
                <td class="py-2.5 px-2 text-center">
                  <input type="checkbox" ${item.pack ? 'checked' : ''} class="w-4 h-4 rounded border-slate-300 text-amber-500 focus:ring-amber-500">
                </td>
                <td class="py-2.5 px-2 text-center">
                  <span class="inline-block w-4 h-4 rounded bg-slate-200 dark:bg-slate-800 border border-slate-300 dark:border-slate-700"></span>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    </div>
  `).join('');
}

// --- LOGIN LOGIK ---
function tryLogin(role, inputId) {
  const input = document.getElementById(inputId);
  const password = input ? input.value.trim() : '';
  const errorBox = document.getElementById('loginErrorMessage');

  if (password === ROLE_PASSWORDS[role]) {
    if (errorBox) errorBox.classList.add('hidden');
    if (input) input.value = '';
    setRole(role);
  } else {
    if (errorBox) {
      errorBox.classList.remove('hidden');
      const errText = document.getElementById('loginErrorText');
      if (errText) errText.innerText = 'Falsches Passwort für die Rolle ' + role.toUpperCase() + '.';
    }
  }
}

function setRole(role) {
  currentUserRole = role;
  localStorage.setItem('userRole', role);
  applyRolePermissions(role);
}

// --- PERMISSIONS & GAST-MODUS ---
function applyRolePermissions(role) {
  currentUserRole = role;
  const burgerBtn = document.getElementById('burgerMenuBtn');
  const guestNotice = document.getElementById('guestLockNotice');
  const roleLabel = document.getElementById('roleLabel');
  const roleIcon = document.getElementById('roleIcon');

  if (roleLabel) {
    roleLabel.innerText = role === 'admin' ? '🟢 ADMIN' : (role === 'orga' ? '🔵 ORGA' : (role === 'helfer' ? '🟡 HELFER' : 'GAST'));
  }

  if (role === 'gast') {
    if (burgerBtn) burgerBtn.classList.add('hidden');
    if (guestNotice) guestNotice.classList.remove('hidden');
    if (roleIcon) roleIcon.innerText = '👁️';
    switchView('aushang');
  } else {
    if (burgerBtn) burgerBtn.classList.remove('hidden');
    if (guestNotice) guestNotice.classList.add('hidden');
    if (roleIcon) roleIcon.innerText = '🔓';
    switchView('aushang');
  }
}

// --- VIEWS & BURGER MENU ---
function switchView(viewName) {
  if (currentUserRole === 'gast' && viewName !== 'aushang' && viewName !== 'login') {
    return;
  }

  const views = document.querySelectorAll('main > div[id^="view"]');
  views.forEach(v => v.classList.add('hidden'));

  const targetId = 'view' + viewName.charAt(0).toUpperCase() + viewName.slice(1);
  const targetView = document.getElementById(targetId);
  if (targetView) {
    targetView.classList.remove('hidden');
  }

  const navModal = document.getElementById('navigationModal');
  if (navModal) navModal.classList.add('hidden');
}

function toggleBurgerMenu() {
  const navModal = document.getElementById('navigationModal');
  if (navModal) {
    navModal.classList.toggle('hidden');
  }
}

function openLightbox(imgSrc, title) {
  window.open(imgSrc, '_blank');
}

// Initialisierung sofort beim Aufruf
document.addEventListener('DOMContentLoaded', () => {
  initTheme();
  applyRolePermissions(currentUserRole);
});
