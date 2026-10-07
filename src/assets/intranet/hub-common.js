/* Gemeinsamer Baustein der Intranet-Seiten: Design Auto, Hell oder Dunkel (derselbe Speicher wie im Weihnachtsmarkt). */
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
