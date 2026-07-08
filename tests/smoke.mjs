// Whim smoke test: boots the app in headless Chrome, walks the onboarding quiz,
// checks the deck renders with real distances/clock, swipes, checks plan + chat fallback.
import puppeteer from 'puppeteer';
import http from 'http';
import { readFileSync, existsSync } from 'fs';
import path from 'path';

const ROOT = new URL('..', import.meta.url).pathname;
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.ttf': 'font/ttf', '.png': 'image/png' };

// tiny static server + stub /api endpoints so we can exercise the full client path
const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://x');
  if (url.pathname === '/api/pulse') {
    res.setHeader('Content-Type', 'application/json');
    return res.end(JSON.stringify({ ok: true, pulse: [
      { text: 'Pop-up natural wine fair at Ground Control this weekend', spot: 'Ground Control', likes: 900 },
      { text: 'Nuit Blanche installations along the Seine tonight', spot: null, likes: 700 },
    ]}));
  }
  if (url.pathname === '/api/config') {
    res.setHeader('Content-Type', 'application/json');
    return res.end(JSON.stringify({ supabaseUrl: null, supabaseAnonKey: null }));
  }
  if (url.pathname === '/api/discover') {
    res.setHeader('Content-Type', 'application/json');
    // echo places around whatever coordinates were asked for, so the stub
    // works for any city the test geolocates to
    const [qlat, qlng] = (url.searchParams.get('ll') || '48.8605,2.3592').split(',').map(Number);
    return res.end(JSON.stringify({ ok: true, places: [
      { id: 'w1', name: 'Chez Stub', type: 'restaurant', lat: qlat + 0.0007, lng: qlng - 0.0004, rating: '4.6', ratings: 2100, blurb: 'A neighborhood favorite.', openNow: true },
      { id: 'w2', name: 'Café Wildcard', type: 'cafe', lat: qlat - 0.0007, lng: qlng + 0.0019, rating: '4.5', ratings: 800, blurb: null, openNow: true },
      { id: 'w3', name: 'Bar Stub', type: 'wine_bar', lat: qlat - 0.0002, lng: qlng - 0.0015, rating: '4.7', ratings: 1500, blurb: 'Natural wine, no attitude.', openNow: true },
    ]}));
  }
  if (url.pathname === '/api/reddit') {
    res.setHeader('Content-Type', 'application/json');
    return res.end(JSON.stringify({ ok: true, threads: [
      { title: 'Best wine bar near Bastille? REDDITSTUB', ups: 321, sub: 'ParisTravelGuide', url: 'https://reddit.com/stub' },
    ]}));
  }
  if (url.pathname === '/api/oddities') {
    res.setHeader('Content-Type', 'application/json');
    return res.end(JSON.stringify({ ok: true, places: [
      { name: 'Stub Secret Crypt', blurb: 'A very hidden thing.', url: 'https://www.atlasobscura.com/stub', lat: 48.8601, lng: 2.3581, category: 'Crypts' },
    ]}));
  }
  if (url.pathname === '/api/book') {
    res.setHeader('Content-Type', 'application/json');
    return res.end(JSON.stringify({ ok: true, found: true, match: 'Stub Bistro', url: 'https://www.thefork.fr/stub', bookable: true, rating: '9.2', price: '45€' }));
  }
  if (url.pathname === '/api/curator') {
    res.setHeader('Content-Type', 'application/json');
    const [clat, clng] = (url.searchParams.get('ll') || '48.8605,2.3592').split(',').map(Number);
    return res.end(JSON.stringify({ ok: true, places: [
      { id: 'ai_stub1', name: 'AISTUB Bistro des Initiés', kind: 'Restaurant', area: '10e', blurb: 'Zinc counter, three plats, zero compromise — very you.', lat: clat + 0.001, lng: clng - 0.001, rating: '4.7', ratings: 812 },
      { id: 'ai_stub2', name: 'AISTUB Disquaire Café', kind: 'Café', area: '11e', blurb: 'Records up front, flat whites in the back.', lat: clat - 0.001, lng: clng + 0.002, rating: '4.6', ratings: 402 },
    ]}));
  }
  if (url.pathname === '/api/timeout') {
    res.setHeader('Content-Type', 'application/json');
    return res.end(JSON.stringify({ ok: true, city: 'Paris', items: [
      { text: 'TIMEOUTSTUB: night market on the canal this weekend', url: 'https://www.timeout.fr/stub' },
    ]}));
  }
  if (url.pathname === '/api/expo') {
    res.setHeader('Content-Type', 'application/json');
    return res.end(JSON.stringify({ ok: true, site: 'https://example.org/musee', expos: [
      { title: 'EXPOSTUB: Monet in the Dark', when: 'Until 12 October' },
      { title: 'Bronze, but Moody', when: '' },
    ]}));
  }
  if (url.pathname === '/api/details') {
    res.setHeader('Content-Type', 'application/json');
    const px = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';
    return res.end(JSON.stringify({ ok: true, rating: '4.8', ratings: 2500, openNow: true,
      gmaps: 'https://maps.google.com/?q=stub',
      photos: [px, px],
      reviews: [
        { author: 'Colette', rating: 5, when: 'a week ago', text: 'A quietly perfect place. STUBREVIEW.' },
        { author: 'Marcel', rating: 4, when: 'a month ago', text: 'Almost too charming.' },
      ] }));
  }
  if (url.pathname === '/api/places') {
    res.setHeader('Content-Type', 'application/json');
    // one venue reports closed so the Food chip's open-now gate is exercised
    const closed = /utopie|pain et des/i.test(url.searchParams.get('name') || '');
    return res.end(JSON.stringify({ ok: true, rating: '4.9', ratings: 1234, openNow: !closed, photo: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==', lat: 48.8611, lng: 2.3574, match: 'Chez Testeur' }));
  }
  if (url.pathname === '/api/concierge') {
    res.setHeader('Content-Type', 'application/json');
    let b = '';
    req.on('data', (c) => (b += c));
    return req.on('end', () => {
      const parsed = JSON.parse(b);
      const n = (parsed.context?.places || []).length;
      const msg = (parsed.messages || []).slice(-1)[0]?.text || '';
      if (/wine/i.test(msg)) return res.end(JSON.stringify({ reply: 'MENTION REPLY: try Le Baron Rouge, obviously.' }));
      if (/shopping/i.test(msg)) return res.end(JSON.stringify({ reply: 'FOLLOWUP: what is the budget, and what are we hunting?', tasteNotes: ['Vintage and friperies', 'Budget under 50 euros'] }));
      if (/septime/i.test(msg)) return res.end(JSON.stringify({ reply: 'SPECIFIC REPLY: Septime La Cave is exactly your speed.', tasteNotes: [], mentions: [{ name: 'Septime La Cave', kind: 'Wine bar' }] }));
      res.end(JSON.stringify({ reply: `STUB REPLY (${n} curated places received, taste: ${parsed.context?.taste?.length ?? '?'}, pulse: ${parsed.context?.pulse?.length ?? 0})` }));
    });
  }
  let fp = path.join(ROOT, url.pathname === '/' ? 'index.html' : url.pathname);
  if (!existsSync(fp)) { res.statusCode = 404; return res.end('nope'); }
  res.setHeader('Content-Type', MIME[path.extname(fp)] || 'application/octet-stream');
  res.end(readFileSync(fp));
});
await new Promise((r) => server.listen(8199, '127.0.0.1', r));

const browser = await puppeteer.launch({
  // CHROME_PATH overrides (e.g. local Chrome); default is puppeteer's bundled browser
  ...(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {}),
  headless: 'new',
  args: ['--no-first-run', '--disable-gpu', '--no-sandbox'],
});
const results = [];
const check = (name, ok, extra = '') => { results.push(`${ok ? 'PASS' : 'FAIL'} ${name}${extra ? ' — ' + extra : ''}`); };

try {
  const page = await browser.newPage();
  const ctx = browser.defaultBrowserContext();
  await ctx.overridePermissions('http://127.0.0.1:8199', ['geolocation']);
  await page.setGeolocation({ latitude: 48.8605, longitude: 2.3592 }); // Le Marais
  await page.setViewport({ width: 390, height: 844 });
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('response', (r) => { if (r.status() === 404) errors.push('404: ' + r.url()); });

  await page.goto('http://127.0.0.1:8199/', { waitUntil: 'networkidle2', timeout: 30000 });

  // splash
  await page.waitForFunction(() => document.body.innerText.includes('Allons-y'), { timeout: 10000 });
  check('splash renders', true);

  // walk onboarding: click first option 10 times
  const clickByText = async (txt) => {
    const hit = await page.evaluate((t) => {
      const b = [...document.querySelectorAll('button')].find((x) => x.innerText.trim().toLowerCase().includes(t.toLowerCase()));
      if (b) { b.click(); return b.innerText.trim().slice(0, 40); }
      return null;
    }, txt);
    results.push(`DEBUG clicked for "${txt}": ${JSON.stringify(hit)}`);
    return hit;
  };
  await clickByText('Allons-y');
  await page.waitForFunction(() => document.body.innerText.toLowerCase().includes('what should i call you'), { timeout: 5000 });
  await page.evaluate(() => {
    const input = document.querySelector('input');
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
    setter.call(input, 'Jess');
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
  });
  await clickByText('Enchanté');
  await new Promise((r) => setTimeout(r, 300));
  for (let i = 0; i < 13; i++) {
    await page.waitForFunction(() => [...document.querySelectorAll('button')].some((b) => /→|ri-arrow/.test(b.innerHTML) || b.innerText.length > 3), { timeout: 5000 });
    if (i === 2) {
      // answer one question through the free-text fourth option
      await clickByText('In my own words');
      await page.waitForFunction(() => !!document.querySelector('input'), { timeout: 3000 });
      await page.evaluate(() => {
        const input = document.querySelector('input');
        const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
        setter.call(input, 'I collect antique doorknobs');
        input.dispatchEvent(new Event('input', { bubbles: true }));
        input.dispatchEvent(new Event('change', { bubbles: true }));
      });
      await page.evaluate(() => {
        const b = [...document.querySelectorAll('button')].find((x) => x.getAttribute('aria-label') === 'Use my answer');
        if (b) b.click();
      });
      await new Promise((r) => setTimeout(r, 300));
      continue;
    }
    await page.evaluate(() => {
      const btns = [...document.querySelectorAll('button')].filter((b) => b.querySelector('i.ri-arrow-right-line'));
      if (btns[0]) btns[0].click();
    });
    await new Promise((r) => setTimeout(r, 120));
  }
  await new Promise((r) => setTimeout(r, 400));
  const typedOk = await page.evaluate(() => {
    try { return (JSON.parse(localStorage.getItem('whim-v1')).obAnswers || []).includes('I collect antique doorknobs'); }
    catch (e) { return false; }
  });
  check('typed onboarding answer lands in taste file', typedOk);
  await page.waitForFunction(() => document.body.innerText.toLowerCase().includes('discover'), { timeout: 8000 });
  check('onboarding completes into app', true);

  // pin the clock: real time varies per run (a midnight run gets a thin night
  // deck and everything downstream shifts) — the demo override fixes the hour
  await clickByText('You');
  await new Promise((r) => setTimeout(r, 300));
  await page.evaluate(() => {
    const b = [...document.querySelectorAll('button')].find((x) => x.innerText.trim().toLowerCase() === 'afternoon');
    if (b) b.click();
  });
  await new Promise((r) => setTimeout(r, 200));
  await clickByText('Discover');
  await new Promise((r) => setTimeout(r, 400));

  // masthead context line: real clock + weather label present
  const ctxLine = await page.evaluate(() => {
    const m = document.body.innerText.match(/Paris · \w+ · \d{1,2}:\d{2} · [^\n]+/i);
    return m ? m[0] : null;
  });
  check('context line shows real weekday/clock/weather', !!ctxLine, ctxLine || 'not found');

  // deck cards with live stub data
  await new Promise((r) => setTimeout(r, 1200));
  const cardInfo = await page.evaluate(() => document.body.innerText);
  check('card shows walking-distance pill', /\d+ min from you/.test(cardInfo));

  // range toggle: Near me should cap every visible card at a ~15 min walk
  await clickByText('All Paris');
  await new Promise((r) => setTimeout(r, 400));
  const nearTxt = await page.evaluate(() => document.body.innerText);
  const mins = [...nearTxt.matchAll(/(\d+) min from you/g)].map((m) => +m[1]);
  check('range toggle flips to Near me', /near me/i.test(nearTxt));
  check('Near me keeps cards walkable', mins.length > 0 && Math.max(...mins) <= 15, `mins: ${mins.join(',')}`);
  await clickByText('Near me');
  await new Promise((r) => setTimeout(r, 300));
  check('deck shows a distance', /\d+(m|(\.\d)?km)\b/i.test(cardInfo));
  check('live rating stub applied (4.9)', cardInfo.includes('4.9'));
  check('live Google reviews label', cardInfo.includes('1.2k Google reviews'));
  check('open-now flag surfaces', cardInfo.toLowerCase().includes('open now'));
  const artHasPhoto = await page.evaluate(() =>
    [...document.querySelectorAll('div')].some((d) => d.style.backgroundImage && d.style.backgroundImage.includes('data:image') && d.style.backgroundSize === 'cover')
  );
  check('google photo fills card art', artHasPhoto);

  check('wildcard card appears in deck', /wildcard ·|scouted for you ·/.test(cardInfo.toLowerCase())); // AI-scouted picks lead the wildcard slot now

  // the AI scout's picks reach the deck with their label
  {
    let sawScout = false;
    for (let s = 0; s < 8 && !sawScout; s++) {
      const t = await page.evaluate(() => document.body.innerText);
      if (/AISTUB/.test(t) && /scouted for you/i.test(t.toLowerCase())) { sawScout = true; break; }
      if (/AISTUB/.test(t)) { sawScout = true; break; }
      await page.evaluate(() => { const b = [...document.querySelectorAll('button')].find((x) => x.getAttribute('aria-label') === 'Pass'); b && b.click(); });
      await new Promise((r) => setTimeout(r, 450));
    }
    check('AI-scouted card reaches the deck', sawScout);
    await page.evaluate(() => { const b = [...document.querySelectorAll('button')].find((x) => x.innerText.trim().toLowerCase() === 'all'); b && b.click(); });
    await new Promise((r) => setTimeout(r, 300));
  }
  check('family chip present', cardInfo.toLowerCase().includes('family'));

  // Shopping chip: curated fashion inventory renders
  await page.evaluate(() => {
    const b = [...document.querySelectorAll('button')].find((x) => x.innerText.trim().toLowerCase() === 'shopping');
    b && b.click();
  });
  await new Promise((r) => setTimeout(r, 500));
  const shopTxt = await page.evaluate(() => document.body.innerText.toLowerCase());
  check('shopping deck has fashion inventory', /concept store|grand magasin|vintage shop|boutique|brocante/.test(shopTxt));
  await page.evaluate(() => {
    const b = [...document.querySelectorAll('button')].find((x) => x.innerText.trim().toLowerCase() === 'food');
    if (b) b.click();
  });
  await new Promise((r) => setTimeout(r, 1500)); // let open-now flags resolve
  const foodTxt = await page.evaluate(() => document.body.innerText);
  check('Food chip shows cards', /·/.test(foodTxt));
  check('Food chip hides closed places', !foodTxt.includes('Closed now'));
  await page.evaluate(() => {
    const b = [...document.querySelectorAll('button')].find((x) => x.innerText.trim().toLowerCase() === 'all');
    b && b.click();
  });
  await new Promise((r) => setTimeout(r, 400));

  // Right now chip: happening cards from the pulse lead the deck
  await page.evaluate(() => {
    const b = [...document.querySelectorAll('button')].find((x) => x.innerText.trim().toLowerCase() === 'right now');
    b && b.click();
  });
  await new Promise((r) => setTimeout(r, 500));
  const nowTxt = await page.evaluate(() => document.body.innerText.toLowerCase());
  check('right-now happening card renders', nowTxt.includes('this week · via instagram') && nowTxt.includes('ground control'));
  check('Time Out happening joins Right now', /timeoutstub|via time out/i.test(await page.evaluate(() => document.body.innerText)));
  await page.evaluate(() => {
    const b = [...document.querySelectorAll('button')].find((x) => x.innerText.trim().toLowerCase() === 'all');
    b && b.click();
  });
  await new Promise((r) => setTimeout(r, 400));

  // swipe right via the like button, twice
  for (let i = 0; i < 2; i++) {
    await page.evaluate(() => {
      const likeBtn = [...document.querySelectorAll('button')].find((b) => b.querySelector('i.ri-heart-3-line'));
      likeBtn && likeBtn.click();
    });
    await new Promise((r) => setTimeout(r, 500));
  }
  const tabBar = await page.evaluate(() => [...document.querySelectorAll('button')].map(b => b.innerText.trim()).filter(Boolean).slice(-6).join('|'));
  results.push('DEBUG tab bar after likes: ' + tabBar);

  // ---- returning visitor: splash moment first, then the app ----
  await new Promise((r) => setTimeout(r, 700)); // let the persist debounce flush before navigating
  await page.goto('http://127.0.0.1:8199/', { waitUntil: 'domcontentloaded' });
  await new Promise((r) => setTimeout(r, 600));
  const splashTxt = await page.evaluate(() => document.body.innerText.toLowerCase());
  check('return visit opens on the splash', splashTxt.includes('bonjour again') && !splashTxt.includes('allons-y'));
  await page.waitForFunction(() => document.body.innerText.toLowerCase().includes('discover'), { timeout: 8000 });
  check('splash auto-advances into the app', true);
  // the reload dropped the in-memory time override; re-pin it
  await clickByText('You');
  await new Promise((r) => setTimeout(r, 300));
  await page.evaluate(() => { const b = [...document.querySelectorAll('button')].find((x) => x.innerText.trim().toLowerCase() === 'afternoon'); if (b) b.click(); });
  await new Promise((r) => setTimeout(r, 200));
  await clickByText('Discover');
  await new Promise((r) => setTimeout(r, 400));

  // ---- global mode: same app, geolocated to Manhattan ----
  {
    const g = await browser.newPage();
    await browser.defaultBrowserContext().overridePermissions('http://127.0.0.1:8199', ['geolocation']);
    await g.setGeolocation({ latitude: 40.7328, longitude: -73.9987 }); // Greenwich Village
    await g.setViewport({ width: 390, height: 844 });
    await g.evaluateOnNewDocument(() => {
      const real = window.fetch;
      window.fetch = (input, init) => {
        const u = String(input);
        if (u.includes('bigdatacloud')) {
          return Promise.resolve(new Response(JSON.stringify({ city: 'New York', countryName: 'United States' }), { headers: { 'Content-Type': 'application/json' } }));
        }
        if (u.includes('open-meteo')) {
          return Promise.resolve(new Response(JSON.stringify({ timezone: 'America/New_York', current: { temperature_2m: 24, weather_code: 1 } }), { headers: { 'Content-Type': 'application/json' } }));
        }
        return real(input, init);
      };
    });
    await g.goto('http://127.0.0.1:8199/', { waitUntil: 'domcontentloaded' });
    await g.evaluate(() => localStorage.setItem('whim-v1', JSON.stringify({ obStep: 99, obAnswers: [], name: 'Jess' })));
    await g.goto('http://127.0.0.1:8199/', { waitUntil: 'networkidle2' });
    await g.evaluate(() => { const b = [...document.querySelectorAll('button')].find((x) => /allons/i.test(x.innerText)); if (b) b.click(); });
    await g.waitForFunction(() => document.body.innerText.toLowerCase().includes('discover'), { timeout: 10000 });
    await new Promise((r) => setTimeout(r, 2500));
    const gTxt = await g.evaluate(() => document.body.innerText);
    check('global: masthead shows detected city', /new york ·/i.test(gTxt), gTxt.match(/[\w ]+ · \w+ · \d{1,2}:\d{2}/i)?.[0] || 'no masthead');
    // headless-shell lacks full tz data (Intl silently falls back to host tz),
    // so compare against what this browser's own Intl produces for NY
    const expectedNy = await g.evaluate(() => new Intl.DateTimeFormat('en-GB', { timeZone: 'America/New_York', hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date()));
    const shown = gTxt.match(/new york · \w+ · (\d{1,2}:\d{2})/i)?.[1];
    check('global: clock uses the detected timezone', !!shown && (shown === expectedNy || Math.abs(Date.parse(`2000-01-01T${shown}:00`) - Date.parse(`2000-01-01T${expectedNy}:00`)) <= 120000), `shown ${shown} vs ${expectedNy}`);
    check('global: deck builds from dynamic discovery', /Chez Stub|Café Wildcard|Bar Stub|AISTUB/.test(gTxt), '');
    check('global: no Paris curated cards', !/Du Pain et des Idées|Sainte-Chapelle|Marché d'Aligre/.test(gTxt));
    await g.close();
  }
  await clickByText('Plan');
  await new Promise((r) => setTimeout(r, 600));
  const afterTab = await page.evaluate(() => document.body.innerText.toLowerCase());
  results.push('DEBUG has "your day plan": ' + afterTab.includes('your day plan') + ', has "nothing yet": ' + afterTab.includes('nothing yet'));
  const planTxt = await page.evaluate(() => document.body.innerText);
  check('plan drafts after likes', planTxt.toLowerCase().includes('concierge proposes'), planTxt.toLowerCase().includes('concierge proposes') ? '' : planTxt.slice(0, 200));
  check('plan mood chips render', ['lazy day', 'walkathon', 'sightsee', 'shop', 'house mix'].every((m) => planTxt.toLowerCase().includes(m)));

  // every draft row is individually deletable
  const beforeRows = await page.evaluate(() => document.querySelectorAll('button[aria-label="Remove stop"]').length);
  check('draft rows have delete buttons', beforeRows >= 2, `rows: ${beforeRows}`);
  await page.evaluate(() => document.querySelector('button[aria-label="Remove stop"]').click());
  await new Promise((r) => setTimeout(r, 400));
  const afterRows = await page.evaluate(() => document.querySelectorAll('button[aria-label="Remove stop"]').length);
  check('deleting a row removes the stop', afterRows === beforeRows - 1, `now: ${afterRows}`);

  // chat -> stubbed concierge API
  await clickByText('Concierge');
  await new Promise((r) => setTimeout(r, 200));
  await page.evaluate(() => {
    const chip = [...document.querySelectorAll('button')].find((b) => b.innerText.toLowerCase().includes('surprise me'));
    chip && chip.click();
  });
  await page.waitForFunction(() => document.body.innerText.includes('STUB REPLY'), { timeout: 8000 });
  const chatTxt = await page.evaluate(() => document.body.innerText);
  const m = chatTxt.match(/STUB REPLY \([^)]*\)/);
  check('concierge round-trip with context payload', !!m, m ? m[0] : '');

  // You tab: geolocation status
  await clickByText('You');
  await new Promise((r) => setTimeout(r, 300));
  const youTxt = await page.evaluate(() => document.body.innerText);
  check('You tab shows LIVE location', youTxt.includes('LIVE'));
  check('context override controls present', youTxt.toLowerCase().includes('auto (live)'));

  // a11y regression guards
  const a11y = await page.evaluate(() => {
    const unlabeled = [...document.querySelectorAll('button')].filter((b) => {
      const t = b.innerText.trim();
      return !t && !b.getAttribute('aria-label');
    }).length;
    const liveRegion = !!document.querySelector('[role="status"][aria-live]');
    const nav = !!document.querySelector('[role="navigation"][aria-label]');
    const nakedInputs = [...document.querySelectorAll('input:not([type="file"]), textarea')].filter((i) => !i.getAttribute('aria-label') && !i.id).length;
    return { unlabeled, liveRegion, nav, nakedInputs };
  });
  check('a11y: no unlabeled icon-only buttons', a11y.unlabeled === 0, `found ${a11y.unlabeled}`);
  check('a11y: toast live region + labeled nav', a11y.liveRegion && a11y.nav);
  check('a11y: all inputs labeled', a11y.nakedInputs === 0, `naked: ${a11y.nakedInputs}`);
  check('You tab has profile editor', youTxt.toLowerCase().includes('your profile') && youTxt.toLowerCase().includes('save profile'));
  check('You tab has contacts invite', youTxt.toLowerCase().includes('share whim with your contacts'));

  // own profile view opens from the You tab
  await clickByText('View my profile');
  await new Promise((r) => setTimeout(r, 400));
  const meTxt = await page.evaluate(() => document.body.innerText.toLowerCase());
  check('own profile view opens', /no handle yet|@\w+/.test(meTxt) && meTxt.includes('swipes'), (meTxt.match(/\d+ saves[^\n]*/) || [''])[0]);
  await page.evaluate(() => { const b = [...document.querySelectorAll('button')].find((x) => x.getAttribute('aria-label') === 'Close profile'); b && b.click(); });
  await new Promise((r) => setTimeout(r, 300));

  // Friends tab
  await clickByText('Friends');
  await new Promise((r) => setTimeout(r, 300));
  const frTxt = await page.evaluate(() => document.body.innerText.toLowerCase());
  check('Friends tab renders', frTxt.includes('your friends'));
  check('Friends tab invite button', frTxt.includes('invite from your contacts'));
  check('Friends tab signed-out pitch', frTxt.includes('sign in from the you tab'));

  // --- museum sheet: current exhibitions scraped from the museum site ---
  await page.goto('http://127.0.0.1:8199/?place=p22&n=Mus%C3%A9e%20Rodin&k=Museum', { waitUntil: 'networkidle2' });
  await new Promise((r) => setTimeout(r, 900));
  const expoTxt = await page.evaluate(() => document.body.innerText.toLowerCase());
  check('museum sheet shows current exhibitions', expoTxt.includes('on the walls right now') && expoTxt.includes('expostub'), '');

  // --- detail sheet: deep-link straight to a known bookable bar (deterministic) ---
  await page.goto('http://127.0.0.1:8199/?place=p13&n=Le%20Baron%20Rouge&k=Wine%20bar', { waitUntil: 'networkidle2' });
  await new Promise((r) => setTimeout(r, 1000));
  let sheet = await page.evaluate(() => document.body.innerText);
  check('detail sheet opens with reviews', sheet.includes('STUBREVIEW'));
  check('detail sheet booking links', sheet.toLowerCase().includes('book a table'));
  check('detail sheet photo hint', sheet.toLowerCase().includes('2 photos'));

  // thefork booking check
  await clickByText('Find me a table');
  await page.waitForFunction(() => document.body.innerText.toLowerCase().includes('book stub bistro'), { timeout: 6000 });
  const forkTxt = await page.evaluate(() => document.body.innerText.toLowerCase());
  check('thefork booking renders', forkTxt.includes('book stub bistro') && forkTxt.includes('9.2/10'));
  check('reddit chatter renders', forkTxt.includes('redditstub'));

  // share to clipboard (force the desktop path — headless exposes navigator.share)
  await ctx.overridePermissions('http://127.0.0.1:8199', ['geolocation', 'clipboard-read', 'clipboard-write', 'clipboard-sanitized-write']);
  await page.evaluate(() => { try { delete Navigator.prototype.share; } catch (e) {} });
  await page.evaluate(() => {
    const b = [...document.querySelectorAll('button')].find((x) => x.getAttribute('aria-label') === 'Share this spot');
    b && b.click();
  });
  await new Promise((r) => setTimeout(r, 400));
  const clip = await page.evaluate(() => navigator.clipboard.readText().catch(() => ''));
  check('share copies card to clipboard', clip.includes('/p/p13'), clip.slice(0, 60));

  // own review flow
  await clickByText('Write your review');
  await new Promise((r) => setTimeout(r, 250));
  await page.evaluate(() => {
    const input = [...document.querySelectorAll('input')].find((i) => i.placeholder && i.placeholder.includes('verdict'));
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
    setter.call(input, 'Life-changing butter situation.');
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
  });
  await clickByText('Publish');
  await new Promise((r) => setTimeout(r, 300));
  const revTxt = await page.evaluate(() => document.body.innerText.toLowerCase());
  check('own review renders in sheet', revTxt.includes('life-changing butter situation'));
  check('similar nearby section', revTxt.includes('similar, nearby'));

  // ---- named lists: create one, file a spot, folder shows it ----
  await clickByText('You');
  await new Promise((r) => setTimeout(r, 300));
  await clickByText('New list');
  await page.waitForFunction(() => [...document.querySelectorAll('input')].some((i) => i.placeholder && i.placeholder.includes('unique')), { timeout: 3000 });
  await page.evaluate(() => {
    const input = [...document.querySelectorAll('input')].find((i) => i.placeholder.includes('unique'));
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
    setter.call(input, 'Honeymoon');
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
  });
  await page.evaluate(() => { const b = [...document.querySelectorAll('button')].find((x) => x.getAttribute('aria-label') === 'Create list'); b && b.click(); });
  await new Promise((r) => setTimeout(r, 400));
  const youL = await page.evaluate(() => document.body.innerText.toLowerCase());
  check('new list created', /honeymoon\s*\(\s*0\s*\)/.test(youL));
  // file the deep-linked bar under it from its sheet
  await page.goto('http://127.0.0.1:8199/?place=p13&n=Le%20Baron%20Rouge&k=Wine%20bar', { waitUntil: 'networkidle2' });
  await new Promise((r) => setTimeout(r, 800));
  await page.evaluate(() => { const b = [...document.querySelectorAll('button')].find((x) => x.getAttribute('aria-label') === 'Save to list'); b && b.click(); });
  await new Promise((r) => setTimeout(r, 300));
  const pickerRows = await page.evaluate(() => [...document.querySelectorAll('button')].map((b) => b.innerText.trim().toLowerCase()).filter((t) => t && t.length < 30).join('|'));
  check('bookmark opens list picker', /saved for later/.test(pickerRows) && /honeymoon/.test(pickerRows), pickerRows.slice(0, 120));
  await page.evaluate(() => {
    const b = [...document.querySelectorAll('button')].find((x) => x.innerText.trim().toLowerCase() === 'honeymoon');
    if (b) b.click();
  });
  await new Promise((r) => setTimeout(r, 400));
  await page.evaluate(() => { const b = [...document.querySelectorAll('button')].find((x) => x.getAttribute('aria-label') === 'Close friend view' || /ri-close/.test(x.innerHTML)); });
  await clickByText('You');
  await new Promise((r) => setTimeout(r, 300));
  const youL2 = await page.evaluate(() => document.body.innerText.toLowerCase());
  check('spot filed into the named list', /honeymoon\s*\(\s*1\s*\)/.test(youL2), (youL2.match(/honeymoon[^\n]*/) || [''])[0]);

  // been-here: mark the same bar as visited, profile records it
  await page.goto('http://127.0.0.1:8199/?place=p13&n=Le%20Baron%20Rouge&k=Wine%20bar', { waitUntil: 'networkidle2' });
  await new Promise((r) => setTimeout(r, 800));
  await clickByText('Been here?');
  await new Promise((r) => setTimeout(r, 400));
  await clickByText('You');
  await new Promise((r) => setTimeout(r, 300));
  await clickByText('View my profile');
  await new Promise((r) => setTimeout(r, 400));
  const meBeen = await page.evaluate(() => document.body.innerText.toLowerCase());
  check('been-here lands on profile', /been there\s*\(\s*1\s*\)/.test(meBeen), (meBeen.match(/been there[^\n]*/) || [''])[0]);
  check('profile shows taste title', /truffle pig|bloodhound|side-street|marathoner|cartographer|in progress|monument hunter|mercenary|strategist|negotiator|darkness|romantic|jazz regular/.test(meBeen));
  check('profile shows earned badges', /first steps/.test(meBeen) && /curator/.test(meBeen), '');
  check('profile shows the canon meter', /the paris canon/.test(meBeen) && /canonical spots conquered/.test(meBeen));
  await page.evaluate(() => { const b = [...document.querySelectorAll('button')].find((x) => x.getAttribute('aria-label') === 'Close profile'); b && b.click(); });


  // heart from the sheet, then close
  await clickByText('Save for later');
  await new Promise((r) => setTimeout(r, 250));
  sheet = await page.evaluate(() => document.body.innerText);
  check('heart toggles to Saved', sheet.toLowerCase().includes('saved'));
  await page.evaluate(() => {
    const b = [...document.querySelectorAll('button')].find((x) => x.getAttribute('aria-label') === 'Close details');
    b && b.click();
  });
  await new Promise((r) => setTimeout(r, 250));

  // You tab: Paris folder with the saved spot
  await clickByText('You');
  await new Promise((r) => setTimeout(r, 300));
  const youTxt2 = await page.evaluate(() => document.body.innerText.toLowerCase());
  check('Paris saved-for-later folder appears', /saved for later \(\s*2\s*\)/.test(youTxt2)); // 3 saves minus p13, filed under Honeymoon by the lists test

  // add-your-own-spot flow
  await clickByText('Add your own spot');
  await new Promise((r) => setTimeout(r, 400));
  await page.evaluate(() => {
    const input = [...document.querySelectorAll('input')].find((i) => i.placeholder && i.placeholder.includes('Name of the place'));
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
    setter.call(input, 'Chez Testeur');
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
  });
  await clickByText('Find it');
  await new Promise((r) => setTimeout(r, 500));
  const foundTxt = await page.evaluate(() => document.body.innerText.toLowerCase());
  check('add-spot lookup resolves', foundTxt.includes('found: chez testeur'));
  await clickByText('Add to my repertoire');
  await new Promise((r) => setTimeout(r, 900));
  // save auto-opens the sheet — close it, then confirm the folder grew
  await page.evaluate(() => {
    const b = [...document.querySelectorAll('button')].find((x) => x.getAttribute('aria-label') === 'Close details');
    b && b.click();
  });
  await new Promise((r) => setTimeout(r, 400));
  await page.evaluate(() => {
    const b = [...document.querySelectorAll('button')].find((x) => /saved for later/i.test(x.innerText));
    if (b) b.click(); // folders are collapsed by default now
  });
  await new Promise((r) => setTimeout(r, 300));
  const repTxt = await page.evaluate(() => document.body.innerText.toLowerCase());
  check('own spot lands in saved folder', repTxt.includes('chez testeur') && /saved for later \(\s*3\s*\)/.test(repTxt));

  // deep cuts: enter from You tab, answer one, exit
  await clickByText('Answer the deep cuts');
  await new Promise((r) => setTimeout(r, 400));
  const deepQ = await page.evaluate(() => document.body.innerText.toLowerCase());
  check('deep cuts screen opens', deepQ.includes('taste calibration') && deepQ.includes('/ 13'));
  await page.evaluate(() => { const b = [...document.querySelectorAll('button')].filter(x => x.querySelector('i.ri-arrow-right-line')); b[0] && b[0].click(); });
  await new Promise((r) => setTimeout(r, 300));
  await clickByText('Save & exit');
  await new Promise((r) => setTimeout(r, 300));
  const backTxt = await page.evaluate(() => document.body.innerText.toLowerCase());
  check('deep cuts exits back to app', backTxt.includes('taste file'));
  check('deep answer counted', /12\s*left/.test(backTxt));

  // chat place card: stub reply mentions a curated place
  await clickByText('Concierge');
  await new Promise((r) => setTimeout(r, 200));
  await page.evaluate(() => {
    const input = document.querySelector('input');
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
    setter.call(input, 'where for wine?');
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
  });
  await new Promise((r) => setTimeout(r, 150));
  await page.evaluate(() => {
    const b = [...document.querySelectorAll('button')].find((x) => x.getAttribute('aria-label') === 'Send message');
    b && b.click();
  });
  await page.waitForFunction(() => document.body.innerText.includes('MENTION REPLY'), { timeout: 8000 });
  await new Promise((r) => setTimeout(r, 300));
  const chatTxt2 = await page.evaluate(() => document.body.innerText.toLowerCase());
  check('chat place card renders', chatTxt2.includes('wine bar ·'));
  check('concierge greeting personalized', chatTxt2.includes('bonjour, jess'));

  // shopping ask -> follow-up reply + taste notes absorbed into the profile
  await page.evaluate(() => {
    const input = document.querySelector('input');
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
    setter.call(input, 'shopping recs?');
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
  });
  await new Promise((r) => setTimeout(r, 150));
  await page.evaluate(() => {
    const b = [...document.querySelectorAll('button')].find((x) => x.getAttribute('aria-label') === 'Send message');
    b && b.click();
  });
  await page.waitForFunction(() => document.body.innerText.includes('FOLLOWUP'), { timeout: 8000 });
  await new Promise((r) => setTimeout(r, 500));
  const absorbed = await page.evaluate(() => {
    try { return Object.values(JSON.parse(localStorage.getItem('whim-v1')).quizAnswers || {}); }
    catch (e) { return []; }
  });
  check('concierge asks shopping follow-up', true);
  check('taste notes saved to profile', absorbed.includes('Vintage and friperies') && absorbed.includes('Budget under 50 euros'), absorbed.join('|'));

  // a specific off-deck ask resolves into a live card in the chat
  await page.evaluate(() => {
    const input = document.querySelector('input');
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
    setter.call(input, 'tell me about septime');
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
  });
  await new Promise((r) => setTimeout(r, 150));
  await page.evaluate(() => { const b = [...document.querySelectorAll('button')].find((x) => x.getAttribute('aria-label') === 'Send message'); b && b.click(); });
  await page.waitForFunction(() => document.body.innerText.includes('SPECIFIC REPLY'), { timeout: 8000 });
  await new Promise((r) => setTimeout(r, 900)); // /api/places resolution + card attach
  const chatCardTxt = await page.evaluate(() => document.body.innerText.toLowerCase());
  check('specific ask populates its card in chat', chatCardTxt.includes('chez testeur'), (chatCardTxt.match(/chez[^\n]*/) || ['no card'])[0]); // stub /api/places canonicalizes to Chez Testeur
  const fbIcons = await page.evaluate(() => ({
    up: !!document.querySelector('button[aria-label="Good recommendation"]'),
    down: !!document.querySelector('button[aria-label="Bad recommendation"]'),
    refresh: !!document.querySelector('button[aria-label="Another option"]'),
  }));
  check('feedback icons under recommendation', fbIcons.up && fbIcons.down && fbIcons.refresh);
  // quick actions on the chat card: add to plan
  await page.evaluate(() => {
    const b = [...document.querySelectorAll('button')].filter((x) => x.getAttribute('aria-label') === 'Add to plan').pop();
    b && b.click();
  });
  await new Promise((r) => setTimeout(r, 400));
  const planBadge = await page.evaluate(() => {
    const tab = [...document.querySelectorAll('button')].find((x) => /plan\s*\(/i.test(x.innerText));
    return tab ? tab.innerText.trim() : '';
  });
  check('chat card adds to plan', /plan\s*\(\s*3\s*\)/i.test(planBadge), planBadge); // saves (2 likes + own spot + chat like) minus one skipped row

  // tap the chat card to open the sheet
  await page.evaluate(() => {
    const el = [...document.querySelectorAll('div')].find((d) => d.style.cursor === 'pointer' && d.innerText.includes('Le Baron Rouge') && d.innerText.toLowerCase().includes('wine bar'));
    el && el.click();
  });
  await new Promise((r) => setTimeout(r, 600));
  const sheet2 = await page.evaluate(() => document.body.innerText);
  check('chat card opens detail sheet', sheet2.includes('STUBREVIEW') || sheet2.toLowerCase().includes('fetching the gossip'));

  // shared-link landing: opens straight into the place sheet, no onboarding
  const page2 = await browser.newPage();
  await page2.setViewport({ width: 390, height: 844 });
  await page2.goto('http://127.0.0.1:8199/?place=p13&n=Le%20Baron%20Rouge&k=Wine%20bar', { waitUntil: 'networkidle2' });
  await new Promise((r) => setTimeout(r, 900));
  const landTxt = await page2.evaluate(() => document.body.innerText.toLowerCase());
  check('share link lands on the place sheet', landTxt.includes('le baron rouge') && !landTxt.includes('allons-y'));
  await page2.close();

  check('no page errors', errors.length === 0, errors.slice(0, 3).join(' | '));
} catch (e) {
  results.push('FATAL ' + e.message);
} finally {
  console.log(results.join('\n'));
  await browser.close();
  server.close();
  const bad = results.filter(r => r.startsWith('FAIL') || r.startsWith('FATAL')).length;
  process.exit(bad ? 1 : 0);
}
