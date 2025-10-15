
Stock Inventory Web App – Multi‑Page Scaffold (v1.0.0)
====================================================

This scaffold splits each "tab" into its own HTML file while sharing a common sidebar (partials/nav.html),
footer (partials/footer.html), base styles, and a tiny helper module for per‑section loaders.

Files & Folders
---------------
/index.html         -> Dashboard page
/stock-in.html      -> Stock In page
/stock-out.html     -> Stock Out page
/reports.html       -> Reports page
/settings.html      -> Settings & integrations
/assets/css/base.css
/assets/js/main.js  -> shared helpers + version banner
/partials/nav.html  -> shared sidebar + navigation
/partials/footer.html

How includes work
-----------------
Each page uses: <div data-include="partials/nav.html"></div> to fetch and inject the shared nav/footer.
This works on GitHub Pages. No frameworks required.

Per-section loaders
-------------------
Wrap async work with the helper:
  import { withLoader } from './assets/js/main.js';
  withLoader(document.querySelector('#some-section'), async () => {
    const res = await fetch('YOUR_APPS_SCRIPT_ENDPOINT');
    // render...
  });

Hooking Google Apps Script
--------------------------
1) Deploy your GAS as a Web App (execute as: Me, accessible to: Anyone with the link).
2) Store the Web App URL and your Sheet ID in Settings. Read them in each page via localStorage.
3) Replace the demo delays with real fetch() calls. Keep them wrapped in withLoader(...) for non‑overlay spinners.

GitHub Pages
------------
- Commit this folder to a GitHub repo.
- Settings → Pages → Source: Branch = main, Root = / (or /docs if you place it there).
- Visit https://<username>.github.io/<repo>/index.html

Customization
-------------
- Add a page: copy an existing page file, update the <title>, and link it from /partials/nav.html.
- Update colors in :root tokens inside base.css.
- Add page‑specific JS by adding a <script type="module"> block at the bottom of that page.

Versioning
----------
- Update window.APP_VERSION in /assets/js/main.js (and badge reflects it automatically in the sidebar).
