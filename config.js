/* ASTROMATE deployment settings.
   mode: 'local'  - browser edition: all accounts and data stay in this browser (no server needed).
   mode: 'server' - server edition: accounts and encrypted data live on the ASTROMATE server (FastAPI + PostgreSQL) that serves this app.
   apiBase: leave empty when the server that delivers this page also hosts the API (the normal case). */
window.AM_CONFIG = { mode: 'local', apiBase: '' };
