/* Hub der SG Barnstorf: gemeinsame Anmeldung und Auswahl der Systeme.
   Die Anmeldung gilt für alle Systeme (gleicher Browser-Speicher, gleiches Konto-System im Script). */
(function () {
  'use strict';
  var API = 'https://script.google.com/macros/s/AKfycbz5_j65a248FUib9POAAWryFHFh6-613bhVpXUaBuTIpDEHx_kUOrOnh-NVhBduT8Ks/exec';
  var root = document.getElementById('hubRoot');
  if (!root) return;
  var PAGE = root.getAttribute('data-system') || '';   // '' = Startseite, sonst die Kennung des Systems (z. B. jugend)
  var HUB_URL = '/intranet/';
  var state = { session: lsGet('session4', null) || { token: '', user: '' }, me: null, systems: [], roles: [], mode: 'user', error: '', busy: false, loaded: false, offline: false };

  function lsGet(k, d) { try { var r = localStorage.getItem(k); return r === null ? d : JSON.parse(r); } catch (e) { return d; } }
  function lsSet(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* egal */ } }
  function esc(s) { return String(s === undefined || s === null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function token() { return (state.session && state.session.token) || ''; }
  function get(action, params) {
    var qs = new URLSearchParams(Object.assign({ action: action }, params || {}));
    if (token() && !qs.has('token')) qs.set('token', token());
    return fetch(API + '?' + qs.toString(), { cache: 'no-store' }).then(function (r) { return r.ok ? r.json() : null; }).catch(function () { return null; });
  }
  function post(payload) {
    return fetch(API, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify(payload) })
      .then(function (r) { return r.ok ? r.json() : null; }).catch(function () { return null; });
  }
  function has(perm) { return !!(state.me && state.me.perms && state.me.perms.indexOf(perm) >= 0); }

  function load() {
    state.loaded = false; render();
    var pm = token() ? get('me') : Promise.resolve(null);
    return pm.then(function (me) {
      if (me && me.status === 'success') state.me = me;
      else {
        state.me = null;
        if (me && me.code === 'auth' && token()) { state.session = { token: '', user: '' }; lsSet('session4', state.session); }
      }
      return Promise.all([get('systems'), get('roles')]);
    }).then(function (res) {
      var sys = res[0], roles = res[1];
      if (!sys || sys.status !== 'success') { state.offline = true; state.systems = []; }
      else { state.offline = false; state.systems = sys.systems || []; }
      state.roles = roles && roles.roles ? roles.roles.filter(function (r) { return r.id !== 'gast' && r.hasPw; }) : [];
      state.loaded = true; render();
    });
  }

  function loginSubmit(ev) {
    if (ev && ev.preventDefault) ev.preventDefault();
    if (state.busy) return;
    var f = root.querySelector('form.hub-login');
    var payload = { action: 'login', kind: state.mode };
    if (state.mode === 'user') { payload.name = f.elements.name.value; payload.password = f.elements.password.value; }
    else { payload.role = f.elements.role.value; payload.password = f.elements.password.value; }
    state.busy = true; state.error = ''; render();
    post(payload).then(function (res) {
      state.busy = false;
      if (!res) { state.error = 'Keine Verbindung. Zum Anmelden wird Internet gebraucht.'; render(); return; }
      if (res.status !== 'success') { state.error = res.message || 'Falsche Anmeldedaten.'; render(); return; }
      state.session = { token: res.token, user: res.user || '', roles: res.roles || [], perms: res.user ? res.perms : [] };
      lsSet('session4', state.session);
      try { localStorage.setItem('userRole', res.role.id); } catch (e) { /* egal */ }
      load();
    });
  }
  function logout() {
    var t = token();
    state.session = { token: '', user: '' }; lsSet('session4', state.session);
    try { localStorage.setItem('userRole', 'gast'); } catch (e) { /* egal */ }
    state.me = null;
    if (t) post({ action: 'logout', token: t });
    load();
  }

  function head() {
    var who = '';
    if (state.me) {
      var nm = state.me.user || (state.me.role && state.me.role.name) || '';
      who = '<span class="hub-pill">' + (state.me.user ? '👤 ' : '🔑 ') + esc(nm) + (state.me.user && state.me.role ? ' · ' + esc(state.me.role.name) : '') + '</span><button type="button" class="hub-btn hub-ghost" data-act="logout">Abmelden</button>';
    }
    return '<header class="hub-head"><a class="hub-logo" href="' + HUB_URL + '" aria-label="Zum Hub"><img src="/assets/weihnachtsmarkt/sharks-logo.png" alt=""></a><h1>SG Barnstorf · Intern</h1><div class="hub-user">' + who + '</div></header>';
  }
  function loginCard() {
    var userMode = state.mode === 'user';
    var roleOpts = state.roles.map(function (r) { return '<option value="' + esc(r.id) + '">' + esc(r.name) + '</option>'; }).join('');
    return '<section class="hub-card hub-loginbox"><h2>Anmelden</h2>' +
      '<p class="hub-sub">Mit deinem Konto siehst du die Systeme, die für dich freigeschaltet sind. Ohne Anmeldung gilt der Gastzugang.</p>' +
      '<div class="hub-tabs"><button type="button" data-mode="user" class="' + (userMode ? 'on' : '') + '">Mit Konto</button><button type="button" data-mode="role" class="' + (!userMode ? 'on' : '') + '">Mit Rollen-Passwort</button></div>' +
      '<form class="hub-login" autocomplete="on">' +
      (userMode ? '<label>Name<input name="name" type="text" autocomplete="username" autocapitalize="off" required></label>'
        : '<label>Rolle<select name="role">' + roleOpts + '</select></label>') +
      '<label>Passwort<input name="password" type="password" autocomplete="' + (userMode ? 'current-password' : 'off') + '" required></label>' +
      (state.error ? '<div class="hub-err">' + esc(state.error) + '</div>' : '') +
      '<button type="submit" class="hub-btn hub-gold"' + (state.busy ? ' disabled' : '') + '>' + (state.busy ? 'Moment …' : 'Anmelden') + '</button></form></section>';
  }
  function systemCard(s) {
    return '<a class="hub-card hub-sys" href="' + esc(s.url) + '" style="--acc:' + esc(s.color || '#94a3b8') + '"><span class="hub-tile">' + esc(s.icon || '•') + '</span><span class="hub-sysbody"><span class="hub-sysname">' + esc(s.name) + '</span><span class="hub-sysdesc">' + esc(s.desc || '') + '</span></span><span class="hub-go">Öffnen →</span></a>';
  }
  function skeleton() { return '<div class="hub-skel"></div><div class="hub-skel"></div>'; }

  function body() {
    if (!state.loaded) return '<section class="hub-grid">' + skeleton() + '</section>';
    if (state.offline) return '<section class="hub-card hub-offline"><h2>Keine Verbindung</h2><p class="hub-sub">Das Konto-System ist gerade nicht erreichbar. Bitte prüfe das Internet und versuche es nochmal.</p><button type="button" class="hub-btn hub-gold" data-act="retry">Nochmal versuchen</button></section>';
    var out = '';
    var greet = state.me ? 'Hallo ' + esc(state.me.user || (state.me.role && state.me.role.name) || '') : 'Willkommen';
    if (PAGE) {
      var sys = state.systems.filter(function (x) { return x.id === PAGE; })[0];
      if (sys) {
        out += '<section class="hub-card hub-page" style="--acc:' + esc(sys.color) + '"><span class="hub-tile big">' + esc(sys.icon) + '</span><div><h2>' + esc(sys.name) + '</h2><p class="hub-sub">Dieses System ist noch in Arbeit. Hier entsteht als Erstes die <b>Jugendkasse</b>. Sobald sie fertig ist, erscheint sie an dieser Stelle.</p><a class="hub-btn hub-ghost" href="' + HUB_URL + '">← Alle Systeme</a></div></section>';
      } else {
        out += '<section class="hub-card hub-offline"><h2>Kein Zugriff</h2><p class="hub-sub">Für dein Konto ist dieser Bereich nicht freigeschaltet. Melde dich an oder frag jemanden aus der Orga.</p><a class="hub-btn hub-ghost" href="' + HUB_URL + '">← Alle Systeme</a></section>';
        if (!state.me) out += loginCard();
      }
      return out;
    }
    out += '<h2 class="hub-hello">' + greet + '</h2>';
    out += state.systems.length ? '<section class="hub-grid">' + state.systems.map(systemCard).join('') + '</section>'
      : '<section class="hub-card"><p class="hub-sub">Für dein Konto sind noch keine Systeme freigeschaltet.</p></section>';
    if (!state.me) out += loginCard();
    if (has('system.users') || has('system.roles') || has('system.rechte') || has('system.passwords')) {
      out += '<section class="hub-card hub-note"><h3>Verwaltung</h3><p class="hub-sub">Benutzer, Rollen und die Sichtbarkeit der Systeme stellst du hier ein. Oben stehen die Schalter für die Systeme, darunter die Rechte je System. Das gilt für alle Systeme.</p><a class="hub-btn hub-gold" href="/intranet/verwaltung/">Zur Verwaltung</a></section>';
    }
    return out;
  }
  function render() {
    root.innerHTML = head() + '<main class="hub-main">' + body() + '</main><footer class="hub-foot"><div class="hub-orn"><span>❄</span><span>⭐</span><span>🎄</span><span>⭐</span><span>❄</span></div><div>Frohe Weihnachten · <b>SG Barnstorf Sharks</b></div></footer>';
  }

  root.addEventListener('click', function (ev) {
    var t = ev.target.closest ? ev.target.closest('[data-mode],[data-act]') : null;
    if (!t) return;
    if (t.getAttribute('data-mode')) { state.mode = t.getAttribute('data-mode'); state.error = ''; render(); }
    else if (t.getAttribute('data-act') === 'logout') logout();
    else if (t.getAttribute('data-act') === 'retry') load();
  });
  root.addEventListener('submit', function (ev) { if (ev.target.classList && ev.target.classList.contains('hub-login')) loginSubmit(ev); });
  load();
})();
