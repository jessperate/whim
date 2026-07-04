// Google Places proxy — keeps GOOGLE_PLACES_API_KEY server-side.
// Looks up one venue by name near a lat,lng and returns rating / ratings count / open-now.
// Uses Places API (New) Text Search: https://developers.google.com/maps/documentation/places/web-service/text-search

export default async function handler(req, res) {
  const { name, ll } = req.query;
  if (!name || !ll || !/^-?\d+(\.\d+)?,-?\d+(\.\d+)?$/.test(ll)) {
    return res.status(400).json({ ok: false, reason: 'bad_params' });
  }
  const key = process.env.GOOGLE_PLACES_API_KEY;
  if (!key) {
    return res.status(200).json({ ok: false, reason: 'no_key' });
  }

  const [lat, lng] = ll.split(',').map(Number);

  try {
    const r = await fetch('https://places.googleapis.com/v1/places:searchText', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': key,
        'X-Goog-FieldMask': 'places.displayName,places.rating,places.userRatingCount,places.currentOpeningHours.openNow',
      },
      body: JSON.stringify({
        textQuery: name,
        pageSize: 1,
        locationBias: { circle: { center: { latitude: lat, longitude: lng }, radius: 500 } },
      }),
    });
    if (!r.ok) {
      return res.status(200).json({ ok: false, reason: `google_${r.status}` });
    }
    const j = await r.json();
    const place = j.places && j.places[0];
    if (!place) return res.status(200).json({ ok: false, reason: 'not_found' });

    // Ratings and hours are stable enough to cache at the edge for a day.
    res.setHeader('Cache-Control', 's-maxage=86400, stale-while-revalidate=604800');
    return res.status(200).json({
      ok: true,
      // Google already rates on a 5-point scale.
      rating: place.rating != null ? place.rating.toFixed(1) : null,
      ratings: place.userRatingCount ?? null,
      openNow: place.currentOpeningHours?.openNow ?? null,
      match: place.displayName?.text ?? null,
    });
  } catch (e) {
    return res.status(200).json({ ok: false, reason: 'fetch_failed' });
  }
}
