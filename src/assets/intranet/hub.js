/* Hub der SG Barnstorf: Auswahl der Systeme. Anmeldung und Menü stecken in der Kopfzeile (hub-common.js). */
(function () {
  'use strict';
  var root = document.getElementById('hubRoot');
  if (!root) return;
  var SH = window.HubShell;
  if (!SH) { root.textContent = 'Der Grundbaustein hub-common.js fehlt.'; return; }
  var PAGE = root.getAttribute('data-system') || '';   // '' = Startseite, sonst die Kennung des Systems (z. B. jugend)
  var HUB_URL = '/intranet/';
  var state = { loaded: false };
  var esc = SH.esc;

  function systemCard(s) {
    return '<a class="hub-card hub-sys" href="' + esc(s.url) + '" style="--acc:' + esc(s.color || '#94a3b8') + '"><span class="hub-tile">' + esc(s.icon || '•') + '</span><span class="hub-sysbody"><span class="hub-sysname">' + esc(s.name) + '</span><span class="hub-sysdesc">' + esc(s.desc || '') + '</span></span><span class="hub-go">Öffnen →</span></a>';
  }
  function body() {
    var S = SH.S;
    if (!state.loaded) return '<section class="hub-grid"><div class="hub-skel"></div><div class="hub-skel"></div></section>';
    if (S.offline) return '<section class="hub-card hub-offline"><h2>Keine Verbindung</h2><p class="hub-sub">Das Konto-System ist gerade nicht erreichbar. Bitte prüfe das Internet und versuche es nochmal.</p><button type="button" class="hub-btn hub-gold" data-act="retry">Nochmal versuchen</button><details class="hub-diag"><summary>Technische Details</summary><pre>' + esc(SH.DIAG.length ? SH.DIAG.join('\n') : 'Keine Angaben.') + '</pre></details></section>';
    var out = '';
    if (PAGE) {
      var sys = S.systems.filter(function (x) { return x.id === PAGE; })[0];
      if (sys) {
        return '<section class="hub-card hub-page" style="--acc:' + esc(sys.color) + '"><span class="hub-tile big">' + esc(sys.icon) + '</span><div><h2>' + esc(sys.name) + '</h2><p class="hub-sub">Dieses System ist noch in Arbeit. Hier entsteht als Erstes die <b>Jugendkasse</b>. Sobald sie fertig ist, erscheint sie an dieser Stelle.</p><a class="hub-btn hub-ghost" href="' + HUB_URL + '">← Alle Systeme</a></div></section>';
      }
      return '<section class="hub-card hub-offline"><h2>Kein Zugriff</h2><p class="hub-sub">Für dein Konto ist dieser Bereich nicht freigeschaltet. Melde dich an oder frag jemanden aus der Orga.</p>' + (S.me ? '' : '<button type="button" class="hub-btn hub-gold" data-sh="login">Anmelden</button> ') + '<a class="hub-btn hub-ghost" href="' + HUB_URL + '">← Alle Systeme</a></section>';
    }
    out += '<h2 class="hub-hello">' + (S.me ? 'Hallo ' + esc(S.me.user || (S.me.role && S.me.role.name) || '') : 'Willkommen') + '</h2>';
    out += S.systems.length ? '<section class="hub-grid">' + S.systems.map(systemCard).join('') + '</section>' : '<section class="hub-card"><p class="hub-sub">Für dein Konto sind noch keine Systeme freigeschaltet.</p></section>';
    if (!S.me) out += '<section class="hub-card hub-note"><h3>Weitere Systeme?</h3><p class="hub-sub">Melde dich an, dann siehst du alle Systeme, die für dich freigeschaltet sind.</p><button type="button" class="hub-btn hub-gold" data-sh="login">Anmelden</button></section>';
    if (SH.canAdmin()) out += '<section class="hub-card hub-note"><h3>Verwaltung</h3><p class="hub-sub">Benutzer, Rollen und die Sichtbarkeit der Systeme stellst du hier ein. Oben stehen die Schalter für die Systeme, darunter die Rechte je System. Das gilt für alle Systeme.</p><a class="hub-btn hub-gold" href="/intranet/verwaltung/">Zur Verwaltung</a></section>';
    return out;
  }
  function render() { root.innerHTML = SH.header('SG Barnstorf · Intranet') + '<main class="hub-main">' + body() + '</main>' + SH.overlay(); }
  function load() { state.loaded = false; render(); return SH.loadAccount().then(function () { state.loaded = true; render(); }); }

  root.addEventListener('click', function (ev) {
    if (SH.click(ev, render, load)) return;
    var t = ev.target.closest ? ev.target.closest('[data-act]') : null;
    if (t && t.getAttribute('data-act') === 'retry') load();
  });
  root.addEventListener('submit', function (ev) { SH.submit(ev, render, load); });
  load();
})();
