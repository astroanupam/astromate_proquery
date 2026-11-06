/* ASTROMATE bootstrap: apply stored settings, restore the session, register the offline service worker, start the router. */
(function (g) {
  'use strict';
  const AM = g.AM;
  /** Apply administrator settings (rule-set overrides) to the running engine. */
  AM.applySettings = function () {
    try { AM.rules.setActive(AM.store.getSettings().ruleset.overrides); } catch (e) { console.error(e); }
  };
  async function boot() {
    try {
      await AM.store.init(); /* server edition: public information; browser edition: nothing to do */
      AM.applySettings();
      const user = await AM.store.restore();
      if (user) await AM.afterSignIn();
    } catch (e) { console.error(e); }
    if ('serviceWorker' in g.navigator && /^https?:$/.test(g.location.protocol)) {
      const local = /^(localhost|127\.0\.0\.1|\[::1\])$/.test(g.location.hostname);
      if (local && !/[?&]sw=1/.test(g.location.search)) {
        /* development on localhost: never let a cached copy hide an edit (add ?sw=1 to test offline mode) */
        g.navigator.serviceWorker.getRegistrations().then((rs) => rs.forEach((r) => r.unregister())).catch(() => null);
        if (g.caches) g.caches.keys().then((ks) => ks.forEach((k) => { if (k.indexOf('astromate-') === 0) g.caches.delete(k); })).catch(() => null);
      } else g.navigator.serviceWorker.register('sw.js').catch(() => { /* offline mode is optional */ });
    }
    if (!g.location.hash) g.location.hash = AM.ui.S.user ? '#/home' : '#/welcome';
    AM.ui.render();
  }
  if (g.document.readyState === 'loading') g.document.addEventListener('DOMContentLoaded', boot); else boot();
})(typeof window !== 'undefined' ? window : globalThis);
