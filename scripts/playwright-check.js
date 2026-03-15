const fs = require('fs');
const { chromium } = require('playwright');

(async () => {
  const base = 'http://localhost:3000';
  const pagesToTest = ['/economics/credits', '/economics/reports', '/economics/scheduled-payments'];
  const out = { console: [], pageErrors: [], network: {}, summary: {} };

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  // Global network capture map
  const netLogs = [];

  page.on('console', (msg) => {
    try {
      out.console.push({ type: msg.type(), text: msg.text() });
    } catch (e) {}
  });

  page.on('pageerror', (err) => {
    out.pageErrors.push(String(err.stack || err.message || err));
  });

  context.on('request', (req) => {
    netLogs.push({ id: req._guid || Math.random().toString(36).slice(2), url: req.url(), method: req.method(), type: 'request', postData: req.postData(), headers: req.headers() });
  });

  context.on('response', async (res) => {
    try {
      const request = res.request();
      const url = res.url();
      const status = res.status();
      let body = null;
      // only try to read text for JSON / small responses
      const ct = res.headers()['content-type'] || '';
      if (ct.includes('application/json') || ct.includes('text') || ct.includes('application/')) {
        try {
          const txt = await res.text();
          body = txt.slice(0, 20000);
        } catch (e) {
          body = `<unavailable: ${String(e)}>`;
        }
      }
      netLogs.push({ id: request._guid || Math.random().toString(36).slice(2), url, method: request.method(), status, body, headers: res.headers(), requestHeaders: request.headers() });
    } catch (e) {}
  });

  // 1) Visit root and try to read active_store_id from localStorage
  await page.goto(base, { waitUntil: 'networkidle', timeout: 30000 }).catch(() => {});
  // allow overriding the store id from the environment for CI/headless runs
  const envStore = process.env.STORE_ID;
  const storeId = envStore || (await page.evaluate(() => {
    try {
      // prefer explicit key
      const explicit = localStorage.getItem('active_store_id');
      if (explicit) return explicit;
      // fallback: scan for any uuid-like value in localStorage
      const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        try {
          const v = localStorage.getItem(k);
          if (typeof v === 'string' && uuidRe.test(v.trim())) return v.trim();
        } catch (e) {}
      }
      return null;
    } catch (e) {
      return null;
    }
  }));

  out.summary.storeId = storeId || null;

  if (!storeId) {
    console.error('No active_store_id found in localStorage. Aborting to avoid using a dummy store id.');
    out.summary.error = 'No active_store_id found in localStorage';
    fs.writeFileSync('playwright_output.json', JSON.stringify({ out, netLogs }, null, 2));
    await browser.close();
    process.exit(2);
  }

  // 2) Visit each page with store param and capture logs
  for (const p of pagesToTest) {
    const url = `${base}${p}?store=${storeId}`;
    out.summary[url] = { console: [], pageErrors: [], network: [] };

    // clear page-specific arrays by listening inline
    const pageConsole = [];
    const pageErrors = [];

    const onConsole = (msg) => pageConsole.push({ type: msg.type(), text: msg.text() });
    const onPageError = (err) => pageErrors.push(String(err.stack || err.message || err));

    page.on('console', onConsole);
    page.on('pageerror', onPageError);

    console.log('Visiting', url);
    await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 }).catch((e) => {
      pageErrors.push('Navigation error: ' + String(e));
    });

    // wait a little for client fetches
    await page.waitForTimeout(2000);

    // collect network entries that touched supabase or rest/v1 or /transactions or scheduled_payments
    const relevant = netLogs.filter((n) => {
      try {
        const u = String(n.url || '').toLowerCase();
        return u.includes('supabase') || u.includes('/rest/v1') || u.includes('/transactions') || u.includes('/scheduled_payments') || u.includes('/scheduled-payments') || u.includes('/auth/v1');
      } catch (e) {
        return false;
      }
    });

    out.summary[url].console = pageConsole;
    out.summary[url].pageErrors = pageErrors;
    out.summary[url].network = relevant;

    page.off('console', onConsole);
    page.off('pageerror', onPageError);
  }

  out.network = netLogs;
  fs.writeFileSync('playwright_output.json', JSON.stringify({ out, netLogs }, null, 2));
  console.log('Saved playwright_output.json');

  await browser.close();
  process.exit(0);
})();
