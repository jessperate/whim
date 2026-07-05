// Time Out's local magazine: fresh things-to-do / events for the user's city.
// GET ?city=<name> -> { ok, city, items: [{ text, url }] }, cached 6h.
// Paris rides the French edition; other cities try timeout.com slugs.

const clean = (s) => String(s)
  .replace(/&amp;/g, '&').replace(/&#x27;|&#39;|&rsquo;/g, '’')
  .replace(/&quot;/g, '"').replace(/&[a-z#0-9]+;/gi, ' ')
  .replace(/\s+/g, ' ').trim();

const grab = async (url) => {
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 7000);
    const r = await fetch(url, {
      signal: ctrl.signal, redirect: 'follow',
      headers: { 'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15', 'Accept-Language': 'en,fr;q=0.8' },
    });
    clearTimeout(t);
    return r.ok ? { html: await r.text(), base: new URL(r.url).origin } : null;
  } catch (e) { return null; }
};

export default async function handler(req, res) {
  const city = String(req.query.city || 'Paris').slice(0, 40);
  const slug = city.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z ]/g, '').trim();

  const candidates = slug === 'paris'
    ? ['https://www.timeout.fr/paris/que-faire-a-paris']
    : [
        `https://www.timeout.com/${slug.replace(/ /g, '')}/things-to-do`,
        `https://www.timeout.com/${slug.replace(/ /g, '-')}/things-to-do`,
      ];

  let got = null;
  for (const u of candidates) {
    got = await grab(u);
    if (got) break;
  }
  if (!got) {
    res.setHeader('Cache-Control', 's-maxage=21600, stale-while-revalidate=86400');
    return res.status(200).json({ ok: false, reason: 'no_city_edition', city });
  }

  const items = [];
  const seen = new Set();
  const re = /<a [^>]*href="((?:https?:)?\/[^"]{4,200})"[^>]*>[\s\S]{0,500}?<h3[^>]*>([^<]{10,110})<\/h3>/g;
  let m;
  while ((m = re.exec(got.html)) && items.length < 10) {
    const title = clean(m[2]);
    const key = title.toLowerCase();
    if (seen.has(key) || /cookie|newsletter|abonn/i.test(title)) continue;
    seen.add(key);
    let url;
    try { url = new URL(m[1], got.base).href; } catch (e) { continue; }
    items.push({ text: title.slice(0, 160), url });
  }

  res.setHeader('Cache-Control', 's-maxage=21600, stale-while-revalidate=86400'); // 6h
  return res.status(200).json({ ok: true, city, items });
}
