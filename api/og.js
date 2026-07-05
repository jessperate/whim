// Per-place Open Graph share image: the spot's real photo full-bleed, name
// over a gradient, Whim logo badged in the corner. Falls back to a brand card
// when no photo exists. Edge runtime (satori can't run in Node functions).
import { ImageResponse } from '@vercel/og';

export const config = { runtime: 'edge' };

const h = (type, style, children, extra = {}) => ({ type, props: { style, children, ...extra } });

// satori needs an actual font buffer for any text; fetch once per isolate
let fontPromise = null;
const loadFont = () => {
  fontPromise = fontPromise || (async () => {
    const css = await fetch('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@500', {
      headers: { 'User-Agent': 'Mozilla/5.0' }, // plain UA gets TTF URLs, not woff2
    }).then((r) => r.text());
    const url = css.match(/src: url\((https:[^)]+\.ttf)\)/)?.[1];
    if (!url) throw new Error('no ttf');
    return fetch(url).then((r) => r.arrayBuffer());
  })().catch(() => null);
  return fontPromise;
};

const findPhoto = async (name, ll, key) => {
  if (!key) return null;
  try {
    const search = await fetch('https://places.googleapis.com/v1/places:searchText', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Goog-Api-Key': key, 'X-Goog-FieldMask': 'places.photos' },
      body: JSON.stringify({
        textQuery: name,
        ...(ll ? { locationBias: { circle: { center: { latitude: +ll.split(',')[0], longitude: +ll.split(',')[1] }, radius: 2000 } } } : {}),
        pageSize: 1,
      }),
    }).then((r) => (r.ok ? r.json() : null));
    const ref = search?.places?.[0]?.photos?.[0]?.name;
    if (!ref) return null;
    const media = await fetch(`https://places.googleapis.com/v1/${ref}/media?maxWidthPx=1200&skipHttpRedirect=true&key=${key}`)
      .then((r) => (r.ok ? r.json() : null));
    return media?.photoUri || null;
  } catch (e) { return null; }
};

export default async function handler(req) {
  const { searchParams, origin } = new URL(req.url);
  const name = (searchParams.get('n') || 'A very good spot').slice(0, 80);
  const kind = (searchParams.get('k') || '').slice(0, 40);
  const ll = searchParams.get('ll') || '';

  const [font, photo] = await Promise.all([
    loadFont(),
    findPhoto(name, ll, process.env.GOOGLE_PLACES_API_KEY),
  ]);

  const logo = h('img', { position: 'absolute', top: 36, right: 42, width: 200 }, undefined, { src: `${origin}/whim-logo.png`, width: 200 });

  const body = photo
    ? h('div', { width: '100%', height: '100%', display: 'flex', position: 'relative', backgroundColor: '#fff7f2' }, [
        h('img', { position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }, undefined, { src: photo, width: 1200, height: 630 }),
        h('div', { position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(38,8,5,0.82) 0%, rgba(38,8,5,0.25) 38%, rgba(38,8,5,0) 62%)' }),
        logo,
        h('div', { position: 'absolute', left: 48, right: 48, bottom: 40, display: 'flex', flexDirection: 'column' }, [
          ...(kind ? [h('div', { fontSize: 22, letterSpacing: 4, color: '#ffd3c4', textTransform: 'uppercase', marginBottom: 10 }, kind.toUpperCase())] : []),
          h('div', { fontSize: 64, lineHeight: 1.05, color: '#fff7f2' }, name),
        ]),
      ])
    : h('div', { width: '100%', height: '100%', display: 'flex', position: 'relative', backgroundColor: '#fff7f2', alignItems: 'center', justifyContent: 'center' }, [
        h('div', { display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '0 90px' }, [
          h('img', { width: 300, marginBottom: 42 }, undefined, { src: `${origin}/whim-logo.png`, width: 300 }),
          ...(kind ? [h('div', { fontSize: 22, letterSpacing: 4, color: '#c0361c', textTransform: 'uppercase', marginBottom: 12 }, kind.toUpperCase())] : []),
          h('div', { fontSize: 62, lineHeight: 1.1, color: '#451212', textAlign: 'center' }, name),
        ]),
      ]);

  return new ImageResponse(body, {
    width: 1200,
    height: 630,
    fonts: font ? [{ name: 'Playfair Display', data: font, weight: 500 }] : [],
    headers: { 'Cache-Control': 's-maxage=604800, stale-while-revalidate=2592000' },
  });
}
