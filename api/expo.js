// What's on at a museum right now: resolve its website via Google Places,
// scrape the homepage (plus an /exhibitions path when present), and let the
// model pull out current shows. Cached hard — exhibitions change monthly.
// GET ?name=<museum>&ll=<lat,lng> -> { ok, site, expos: [{ title, when }] }

const strip = (html) =>
  String(html)
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&[a-z#0-9]+;/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const grab = async (url) => {
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 6000);
    const r = await fetch(url, {
      signal: ctrl.signal,
      headers: { 'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15', 'Accept-Language': 'en,fr;q=0.8' },
      redirect: 'follow',
    });
    clearTimeout(t);
    if (!r.ok) return null;
    return await r.text();
  } catch (e) { return null; }
};

export default async function handler(req, res) {
  const gkey = process.env.GOOGLE_PLACES_API_KEY;
  const okey = process.env.OPENAI_API_KEY;
  if (!gkey || !okey) return res.status(200).json({ ok: false, reason: 'no_key' });

  const name = String(req.query.name || '').slice(0, 90);
  const ll = String(req.query.ll || '');
  if (!name) return res.status(400).json({ ok: false, reason: 'bad_params' });

  try {
    // 1. the museum's own site
    const search = await fetch('https://places.googleapis.com/v1/places:searchText', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Goog-Api-Key': gkey, 'X-Goog-FieldMask': 'places.websiteUri' },
      body: JSON.stringify({
        textQuery: name,
        ...(ll ? { locationBias: { circle: { center: { latitude: +ll.split(',')[0], longitude: +ll.split(',')[1] }, radius: 3000 } } } : {}),
        pageSize: 1,
      }),
    }).then((r) => (r.ok ? r.json() : null));
    const site = search?.places?.[0]?.websiteUri || null;
    if (!site) {
      res.setHeader('Cache-Control', 's-maxage=259200, stale-while-revalidate=1209600');
      return res.status(200).json({ ok: true, site: null, expos: [] });
    }

    // 2. scrape home + the likely exhibitions page
    const home = await grab(site);
    let extra = null;
    if (home) {
      const m = String(home).match(/href="([^"]*(?:exposition|exhibition|whats-on|en-ce-moment|agenda)[^"]*)"/i);
      if (m) {
        try { extra = await grab(new URL(m[1], site).href); } catch (e) { /* bad href */ }
      }
    }
    const text = [strip(home || ''), strip(extra || '')].join('\n---\n').slice(0, 9000);
    if (text.length < 200) {
      res.setHeader('Cache-Control', 's-maxage=259200, stale-while-revalidate=1209600');
      return res.status(200).json({ ok: true, site, expos: [] });
    }

    // 3. extract current shows
    const r = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${okey}` },
      body: JSON.stringify({
        model: 'gpt-5.1',
        max_completion_tokens: 400,
        reasoning_effort: 'low',
        messages: [
          { role: 'system', content: 'You extract current temporary exhibitions from museum-website text. Return ONLY exhibitions that appear to be on now or opening soon (ignore permanent collection, past shows, memberships, tickets). Max 4. title: the exhibition name as written (keep original language). when: the human-readable date range if present, else empty string. If nothing qualifies, return an empty list.' },
          { role: 'user', content: `Museum: ${name}\nWebsite text:\n${text}` },
        ],
        response_format: {
          type: 'json_schema',
          json_schema: {
            name: 'exhibitions', strict: true,
            schema: {
              type: 'object', additionalProperties: false, required: ['expos'],
              properties: { expos: { type: 'array', items: {
                type: 'object', additionalProperties: false, required: ['title', 'when'],
                properties: { title: { type: 'string' }, when: { type: 'string' } },
              } } },
            },
          },
        },
      }),
    });
    if (!r.ok) return res.status(200).json({ ok: false, reason: `openai_${r.status}` });
    const data = await r.json();
    let expos = [];
    try { expos = (JSON.parse(data.choices?.[0]?.message?.content || '{}').expos || []).slice(0, 4)
      .map((e) => ({ title: String(e.title).slice(0, 120), when: String(e.when || '').slice(0, 80) })); } catch (e) { /* prose fallback: no expos */ }

    res.setHeader('Cache-Control', 's-maxage=259200, stale-while-revalidate=1209600'); // 3 days
    return res.status(200).json({ ok: true, site, expos });
  } catch (e) {
    return res.status(200).json({ ok: false, reason: 'fetch_failed' });
  }
}
