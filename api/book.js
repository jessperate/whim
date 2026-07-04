// Table lookup via TheFork (clearpath/thefork-scraper on Apify).
// TheFork has no per-name search input and is DataDome-protected, so we keep a
// weekly snapshot of the top Paris restaurants and match names instantly:
//   GET ?name=<restaurant> -> match from the last successful run (edge-cached)
//   GET ?refresh=1         -> kick a fresh 150-restaurant Paris run (weekly cron)

const ACTOR = 'clearpath~thefork-scraper';

const normalize = (s) =>
  String(s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();

export default async function handler(req, res) {
  const token = process.env.APIFY_TOKEN;
  if (!token) return res.status(200).json({ ok: false, reason: 'no_key' });

  if (req.query.refresh) {
    const secret = process.env.CRON_SECRET;
    if (secret && req.headers.authorization !== `Bearer ${secret}`) {
      return res.status(401).json({ ok: false, reason: 'unauthorized' });
    }
    try {
      const r = await fetch(`https://api.apify.com/v2/acts/${ACTOR}/runs?token=${token}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          searchLocation: 'Paris',
          sort: 'popularity',
          bestRated: true,
          maxRestaurants: 400,
          maxReviews: 0,
          maxPhotos: 0,
          language: 'en',
        }),
      });
      const j = await r.json();
      return res.status(200).json({ ok: r.ok, started: j?.data?.id || null });
    } catch (e) {
      return res.status(200).json({ ok: false, reason: 'start_failed' });
    }
  }

  const name = String(req.query.name || '').slice(0, 80);
  if (!name) return res.status(400).json({ ok: false, reason: 'bad_params' });

  try {
    const r = await fetch(`https://api.apify.com/v2/acts/${ACTOR}/runs/last/dataset/items?token=${token}&status=SUCCEEDED&limit=500`);
    if (!r.ok) return res.status(200).json({ ok: false, reason: `apify_${r.status}` });
    const items = await r.json();
    if (!Array.isArray(items) || !items.length) {
      return res.status(200).json({ ok: false, reason: 'no_run_yet' });
    }

    if (req.query.peek) {
      return res.status(200).json({ count: items.length, names: items.slice(0, 20).map(i => `${i.name} [${i.locality}]`) });
    }
    if (req.query.feed) {
      const feed = items
        .filter((i) => i.name && i.is_bookable !== false && i.latitude != null && (i.thefork_rating ?? 0) >= 9)
        .sort((a, b) => (b.thefork_rating ?? 0) - (a.thefork_rating ?? 0))
        .slice(0, 60)
        .map((i) => ({
          name: i.name,
          url: i.url || null,
          rating: i.thefork_rating != null ? Number(i.thefork_rating).toFixed(1) : null,
          ratings: i.rating_count ?? i.thefork_review_count ?? null,
          price: i.avg_price != null ? `${i.avg_price}${i.avg_price_currency === 'EUR' ? '€' : ''}` : null,
          cuisine: i.cuisine || null,
          lat: i.latitude, lng: i.longitude,
        }));
      res.setHeader('Cache-Control', 's-maxage=43200, stale-while-revalidate=604800');
      return res.status(200).json({ ok: true, feed });
    }
    const want = normalize(name);
    const hit = items.find((i) => {
      const got = normalize(i.name);
      return got && (got === want || got.includes(want) || want.includes(got));
    });
    res.setHeader('Cache-Control', 's-maxage=43200, stale-while-revalidate=604800');
    if (!hit) return res.status(200).json({ ok: true, found: false });

    return res.status(200).json({
      ok: true,
      found: true,
      match: hit.name || null,
      url: hit.url || null,
      bookable: hit.is_bookable !== false,
      rating: hit.thefork_rating != null ? Number(hit.thefork_rating).toFixed(1) : null, // /10
      price: hit.avg_price != null ? `${hit.avg_price}${hit.avg_price_currency === 'EUR' ? '€' : ''}` : null,
      cuisine: hit.cuisine || null,
    });
  } catch (e) {
    return res.status(200).json({ ok: false, reason: 'fetch_failed' });
  }
}
