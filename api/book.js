// Table lookup via TheFork (clearpath/thefork-scraper on Apify) — Paris-native
// booking coverage. Returns the restaurant's direct TheFork page, rating on
// TheFork's 10-scale, average price, and bookability.
// GET ?name=<restaurant>
// (The earlier Resy integration returned found:false for nearly all of Paris —
// Resy barely operates here; TheFork is the local standard.)

export const maxDuration = 120; // actor runs take tens of seconds

const ACTOR = 'clearpath~thefork-scraper';

export default async function handler(req, res) {
  const token = process.env.APIFY_TOKEN;
  if (!token) return res.status(200).json({ ok: false, reason: 'no_key' });

  const name = String(req.query.name || '').slice(0, 80);
  if (!name) return res.status(400).json({ ok: false, reason: 'bad_params' });

  try {
    const r = await fetch(
      `https://api.apify.com/v2/acts/${ACTOR}/run-sync-get-dataset-items?token=${token}&timeout=100`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          startUrls: [{ url: `https://www.thefork.fr/search?queryText=${encodeURIComponent(name)}` }],
          maxRestaurants: 3,
          maxReviews: 0,
          maxPhotos: 0,
          language: 'en',
        }),
      }
    );
    if (!r.ok) return res.status(200).json({ ok: false, reason: `apify_${r.status}` });
    const items = await r.json();
    if (!Array.isArray(items) || !items.length) {
      return res.status(200).json({ ok: true, found: false });
    }

    const inParis = items.filter((i) => /paris/i.test(String(i.locality || i.formatted_address || '')));
    const low = name.toLowerCase();
    const hit = inParis.find((i) => String(i.name || '').toLowerCase().includes(low)) || inParis[0];
    if (!hit) return res.status(200).json({ ok: true, found: false });

    res.setHeader('Cache-Control', 's-maxage=43200, stale-while-revalidate=604800');
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
