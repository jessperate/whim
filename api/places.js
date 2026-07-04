// Foursquare Places proxy — keeps FSQ_API_KEY server-side.
// Looks up one venue by name near a lat,lng and returns rating / ratings count / open-now.
// Supports both new service keys (Bearer, places-api.foursquare.com) and
// legacy fsq3 keys (api.foursquare.com/v3).

export default async function handler(req, res) {
  const { name, ll } = req.query;
  if (!name || !ll || !/^-?\d+(\.\d+)?,-?\d+(\.\d+)?$/.test(ll)) {
    return res.status(400).json({ ok: false, reason: 'bad_params' });
  }
  const key = process.env.FSQ_API_KEY;
  if (!key) {
    return res.status(200).json({ ok: false, reason: 'no_key' });
  }

  const legacy = key.startsWith('fsq3');
  const base = legacy
    ? 'https://api.foursquare.com/v3/places/search'
    : 'https://places-api.foursquare.com/places/search';
  const url = new URL(base);
  url.searchParams.set('query', name);
  url.searchParams.set('ll', ll);
  url.searchParams.set('radius', '500');
  url.searchParams.set('limit', '1');
  url.searchParams.set('fields', 'name,rating,stats,hours');

  const headers = legacy
    ? { Authorization: key, accept: 'application/json' }
    : { Authorization: `Bearer ${key}`, 'X-Places-Api-Version': '2025-06-17', accept: 'application/json' };

  try {
    const r = await fetch(url, { headers });
    if (!r.ok) {
      return res.status(200).json({ ok: false, reason: `fsq_${r.status}` });
    }
    const j = await r.json();
    const place = j.results && j.results[0];
    if (!place) return res.status(200).json({ ok: false, reason: 'not_found' });

    // Ratings and hours are stable enough to cache at the edge for a day.
    res.setHeader('Cache-Control', 's-maxage=86400, stale-while-revalidate=604800');
    return res.status(200).json({
      ok: true,
      // Foursquare rates 0–10; the UI shows a 5-point scale.
      rating: place.rating != null ? (place.rating / 2).toFixed(1) : null,
      ratings: place.stats?.total_ratings ?? null,
      openNow: place.hours?.open_now ?? null,
      match: place.name,
    });
  } catch (e) {
    return res.status(200).json({ ok: false, reason: 'fetch_failed' });
  }
}
