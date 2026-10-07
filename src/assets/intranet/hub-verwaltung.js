/* Verwaltung im Hub: Benutzer, Rollen und Sonderrechte für alle Systeme.
   Oben stehen die Schalter für die Systeme, darunter die Rechte je System. */
(function () {
  'use strict';
  var API = 'https://script.google.com/macros/s/AKfycby7gQCbTizF8qBnrfLgtEMMsdUu0ZG00AaQ8mrLn5wThBf_G8GiqBUS5knb4QElBVVh/exec';
  var root = document.getElementById('hubRoot');
  if (!root) return;
  var HUB_URL = '/intranet/';
  var S = { session: lsGet('session4', null) || { token: '', user: '' }, me: null, roles: [], users: [], extras: [], catalog: null, tab: 'benutzer', loaded: false, offline: false, dialog: null, msg: '' };

  function lsGet(k, d) { try { var r = localStorage.getItem(k); return r === null ? d : JSON.parse(r); } catch (e) { return d; } }
  function lsSet(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* egal */ } }
  function esc(s) { return String(s === undefined || s === null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function token() { return (S.session && S.session.token) || ''; }
  function get(action, params) {
    var qs = new URLSearchParams(Object.assign({ action: action }, params || {}));
    if (token() && !qs.has('token')) qs.set('token', token());
    return fetch(API + '?' + qs.toString(), { cache: 'no-store' }).then(function (r) { return r.ok ? r.json() : null; }).catch(function () { return null; });
  }
  function post(payload) {
    return fetch(API, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify(payload) }).then(function (r) { return r.ok ? r.json() : null; }).catch(function () { return null; });
  }
  function has(p) { return !!(S.me && S.me.perms && S.me.perms.indexOf(p) >= 0); }
  function canAny(list) { return list.some(has); }
  var CAN_ENTER = ['system.users', 'system.roles', 'system.rechte', 'system.passwords'];

  function sortRoles(r) { return (r || []).slice(); }
  function roleName(id) { var r = S.roles.filter(function (x) { return x.id === id; })[0]; return r ? r.name : id; }
  function allPermKeys() { return S.catalog ? S.catalog.groups.reduce(function (a, g) { return a.concat(g.perms.map(function (q) { return q.key; })); }, []) : []; }

  function load() {
    S.loaded = false; render();
    var pm = token() ? get('me') : Promise.resolve(null);
    return pm.then(function (me) {
      S.me = me && me.status === 'success' ? me : null;
      if (!S.me) { S.loaded = true; render(); return null; }
      return Promise.all([get('roles'), get('catalog'), canAny(['system.users', 'system.rechte', 'system.roles']) ? get('users') : Promise.resolve(null)]).then(function (res) {
        if (!res[0] || !res[1]) { S.offline = true; S.loaded = true; render(); return; }
        S.offline = false; S.roles = sortRoles(res[0].roles); S.catalog = res[1];
        if (res[2] && Array.isArray(res[2].users)) { S.users = res[2].users; S.extras = res[2].extras || []; }
        S.loaded = true; render();
      });
    });
  }
  function access(ops) {
    return post({ action: 'accessOps', token: token(), ops: ops }).then(function (r) {
      if (!r) { S.msg = 'Keine Verbindung. Änderungen brauchen Internet.'; render(); return null; }
      if (r.code === 'auth') { S.msg = 'Die Anmeldung ist abgelaufen. Bitte im Hub neu anmelden.'; render(); return null; }
      if (Array.isArray(r.roles)) S.roles = sortRoles(r.roles);
      if (Array.isArray(r.users)) S.users = r.users;
      if (Array.isArray(r.extras)) S.extras = r.extras;
      S.msg = r.errors && r.errors.length ? r.errors.join(' ') : '';
      render(); return r;
    });
  }

  // ---------- Dialoge ----------
  function permGrid(d, key, value, locked, forced) {
    var sel = {}; (value || []).forEach(function (k) { sel[k] = true; }); (forced || []).forEach(function (k) { sel[k] = true; });
    var forcedSet = {}; (forced || []).forEach(function (k) { forcedSet[k] = true; });
    var systems = [{ id: 'hub', title: 'Systeme im Hub' }, { id: 'weihnachtsmarkt', title: 'Weihnachtsmarkt' }, { id: 'jugend', title: 'Jugend' }];
    var html = '';
    systems.forEach(function (sys) {
      var groups = S.catalog.groups.filter(function (g) { return g.system === sys.id; });
      if (!groups.length) return;
      html += '<div class="ha-sys"><h4>' + esc(sys.title) + '</h4>' + (sys.id === 'hub' ? '<p class="ha-hint">Diese Schalter bestimmen, welche Systeme im Hub erscheinen. Darunter stehen die Rechte je System.</p>' : '') + '<div class="ha-grid">';
      groups.forEach(function (g) {
        html += '<fieldset class="ha-group"><legend>' + esc(sys.id === 'hub' ? g.title : g.title) + '</legend>' + g.perms.map(function (q) {
          var on = !!sel[q.key]; var dis = locked || forcedSet[q.key];
          return '<label class="ha-perm"><input type="checkbox" data-pk="' + esc(q.key) + '"' + (on ? ' checked' : '') + (dis ? ' disabled' : '') + '> <span>' + esc(q.label) + '</span></label>';
        }).join('') + '</fieldset>';
      });
      html += '</div></div>';
    });
    return html;
  }
  function openDialog(cfg) { S.dialog = cfg; render(); }
  function closeDialog() { S.dialog = null; render(); }
  function dialogHtml() {
    var d = S.dialog; if (!d) return '';
    var body = d.fields.map(function (f) {
      if (f.type === 'text' || f.type === 'password') return '<label class="ha-f"><span>' + esc(f.label) + '</span><input name="' + esc(f.key) + '" type="text" value="' + esc(f.value || '') + '"' + (f.maxlength ? ' maxlength="' + f.maxlength + '"' : '') + (f.placeholder ? ' placeholder="' + esc(f.placeholder) + '"' : '') + ' autocomplete="off">' + (f.hint ? '<small>' + esc(f.hint) + '</small>' : '') + '</label>';
      if (f.type === 'checkbox') return '<label class="ha-f ha-row"><input name="' + esc(f.key) + '" type="checkbox"' + (f.value ? ' checked' : '') + '> <span>' + esc(f.label) + '</span></label>';
      if (f.type === 'checklist') return '<div class="ha-f"><span>' + esc(f.label) + '</span><div class="ha-checks">' + (f.options.length ? f.options.map(function (o) { return '<label class="ha-perm"><input type="checkbox" data-cl="' + esc(f.key) + '" value="' + esc(o.value) + '"' + ((f.value || []).indexOf(o.value) >= 0 ? ' checked' : '') + '> <span>' + esc(o.label) + (o.hint ? ' <small>' + esc(o.hint) + '</small>' : '') + '</span></label>'; }).join('') : '<small>' + esc(f.empty || 'Nichts vorhanden.') + '</small>') + '</div></div>';
      if (f.type === 'permissions') return '<div class="ha-f"><span>' + esc(f.label) + '</span>' + (f.note ? '<small>' + esc(f.note) + '</small>' : '') + permGrid(d, f.key, f.value, f.locked, f.forced) + '</div>';
      return '';
    }).join('');
    var extra = (d.extra || []).map(function (e) { return '<button type="button" class="hub-btn ' + (e.danger ? 'ha-danger' : 'hub-ghost') + '" data-dx="' + esc(e.value) + '">' + esc(e.text) + '</button>'; }).join('');
    return '<div class="ha-overlay"><form class="ha-dialog" data-dlg="1"><h3>' + esc(d.title) + '</h3>' + (d.error ? '<div class="hub-err">' + esc(d.error) + '</div>' : '') + '<div class="ha-body">' + body + '</div><div class="ha-actions"><span class="ha-extra">' + extra + '</span><button type="button" class="hub-btn hub-ghost" data-dx="cancel">Abbrechen</button><button type="submit" class="hub-btn hub-gold">Speichern</button></div></form></div>';
  }
  function readDialog() {
    var f = root.querySelector('form[data-dlg]'); var out = {};
    S.dialog.fields.forEach(function (fld) {
      if (fld.type === 'text' || fld.type === 'password') out[fld.key] = f.elements[fld.key].value;
      else if (fld.type === 'checkbox') out[fld.key] = f.elements[fld.key].checked;
      else if (fld.type === 'checklist') out[fld.key] = Array.prototype.slice.call(f.querySelectorAll('input[data-cl="' + fld.key + '"]:checked')).map(function (i) { return i.value; });
      else if (fld.type === 'permissions') out[fld.key] = Array.prototype.slice.call(f.querySelectorAll('input[data-pk]')).filter(function (i) { return i.checked || i.disabled && i.checked; }).map(function (i) { return i.getAttribute('data-pk'); });
    });
    return out;
  }
  function confirmBox(title, message, okText) {
    return new Promise(function (res) { S.dialog = { confirm: true, title: title, message: message, ok: okText || 'OK', done: res }; render(); });
  }

  function roleDialog(id, copyFrom) {
    var role = id ? S.roles.filter(function (r) { return r.id === id; })[0] : null;
    var src = role || (copyFrom ? S.roles.filter(function (r) { return r.id === copyFrom; })[0] : null);
    var isAdmin = !!role && role.id === 'admin';
    var locked = !has('system.rechte');
    var fields = [
      { key: 'name', label: 'Name', type: 'text', value: role ? role.name : (src ? 'Kopie von ' + src.name : ''), maxlength: 40 },
      { key: 'desc', label: 'Beschreibung', type: 'text', value: src ? src.desc : '', maxlength: 120 }
    ];
    if (!role || role.id !== 'gast') fields.push({ key: 'password', label: role ? 'Neues Passwort (leer lassen = unverändert)' : 'Passwort', type: 'text', value: '', hint: role ? 'Mindestens 4 Zeichen.' : 'Mindestens 4 Zeichen. Ohne Passwort ist keine Anmeldung mit dieser Rolle möglich.' });
    fields.push({ key: 'perms', label: 'Rechte', type: 'permissions', value: src ? src.perms : [], locked: locked, forced: isAdmin ? S.catalog.core : [], note: isAdmin ? 'Die Rechte zur Verwaltung von Rollen, Benutzern und Passwörtern bleiben beim Administrator immer an.' : '' });
    var extra = [];
    if (role && !role.builtin && has('system.roles')) extra.push({ text: 'Rolle löschen', value: 'delete', danger: true });
    if (role && role.id !== 'gast' && has('system.roles')) extra.push({ text: 'Überall abmelden', value: 'logoutAll' });
    if (role && role.id !== 'gast' && role.id !== 'admin' && role.hasPw && has('system.passwords')) extra.push({ text: 'Rollen-Anmeldung abschalten', value: 'clearPw' });
    openDialog({ title: role ? 'Rolle bearbeiten: ' + role.name : (src ? 'Rolle kopieren: ' + src.name : 'Neue Rolle'), fields: fields, extra: extra, wide: true, submit: function (v) {
      var name = String(v.name || '').trim(); if (!name) return 'Bitte einen Namen eingeben.';
      var pw = String(v.password || '').trim(); if (pw && pw.length < 4) return 'Das Passwort braucht mindestens 4 Zeichen.';
      var op = { op: 'saveRole', role: { id: role ? role.id : undefined, name: has('system.roles') ? name : role.name, desc: has('system.roles') ? String(v.desc || '').trim() : role.desc, perms: locked ? role.perms : v.perms } };
      if (pw) op.password = pw;
      return access([op]);
    }, action: function (a) {
      if (a === 'delete') { var n = S.users.filter(function (u) { return (u.roles || []).indexOf(role.id) >= 0; }).length; return confirmBox('Rolle löschen?', role.name + ' wird gelöscht.' + (n ? ' ' + n + ' Benutzer verlieren diese Rolle.' : ''), 'Löschen').then(function (ok) { return ok ? access([{ op: 'delRole', id: role.id }]) : null; }); }
      if (a === 'logoutAll') return confirmBox('Überall abmelden?', 'Alle, die sich mit dem Passwort der Rolle ' + role.name + ' angemeldet haben, werden abgemeldet.', 'Abmelden').then(function (ok) { return ok ? access([{ op: 'logoutRole', id: role.id }]) : null; });
      if (a === 'clearPw') return confirmBox('Rollen-Anmeldung abschalten?', 'Mit ' + role.name + ' kann sich danach niemand mehr mit einem Rollen-Passwort anmelden.', 'Abschalten').then(function (ok) { return ok ? access([{ op: 'saveRole', role: { id: role.id, name: role.name, desc: role.desc, perms: role.perms }, clearPassword: true }]) : null; });
    } });
  }
  function userDialog(id) {
    var u = id ? S.users.filter(function (x) { return x.id === id; })[0] : null;
    var fields = [
      { key: 'name', label: 'Benutzername', type: 'text', value: u ? u.name : '', maxlength: 40 },
      { key: 'roles', label: 'Rollen (eine oder mehrere)', type: 'checklist', options: S.roles.map(function (r) { return { value: r.id, label: r.name, hint: r.desc || '' }; }), value: u ? u.roles : (S.roles.some(function (r) { return r.id === 'helfer'; }) ? ['helfer'] : []) },
      { key: 'extras', label: 'Sonderrechte (zusätzlich zu den Rollen)', type: 'checklist', options: S.extras.map(function (x) { return { value: x.id, label: x.name, hint: x.desc || '' }; }), value: u ? u.extras : [], empty: 'Noch keine Sonderrechte angelegt.' }
    ];
    if (!u || has('system.passwords')) fields.push({ key: 'password', label: u ? 'Neues Passwort (leer lassen = unverändert)' : 'Passwort', type: 'text', value: '', hint: 'Mindestens 4 Zeichen.' });
    if (u) fields.push({ key: 'disabled', label: 'Konto sperren (Anmeldung nicht mehr möglich, der Benutzer bleibt erhalten)', type: 'checkbox', value: !!u.disabled });
    var extra = u ? [{ text: 'Benutzer löschen', value: 'delete', danger: true }, { text: 'Überall abmelden', value: 'logoutAll' }] : [];
    openDialog({ title: u ? 'Benutzer bearbeiten' : 'Neuer Benutzer', fields: fields, extra: extra, submit: function (v) {
      var name = String(v.name || '').trim(); if (!name) return 'Bitte einen Benutzernamen eingeben.';
      if (!v.roles.length) return 'Bitte mindestens eine Rolle wählen.';
      var pw = String(v.password || '').trim(); if ((!u && pw.length < 4) || (pw && pw.length < 4)) return 'Das Passwort braucht mindestens 4 Zeichen.';
      var op = { op: 'saveUser', user: { id: u ? u.id : undefined, name: name, roles: v.roles, extras: v.extras } };
      if (u) op.user.disabled = !!v.disabled; if (pw) op.password = pw;
      return access([op]);
    }, action: function (a) {
      if (a === 'delete') return confirmBox('Benutzer löschen?', u.name + ' wird gelöscht und überall abgemeldet.', 'Löschen').then(function (ok) { return ok ? access([{ op: 'delUser', id: u.id }]) : null; });
      if (a === 'logoutAll') return confirmBox('Überall abmelden?', u.name + ' wird auf allen Geräten abgemeldet und muss sich neu anmelden.', 'Abmelden').then(function (ok) { return ok ? access([{ op: 'logoutUser', id: u.id }]) : null; });
    } });
  }
  function extraDialog(id) {
    var x = id ? S.extras.filter(function (e) { return e.id === id; })[0] : null;
    openDialog({ title: x ? 'Sonderrecht bearbeiten: ' + x.name : 'Neues Sonderrecht', wide: true, fields: [
      { key: 'name', label: 'Name des Sonderrechts', type: 'text', value: x ? x.name : '', maxlength: 40, placeholder: 'z. B. Statistik bearbeiten' },
      { key: 'desc', label: 'Beschreibung', type: 'text', value: x ? x.desc : '', maxlength: 120 },
      { key: 'perms', label: 'Rechte, die dieses Sonderrecht zusätzlich gibt', type: 'permissions', value: x ? x.perms : [] }
    ], extra: x ? [{ text: 'Sonderrecht löschen', value: 'delete', danger: true }] : [], submit: function (v) {
      var name = String(v.name || '').trim(); if (!name) return 'Bitte einen Namen eingeben.';
      return access([{ op: 'saveExtra', extra: { id: x ? x.id : undefined, name: name, desc: String(v.desc || '').trim(), perms: v.perms } }]);
    }, action: function (a) {
      if (a === 'delete') { var n = S.users.filter(function (u) { return (u.extras || []).indexOf(x.id) >= 0; }).length; return confirmBox('Sonderrecht löschen?', x.name + ' wird gelöscht.' + (n ? ' ' + n + ' Benutzer verlieren dieses Recht.' : ''), 'Löschen').then(function (ok) { return ok ? access([{ op: 'delExtra', id: x.id }]) : null; }); }
    } });
  }

  // ---------- Anzeige ----------
  function sysBadges(perms) {
    return (S.catalog ? ['hub.weihnachtsmarkt', 'hub.jugend'] : []).filter(function (k) { return (perms || []).indexOf(k) >= 0; }).map(function (k) { return '<span class="ha-badge">' + (k === 'hub.jugend' ? '🏊 Jugend' : '🎄 Weihnachtsmarkt') + '</span>'; }).join('');
  }
  function when(t) { if (!t) return 'noch nie angemeldet'; var m = Math.round((Date.now() - Number(t)) / 60000); return m < 2 ? 'zuletzt angemeldet gerade eben' : m < 120 ? 'zuletzt angemeldet vor ' + m + ' Min.' : m < 2880 ? 'zuletzt angemeldet vor ' + Math.round(m / 60) + ' Std.' : 'zuletzt angemeldet vor ' + Math.round(m / 1440) + ' Tagen'; }
  function usersHtml() {
    if (!S.users.length) return '<p class="hub-sub">Noch keine persönlichen Konten. Mit „Neuer Benutzer" legst du das erste an.</p>';
    return S.users.map(function (u) {
      return '<div class="ha-item' + (u.disabled ? ' off' : '') + '"><div class="ha-main"><b>' + esc(u.name) + '</b>' + (u.disabled ? ' <span class="ha-badge warn">gesperrt</span>' : '') + '<div class="ha-sub">' + (u.roles || []).map(function (r) { return esc(roleName(r)); }).join(', ') + ((u.extras || []).length ? ' · ' + u.extras.length + ' Sonderrecht(e)' : '') + ' · ' + esc(when(u.lastLogin || u.last)) + '</div></div><button type="button" class="hub-btn hub-ghost" data-ed="user" data-id="' + esc(u.id) + '">Bearbeiten</button></div>';
    }).join('');
  }
  function rolesHtml() {
    return S.roles.map(function (r, i) {
      var mv = has('system.roles') && r.id !== 'admin' ? '<button type="button" class="ha-mini" data-mv="-1" data-id="' + esc(r.id) + '" title="Nach oben">↑</button><button type="button" class="ha-mini" data-mv="1" data-id="' + esc(r.id) + '" title="Nach unten">↓</button>' : '';
      return '<div class="ha-item"><div class="ha-main"><b>' + esc(r.name) + '</b> ' + (r.hasPw ? '<span class="ha-badge">Rollen-Passwort</span>' : '') + ' ' + sysBadges(r.perms) + '<div class="ha-sub">' + esc(r.desc || '') + ' · Rechte ' + (r.perms || []).length + ' von ' + allPermKeys().length + '</div></div>' + mv + (has('system.roles') ? '<button type="button" class="hub-btn hub-ghost" data-ed="copy" data-id="' + esc(r.id) + '">Kopieren</button>' : '') + '<button type="button" class="hub-btn hub-ghost" data-ed="role" data-id="' + esc(r.id) + '">Bearbeiten</button></div>';
    }).join('');
  }
  function extrasHtml() {
    if (!S.extras.length) return '<p class="hub-sub">Sonderrechte sind Pakete aus Einzelrechten, die du einzelnen Benutzern zusätzlich zu ihren Rollen gibst.</p>';
    return S.extras.map(function (x) { return '<div class="ha-item"><div class="ha-main"><b>' + esc(x.name) + '</b> ' + sysBadges(x.perms) + '<div class="ha-sub">' + esc(x.desc || '') + ' · ' + (x.perms || []).length + ' Rechte</div></div><button type="button" class="hub-btn hub-ghost" data-ed="extra" data-id="' + esc(x.id) + '">Bearbeiten</button></div>'; }).join('');
  }
  function head() {
    var who = S.me ? '<span class="hub-pill">' + (S.me.user ? '👤 ' : '🔑 ') + esc(S.me.user || (S.me.role && S.me.role.name) || '') + '</span>' : '';
    return '<header class="hub-head"><a class="hub-logo" href="' + HUB_URL + '" aria-label="Zum Hub"><img src="/assets/weihnachtsmarkt/sharks-logo.png" alt=""></a><h1>Verwaltung</h1><div class="hub-user">' + who + (window.HubTheme ? '<button type="button" class="hub-btn hub-ghost" data-act="theme">' + esc(window.HubTheme.label()) + '</button>' : '') + '<a class="hub-btn hub-ghost" href="' + HUB_URL + '">← Hub</a></div></header>';
  }
  function body() {
    if (!S.loaded) return '<section class="hub-grid"><div class="hub-skel"></div><div class="hub-skel"></div></section>';
    if (!S.me) return '<section class="hub-card hub-offline"><h2>Bitte anmelden</h2><p class="hub-sub">Die Verwaltung ist nur mit Anmeldung erreichbar.</p><a class="hub-btn hub-gold" href="' + HUB_URL + '">Zum Hub</a></section>';
    if (!canAny(CAN_ENTER)) return '<section class="hub-card hub-offline"><h2>Kein Zugriff</h2><p class="hub-sub">Für dein Konto ist die Verwaltung nicht freigeschaltet.</p><a class="hub-btn hub-ghost" href="' + HUB_URL + '">← Hub</a></section>';
    if (S.offline) return '<section class="hub-card hub-offline"><h2>Keine Verbindung</h2><p class="hub-sub">Das Konto-System ist gerade nicht erreichbar.</p><button type="button" class="hub-btn hub-gold" data-act="retry">Nochmal versuchen</button></section>';
    var tabs = [['benutzer', 'Benutzer'], ['rollen', 'Rollen'], ['extras', 'Sonderrechte']].map(function (t) { return '<button type="button" data-tab="' + t[0] + '" class="' + (S.tab === t[0] ? 'on' : '') + '">' + t[1] + '</button>'; }).join('');
    var inner = '';
    if (S.tab === 'benutzer') inner = '<div class="ha-bar"><h2>👤 Benutzer</h2>' + (has('system.users') ? '<button type="button" class="hub-btn hub-gold" data-ed="newuser">Neuer Benutzer</button>' : '') + '</div>' + (has('system.users') ? usersHtml() : '<p class="hub-sub">Du darfst Benutzer nicht ansehen.</p>');
    else if (S.tab === 'rollen') inner = '<div class="ha-bar"><h2>🛡️ Rollen</h2>' + (has('system.roles') ? '<button type="button" class="hub-btn hub-gold" data-ed="newrole">Neue Rolle</button>' : '') + '</div><p class="hub-sub">Eine Rolle bestimmt, welche Systeme sichtbar sind und was jemand darin darf. Bearbeiten zeigt oben die Schalter für die Systeme und darunter die Rechte je System.</p>' + rolesHtml();
    else inner = '<div class="ha-bar"><h2>✨ Sonderrechte</h2>' + (has('system.rechte') ? '<button type="button" class="hub-btn hub-gold" data-ed="newextra">Neues Sonderrecht</button>' : '') + '</div>' + extrasHtml();
    return (S.msg ? '<div class="hub-err" style="margin-bottom:14px">' + esc(S.msg) + '</div>' : '') + '<div class="hub-tabs ha-tabs">' + tabs + '</div><section class="hub-card ha-card">' + inner + '</section>';
  }
  function dialogOrConfirm() {
    var d = S.dialog; if (!d) return '';
    if (d.confirm) return '<div class="ha-overlay"><div class="ha-dialog small"><h3>' + esc(d.title) + '</h3><p class="hub-sub">' + esc(d.message) + '</p><div class="ha-actions"><span class="ha-extra"></span><button type="button" class="hub-btn hub-ghost" data-cf="no">Abbrechen</button><button type="button" class="hub-btn ha-danger" data-cf="yes">' + esc(d.ok) + '</button></div></div></div>';
    return dialogHtml().replace('class="ha-dialog"', 'class="ha-dialog' + (d.wide ? ' wide' : '') + '"');
  }
  function render() {
    var keep = root.querySelector('.ha-body') ? root.querySelector('.ha-body').scrollTop : 0;
    root.innerHTML = head() + '<main class="hub-main">' + body() + '</main>' + dialogOrConfirm();
    var b = root.querySelector('.ha-body'); if (b && keep) b.scrollTop = keep;
  }

  root.addEventListener('click', function (ev) {
    var t = ev.target.closest ? ev.target.closest('[data-tab],[data-ed],[data-mv],[data-dx],[data-cf],[data-act]') : null; if (!t) return;
    if (t.getAttribute('data-tab')) { S.tab = t.getAttribute('data-tab'); S.msg = ''; render(); return; }
    if (t.getAttribute('data-act') === 'retry') { load(); return; }
    if (t.getAttribute('data-act') === 'theme') { if (window.HubTheme) window.HubTheme.cycle(); render(); return; }
    if (t.getAttribute('data-cf')) { var d = S.dialog; S.dialog = null; render(); if (d && d.done) d.done(t.getAttribute('data-cf') === 'yes'); return; }
    if (t.getAttribute('data-dx')) {
      var dx = t.getAttribute('data-dx'); if (dx === 'cancel') { closeDialog(); return; }
      var cur = S.dialog; if (cur && cur.action) { S.dialog = null; var p = cur.action(dx); if (!S.dialog) render(); return p; } return;
    }
    if (t.getAttribute('data-mv')) { access([{ op: 'moveRole', id: t.getAttribute('data-id'), dir: Number(t.getAttribute('data-mv')) }]); return; }
    var ed = t.getAttribute('data-ed'), id = t.getAttribute('data-id');
    if (ed === 'user') userDialog(id); else if (ed === 'newuser') userDialog(); else if (ed === 'role') roleDialog(id); else if (ed === 'copy') roleDialog(null, id);
    else if (ed === 'newrole') roleDialog(); else if (ed === 'extra') extraDialog(id); else if (ed === 'newextra') extraDialog();
  });
  root.addEventListener('submit', function (ev) {
    if (!ev.target.getAttribute || !ev.target.getAttribute('data-dlg')) return;
    ev.preventDefault();
    var d = S.dialog; if (!d || !d.submit) return;
    var v = readDialog(); var res = d.submit(v);
    if (typeof res === 'string') { d.error = res; var keep = {}; d.fields.forEach(function (f) { if (v[f.key] !== undefined) f.value = v[f.key]; }); render(); return; }
    S.dialog = null; render();
  });
  load();
})();
