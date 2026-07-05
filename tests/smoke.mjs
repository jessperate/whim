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
    return res.end(JSON.stringify({ ok: true, places: [
      { id: 'w1', name: 'Chez Stub', type: 'restaurant', lat: 48.8612, lng: 2.3588, rating: '4.6', ratings: 2100, blurb: 'A neighborhood favorite.' },
      { id: 'w2', name: 'Café Wildcard', type: 'cafe', lat: 48.8598, lng: 2.3611, rating: '4.5', ratings: 800, blurb: null },
      { id: 'w3', name: 'Bar Stub', type: 'wine_bar', lat: 48.8605, lng: 2.3577, rating: '4.7', ratings: 1500, blurb: 'Natural wine, no attitude.' },
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
    return res.end(JSON.stringify({ ok: true, rating: '4.9', ratings: 1234, openNow: true, photo: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==', lat: 48.8611, lng: 2.3574, match: 'Chez Testeur' }));
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
    await page.evaluate(() => {
      const btns = [...document.querySelectorAll('button')].filter((b) => b.querySelector('i.ri-arrow-right-line'));
      if (btns[0]) btns[0].click();
    });
    await new Promise((r) => setTimeout(r, 120));
  }
  await page.waitForFunction(() => document.body.innerText.toLowerCase().includes('discover'), { timeout: 8000 });
  check('onboarding completes into app', true);

  // masthead context line: real clock + weather label present
  const ctxLine = await page.evaluate(() => {
    const m = document.body.innerText.match(/Paris · \w+ · \d{1,2}:\d{2} · [^\n]+/i);
    return m ? m[0] : null;
  });
  check('context line shows real weekday/clock/weather', !!ctxLine, ctxLine || 'not found');

  // deck cards with live stub data
  await new Promise((r) => setTimeout(r, 1200));
  const cardInfo = await page.evaluate(() => document.body.innerText);
  check('deck shows a distance', /\d+(m|(\.\d)?km)\b/i.test(cardInfo));
  check('live rating stub applied (4.9)', cardInfo.includes('4.9'));
  check('live Google reviews label', cardInfo.includes('1.2k Google reviews'));
  check('open-now flag surfaces', cardInfo.toLowerCase().includes('open now'));
  const artHasPhoto = await page.evaluate(() =>
    [...document.querySelectorAll('div')].some((d) => d.style.backgroundImage && d.style.backgroundImage.includes('data:image') && d.style.backgroundSize === 'cover')
  );
  check('google photo fills card art', artHasPhoto);

  check('wildcard card appears in deck', cardInfo.toLowerCase().includes('wildcard ·'));
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
  await clickByText('Plan');
  await new Promise((r) => setTimeout(r, 600));
  const afterTab = await page.evaluate(() => document.body.innerText.toLowerCase());
  results.push('DEBUG has "your day plan": ' + afterTab.includes('your day plan') + ', has "nothing yet": ' + afterTab.includes('nothing yet'));
  const planTxt = await page.evaluate(() => document.body.innerText);
  check('plan drafts after likes', planTxt.toLowerCase().includes('concierge proposes'), planTxt.toLowerCase().includes('concierge proposes') ? '' : planTxt.slice(0, 200));

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
  check('You tab has profile editor', youTxt.toLowerCase().includes('your profile') && youTxt.toLowerCase().includes('save profile'));
  check('You tab has contacts invite', youTxt.toLowerCase().includes('share whim with your contacts'));

  // Friends tab
  await clickByText('Friends');
  await new Promise((r) => setTimeout(r, 300));
  const frTxt = await page.evaluate(() => document.body.innerText.toLowerCase());
  check('Friends tab renders', frTxt.includes('your friends'));
  check('Friends tab invite button', frTxt.includes('invite from your contacts'));
  check('Friends tab signed-out pitch', frTxt.includes('sign in from the you tab'));

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
  check('Paris saved-for-later folder appears', /saved for later \(\s*1\s*\)/.test(youTxt2));

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
  const repTxt = await page.evaluate(() => document.body.innerText.toLowerCase());
  check('own spot lands in saved folder', repTxt.includes('chez testeur') && /saved for later \(\s*2\s*\)/.test(repTxt));

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
  check('chat card adds to plan', /plan\s*\(\s*3\s*\)/i.test(planBadge), planBadge);

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
