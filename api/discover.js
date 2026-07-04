// Wildcard discovery — fresh, highly-rated places near the user straight from
// Google Maps, to keep the deck from repeating the same curated 39 spots.
// GET ?ll=lat,lng  ->  up to 20 candidates (rating >= 4.3, well-reviewed).

export default async function handler(req, res) {
  const { ll } = req.query;
  if (!ll || !/^-?\d+(\.\d+)?,-?\d+(\.\d+)?$/.test(ll)) {
    return res.status(400).json({ ok: false, reason: 'bad_params' });
  }
  const key = process.env.GOOGLE_PLACES_API_KEY;
  if (!key) return res.status(200).json({ ok: false, reason: 'no_key' });

  const [lat, lng] = ll.split(',').map(Number);

  try {
    const r = await fetch('https://places.googleapis.com/v1/places:searchNearby', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': key,
        'X-Goog-FieldMask': [
          'places.id', 'places.displayName', 'places.primaryType', 'places.location',
          'places.rating', 'places.userRatingCount', 'places.editorialSummary',
        ].join(','),
      },
      body: JSON.stringify({
        maxResultCount: 20,
        rankPreference: 'POPULARITY',
        locationRestriction: { circle: { center: { latitude: lat, longitude: lng }, radius: 2500 } },
        includedTypes: [
          'restaurant', 'cafe', 'bar', 'bakery', 'wine_bar', 'ice_cream_shop',
          'museum', 'art_gallery', 'book_store', 'park',
        ],
      }),
    });
    if (!r.ok) return res.status(200).json({ ok: false, reason: `google_${r.status}` });
    const j = await r.json();

    const places = (j.places || [])
      .filter((p) => (p.rating ?? 0) >= 4.3 && (p.userRatingCount ?? 0) >= 200)
      .map((p) => ({
        id: p.id,
        name: p.displayName?.text || '',
        type: p.primaryType || 'restaurant',
        lat: p.location?.latitude,
        lng: p.location?.longitude,
        rating: p.rating != null ? p.rating.toFixed(1) : null,
        ratings: p.userRatingCount ?? null,
        blurb: p.editorialSummary?.text || null,
      }))
      .filter((p) => p.name && p.lat != null);

    res.setHeader('Cache-Control', 's-maxage=1800, stale-while-revalidate=86400');
    return res.status(200).json({ ok: true, places });
  } catch (e) {
    return res.status(200).json({ ok: false, reason: 'fetch_failed' });
  }
}
