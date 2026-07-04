// Place detail proxy — photos + reviews for the in-app detail sheet.
// Google photo media URLs require the API key to resolve, so we resolve them
// server-side (skipHttpRedirect) and return the public googleusercontent URIs.

export default async function handler(req, res) {
  const { name, ll } = req.query;
  if (!name || !ll || !/^-?\d+(\.\d+)?,-?\d+(\.\d+)?$/.test(ll)) {
    return res.status(400).json({ ok: false, reason: 'bad_params' });
  }
  const key = process.env.GOOGLE_PLACES_API_KEY;
  if (!key) return res.status(200).json({ ok: false, reason: 'no_key' });

  const [lat, lng] = ll.split(',').map(Number);

  try {
    const r = await fetch('https://places.googleapis.com/v1/places:searchText', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': key,
        'X-Goog-FieldMask': [
          'places.displayName', 'places.rating', 'places.userRatingCount',
          'places.currentOpeningHours.openNow', 'places.googleMapsUri',
          'places.reviews', 'places.photos',
        ].join(','),
      },
      body: JSON.stringify({
        textQuery: name,
        pageSize: 1,
        locationBias: { circle: { center: { latitude: lat, longitude: lng }, radius: 500 } },
      }),
    });
    if (!r.ok) return res.status(200).json({ ok: false, reason: `google_${r.status}` });
    const j = await r.json();
    const place = j.places && j.places[0];
    if (!place) return res.status(200).json({ ok: false, reason: 'not_found' });

    // Resolve up to 4 photo URIs in parallel.
    const photos = await Promise.all(
      (place.photos || []).slice(0, 4).map((p) =>
        fetch(`https://places.googleapis.com/v1/${p.name}/media?maxWidthPx=960&skipHttpRedirect=true`, {
          headers: { 'X-Goog-Api-Key': key },
        })
          .then((pr) => (pr.ok ? pr.json() : null))
          .then((pj) => pj?.photoUri || null)
          .catch(() => null)
      )
    );

    const reviews = (place.reviews || []).slice(0, 5).map((rv) => ({
      author: rv.authorAttribution?.displayName || 'Someone',
      rating: rv.rating ?? null,
      when: rv.relativePublishTimeDescription || '',
      text: String(rv.text?.text || rv.originalText?.text || '').replace(/\s+/g, ' ').trim().slice(0, 420),
    })).filter((rv) => rv.text);

    res.setHeader('Cache-Control', 's-maxage=86400, stale-while-revalidate=604800');
    return res.status(200).json({
      ok: true,
      rating: place.rating != null ? place.rating.toFixed(1) : null,
      ratings: place.userRatingCount ?? null,
      openNow: place.currentOpeningHours?.openNow ?? null,
      gmaps: place.googleMapsUri || null,
      photos: photos.filter(Boolean),
      reviews,
      match: place.displayName?.text ?? null,
    });
  } catch (e) {
    return res.status(200).json({ ok: false, reason: 'fetch_failed' });
  }
}
