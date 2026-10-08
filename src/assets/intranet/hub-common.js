/* Gemeinsame Grundlage der Intranet-Seiten: Design (Auto, Hell, Dunkel), Abfragen ans Script,
   Kopfzeile mit Anmelden und Burgermenü, Dialoge für Anmelden und Passwort ändern. */
window.HubTheme = (function () {
  function mode() { try { var m = localStorage.getItem('themeMode'); return m === 'dark' || m === 'light' ? m : 'auto'; } catch (e) { return 'auto'; } }
  function apply() {
    var m = mode();
    var dark = m === 'dark' || (m !== 'light' && !!window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches);
    document.documentElement.classList.toggle('dark', dark);
  }
  function cycle() { var n = { auto: 'light', light: 'dark', dark: 'auto' }[mode()]; try { localStorage.setItem('themeMode', n); } catch (e) { /* egal */ } apply(); return n; }
  function label() { return { auto: '🌓 Auto', light: '☀️ Hell', dark: '🌙 Dunkel' }[mode()]; }
  if (window.matchMedia) { try { window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', apply); } catch (e) { /* aeltere Browser */ } }
  apply();
  return { mode: mode, cycle: cycle, label: label, apply: apply };
})();

window.HubShell = (function () {
  var API = window.HUB_API || 'https://script.google.com/macros/s/AKfycby7gQCbTizF8qBnrfLgtEMMsdUu0ZG00AaQ8mrLn5wThBf_G8GiqBUS5knb4QElBVVh/exec';
  var TIMEOUT = window.HUB_TIMEOUT_MS || 15000;
  var HUB_URL = '/intranet/';
  var DIAG = [];
  function lsGet(k, d) { try { var r = localStorage.getItem(k); return r === null ? d : JSON.parse(r); } catch (e) { return d; } }
  function lsSet(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* egal */ } }
  function esc(s) { return String(s === undefined || s === null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  var S = { session: lsGet('session4', null) || { token: '', user: '' }, me: null, systems: [], loginRoles: [], offline: false, menu: false, dialog: null, mode: 'user', error: '', busy: false, info: '' };
  function token() { return (S.session && S.session.token) || ''; }
  function has(p) { return !!(S.me && S.me.perms && S.me.perms.indexOf(p) >= 0); }
  function canAdmin() { return ['system.users', 'system.roles', 'system.rechte', 'system.passwords'].some(has); }

  // ---------- Abfragen ans Script (Zeitlimit, zweiter Versuch, Diagnose) ----------
  function req(url, opts, label) {
    var t0 = Date.now(); var ctl = typeof AbortController !== 'undefined' ? new AbortController() : null;
    var timer = ctl ? setTimeout(function () { ctl.abort(); }, TIMEOUT) : null;
    var o = Object.assign({}, opts || {}); if (ctl) o.signal = ctl.signal;
    return fetch(url, o).then(function (r) {
      return r.text().then(function (txt) {
        if (timer) clearTimeout(timer);
        var note = 'HTTP ' + r.status + ', ' + (Date.now() - t0) + ' ms';
        if (!r.ok) { DIAG.push(label + ': ' + note); return null; }
        try { return JSON.parse(txt); } catch (e) { DIAG.push(label + ': ' + note + ', keine gültige Antwort: ' + txt.replace(/\s+/g, ' ').slice(0, 80)); return null; }
      });
    }).catch(function (e) {
      if (timer) clearTimeout(timer);
      DIAG.push(label + ': ' + (e && e.name === 'AbortError' ? 'keine Antwort nach ' + Math.round(TIMEOUT / 1000) + ' s' : 'Netzwerkfehler (' + ((e && e.message) || 'unbekannt') + ')') + ', ' + (Date.now() - t0) + ' ms');
      return null;
    });
  }
  function get(action, params) {
    var qs = new URLSearchParams(Object.assign({ action: action }, params || {}));
    if (token() && !qs.has('token')) qs.set('token', token());
    var url = API + '?' + qs.toString();
    return req(url, { cache: 'no-store' }, action).then(function (r) { return r || req(url, { cache: 'no-store' }, action + ' (2. Versuch)'); });
  }
  function post(payload) {
    return req(API, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify(payload) }, String(payload.action || 'POST'));
  }

  // ---------- Konto laden: wer bin ich, welche Systeme sehe ich ----------
  function loadAccount() {
    DIAG.length = 0;
    var tm = token() ? get('me') : Promise.resolve(null);
    return Promise.all([tm, get('systems'), get('roles')]).then(function (res) {
      var me = res[0], sys = res[1], roles = res[2];
      if (me && me.status === 'success') S.me = me;
      else {
        S.me = null;
        if (me && me.code === 'auth' && token()) { S.session = { token: '', user: '' }; lsSet('session4', S.session); }
      }
      if (!sys || sys.status !== 'success') { if (sys) DIAG.push('systems: Antwort ' + JSON.stringify(sys).slice(0, 120)); S.offline = true; S.systems = []; }
      else { S.offline = false; S.systems = sys.systems || []; }
      S.loginRoles = roles && roles.roles ? roles.roles.filter(function (r) { return r.id !== 'gast' && r.hasPw; }) : [];
    });
  }

  // ---------- Kopfzeile, Menü, Dialoge ----------
  function menuHtml() {
    if (!S.menu) return '';
    var items = '<div class="hub-mlabel">Systeme</div><a class="hub-mi" href="' + HUB_URL + '"><span class="hub-mic">🏠</span>Alle Systeme</a>' +
      S.systems.map(function (s) { return '<a class="hub-mi" href="' + esc(s.url) + '"><span class="hub-mic">' + esc(s.icon || '•') + '</span>' + esc(s.name) + '</a>'; }).join('') + '<div class="hub-msep"></div><div class="hub-mlabel">Konto</div>';
    if (!S.me) items += '<button type="button" class="hub-mi" data-sh="login"><span class="hub-mic">🔑</span>Anmelden</button>';
    else {
      if (S.me.user) items += '<button type="button" class="hub-mi" data-sh="password"><span class="hub-mic">🔑</span>Passwort ändern</button>';
      if (canAdmin()) items += '<a class="hub-mi" href="' + HUB_URL + 'verwaltung/"><span class="hub-mic">🛡️</span>Verwaltung</a>';
      items += '<button type="button" class="hub-mi" data-sh="logout"><span class="hub-mic">🚪</span>Abmelden</button>';
    }
    return '<div class="hub-menu-bg" data-sh="menuclose"></div><nav class="hub-menu" aria-label="Menü">' + items + '</nav>';
  }
  function header(title) {
    var acc = S.me ? '<span class="hub-pill">' + (S.me.user ? '👤 ' : '🔑 ') + esc(S.me.user || (S.me.role && S.me.role.name) || '') + (S.me.user && S.me.role ? ' · ' + esc(S.me.role.name) : '') + '</span>' : '<button type="button" class="hub-btn hub-gold" data-sh="login">🔑 Anmelden</button>';
    return '<header class="hub-head"><a class="hub-logo" href="' + HUB_URL + '" aria-label="Zum Hub"><img src="/assets/weihnachtsmarkt/sharks-logo.png" alt=""></a><h1>' + esc(title) + '</h1><div class="hub-user">' + acc +
      '<button type="button" class="hub-btn hub-ghost" data-sh="theme">' + esc(window.HubTheme.label()) + '</button><button type="button" class="hub-burger" data-sh="menu" aria-label="Menü" aria-expanded="' + (S.menu ? 'true' : 'false') + '">☰</button></div>' + menuHtml() + '</header>';
  }
  function dialogHtml() {
    var d = S.dialog; if (!d) return '';
    if (d === 'login') {
      var userMode = S.mode === 'user';
      var opts = S.loginRoles.map(function (r) { return '<option value="' + esc(r.id) + '">' + esc(r.name) + '</option>'; }).join('');
      return '<div class="ha-overlay" data-sh="cancelbg"><div class="ha-dialog small"><h3>Anmelden</h3><p class="hub-sub">Mit deinem Konto siehst du die Systeme, die für dich freigeschaltet sind. Ohne Anmeldung gilt der Gastzugang.</p>' +
        '<div class="hub-tabs"><button type="button" data-shmode="user" class="' + (userMode ? 'on' : '') + '">Mit Konto</button><button type="button" data-shmode="role" class="' + (!userMode ? 'on' : '') + '">Mit Rollen-Passwort</button></div>' +
        '<form class="hub-login" data-shform="login" autocomplete="on">' +
        (userMode ? '<label>Name<input name="name" type="text" autocomplete="username" autocapitalize="off" required></label>' : '<label>Rolle<select name="role">' + opts + '</select></label>') +
        '<label>Passwort<input name="password" type="password" autocomplete="' + (userMode ? 'current-password' : 'off') + '" required></label>' +
        (S.error ? '<div class="hub-err">' + esc(S.error) + '</div>' : '') +
        '<div class="ha-actions"><button type="button" class="hub-btn hub-ghost" data-sh="cancel">Abbrechen</button><button type="submit" class="hub-btn hub-gold"' + (S.busy ? ' disabled' : '') + '>' + (S.busy ? 'Moment …' : 'Anmelden') + '</button></div></form></div></div>';
    }
    if (d === 'password') {
      return '<div class="ha-overlay"><div class="ha-dialog small"><h3>Passwort ändern</h3><form class="hub-login" data-shform="password">' +
        '<label>Altes Passwort<input name="old" type="password" autocomplete="current-password" required></label><label>Neues Passwort (mindestens 6 Zeichen)<input name="neu" type="password" autocomplete="new-password" required></label><label>Neues Passwort wiederholen<input name="neu2" type="password" autocomplete="new-password" required></label>' +
        (S.error ? '<div class="hub-err">' + esc(S.error) + '</div>' : '') + '<div class="ha-actions"><button type="button" class="hub-btn hub-ghost" data-sh="cancel">Abbrechen</button><button type="submit" class="hub-btn hub-gold"' + (S.busy ? ' disabled' : '') + '>Speichern</button></div></form></div></div>';
    }
    if (d === 'info') return '<div class="ha-overlay"><div class="ha-dialog small"><h3>Erledigt</h3><p class="hub-sub">' + esc(S.info) + '</p><div class="ha-actions"><button type="button" class="hub-btn hub-gold" data-sh="cancel">OK</button></div></div></div>';
    return '';
  }
  function overlay() { return dialogHtml(); }

  // ---------- Bedienung ----------
  function click(ev, rerender, reload) {
    var t = ev.target && ev.target.closest ? ev.target.closest('[data-sh],[data-shmode]') : null; if (!t) return false;
    var m = t.getAttribute('data-shmode');
    if (m) { S.mode = m; S.error = ''; rerender(); return true; }
    var a = t.getAttribute('data-sh');
    if (a === 'cancelbg') { if (ev.target !== t) return false; a = 'cancel'; }
    if (a === 'menu') { S.menu = !S.menu; rerender(); return true; }
    if (a === 'menuclose') { S.menu = false; rerender(); return true; }
    if (a === 'theme') { window.HubTheme.cycle(); rerender(); return true; }
    if (a === 'login') { S.menu = false; S.dialog = 'login'; S.error = ''; rerender(); return true; }
    if (a === 'password') { S.menu = false; S.dialog = 'password'; S.error = ''; rerender(); return true; }
    if (a === 'cancel') { S.dialog = null; S.error = ''; rerender(); return true; }
    if (a === 'logout') {
      var tk = token(); S.menu = false;
      S.session = { token: '', user: '' }; lsSet('session4', S.session); try { localStorage.setItem('userRole', 'gast'); } catch (e) { /* egal */ }
      S.me = null; if (tk) post({ action: 'logout', token: tk });
      reload(); return true;
    }
    return false;
  }
  function submit(ev, rerender, reload) {
    var f = ev.target; var kind = f && f.getAttribute ? f.getAttribute('data-shform') : null; if (!kind) return false;
    ev.preventDefault(); if (S.busy) return true;
    if (kind === 'login') {
      var payload = { action: 'login', kind: S.mode };
      if (S.mode === 'user') payload.name = f.elements.name.value; else payload.role = f.elements.role.value;
      payload.password = f.elements.password.value;
      S.busy = true; S.error = ''; rerender();
      post(payload).then(function (res) {
        S.busy = false;
        if (!res) { S.error = 'Keine Verbindung. Zum Anmelden wird Internet gebraucht.'; rerender(); return; }
        if (res.status !== 'success') { S.error = res.message || 'Falsche Anmeldedaten.'; rerender(); return; }
        S.session = { token: res.token, user: res.user || '', roles: res.roles || [], perms: res.user ? res.perms : [] }; lsSet('session4', S.session);
        try { localStorage.setItem('userRole', res.role.id); } catch (e) { /* egal */ }
        S.dialog = null; reload();
      });
      return true;
    }
    if (kind === 'password') {
      var o = f.elements.old.value, n = f.elements.neu.value, n2 = f.elements.neu2.value;
      if (n.length < 6) { S.error = 'Das neue Passwort braucht mindestens 6 Zeichen.'; rerender(); return true; }
      if (n !== n2) { S.error = 'Die beiden neuen Passwörter sind nicht gleich.'; rerender(); return true; }
      S.busy = true; S.error = ''; rerender();
      post({ action: 'changePassword', token: token(), oldPassword: o, newPassword: n }).then(function (res) {
        S.busy = false;
        if (!res) { S.error = 'Keine Verbindung. Zum Ändern wird Internet gebraucht.'; rerender(); return; }
        if (res.status !== 'success') { S.error = res.message || 'Das hat nicht geklappt.'; rerender(); return; }
        S.dialog = 'info'; S.info = 'Dein Passwort wurde geändert.'; rerender();
      });
      return true;
    }
    return false;
  }
  return { S: S, API: API, DIAG: DIAG, esc: esc, lsGet: lsGet, lsSet: lsSet, token: token, has: has, canAdmin: canAdmin, get: get, post: post, loadAccount: loadAccount, header: header, overlay: overlay, click: click, submit: submit, HUB_URL: HUB_URL };
})();
