// Public profile pages: /u/<handle>. Reads through the anon key — RLS only
// exposes profiles that opted into is_public, so a private profile renders
// the same page as a missing one (no existence leak).

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const page = (title, body, extraHead = '') => `<!doctype html>
<html lang="en"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>${extraHead}
<link rel="icon" href="/apple-touch-icon.png">
<style>
  body { margin:0; background:#fff7f2; color:#451212; font:400 16px/1.6 Georgia,serif; }
  main { max-width:640px; margin:0 auto; padding:40px 22px 70px; }
  .kicker { font:500 11px/1 ui-monospace,Menlo,monospace; letter-spacing:.1em; text-transform:uppercase; color:#c0361c; }
  h1 { font:400 38px/1.05 Georgia,serif; letter-spacing:-0.02em; margin:8px 0 4px; }
  .bio { font:italic 400 17px/1.5 Georgia,serif; color:#38100c; margin:10px 0 4px; }
  .stats { font:500 12px ui-monospace,monospace; letter-spacing:.06em; text-transform:uppercase; color:#676c79; margin-top:14px; }
  .avatar { width:84px; height:84px; border-radius:50%; object-fit:cover; display:block; }
  .initial { width:84px; height:84px; border-radius:50%; background:#ffe0d9; color:#c0361c; display:flex; align-items:center; justify-content:center; font:700 34px -apple-system,sans-serif; }
  h2 { display:flex; align-items:center; gap:8px; font:500 12px ui-monospace,monospace; letter-spacing:.08em; text-transform:uppercase; color:#c0361c; margin:34px 0 10px; }
  .list { border:1px solid #f2d3c6; background:#fff; }
  .row { display:block; padding:13px 14px; border-bottom:1px solid #f2d3c6; text-decoration:none; color:inherit; }
  .row:last-child { border-bottom:none; }
  .row b { font:700 15px -apple-system,'Helvetica Neue',sans-serif; color:#451212; display:block; }
  .row span { font:500 9px ui-monospace,monospace; letter-spacing:.08em; text-transform:uppercase; color:#c0361c; }
  .cta { display:inline-block; margin-top:40px; font:500 14px -apple-system,sans-serif; color:#fff5ee; background:#e8432c; text-decoration:none; border-radius:58px; padding:12px 22px; }
  .head { display:flex; gap:18px; align-items:center; margin-top:18px; }
</style></head><body><main>${body}</main></body></html>`;

export default async function handler(req, res) {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_ANON_KEY;
  const handle = String(req.query.handle || '').toLowerCase().replace(/^@/, '').slice(0, 20);
  res.setHeader('Content-Type', 'text/html; charset=utf-8');

  const privatePage = () => page('Whim — a private profile', `
    <div class="kicker">Whim · Profiles</div>
    <h1>This one's private</h1>
    <p style="font:400 15.5px/1.65 -apple-system,sans-serif; color:#38100c;">Either this profile doesn't exist, or its owner prefers to be mysterious. Very Parisian of them.</p>
    <a class="cta" href="/">Meet Whim instead →</a>`);

  if (!url || !key || !/^[a-z0-9_]{3,20}$/.test(handle)) {
    res.setHeader('Cache-Control', 's-maxage=300');
    return res.status(200).end(privatePage());
  }

  try {
    const sb = (path) => fetch(`${url}/rest/v1/${path}`, { headers: { apikey: key, Authorization: `Bearer ${key}` } }).then((r) => (r.ok ? r.json() : null));
    const profs = await sb(`profiles?select=user_id,username,display_name,bio,avatar,swipe_count&username=eq.${encodeURIComponent(handle)}&is_public=eq.true&limit=1`);
    const prof = Array.isArray(profs) && profs[0];
    if (!prof) {
      res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=3600');
      return res.status(200).end(privatePage());
    }

    const hearts = (await sb(`hearts?select=place_id,place,list,created_at&user_id=eq.${prof.user_id}&order=created_at.desc&limit=200`)) || [];
    const name = prof.display_name || `@${prof.username}`;
    const folders = new Map([['', []]]);
    hearts.forEach((h) => {
      const k = h.list || '';
      if (!folders.has(k)) folders.set(k, []);
      folders.get(k).push(h);
    });

    const rowFor = (h) => {
      const p = h.place || {};
      const nm = p.name || h.place_id;
      const kind = p.kind || '';
      const area = p.area || '';
      return `<a class="row" href="/p/${encodeURIComponent(h.place_id)}?n=${encodeURIComponent(nm)}&k=${encodeURIComponent(kind)}"><b>${esc(nm)}</b><span>${esc([kind, area].filter(Boolean).join(' · '))}</span></a>`;
    };
    const sections = [...folders.entries()]
      .filter(([, items]) => items.length)
      .map(([k, items]) => `<h2>${k ? esc(k) : 'Saved for later'} (${items.length})</h2><div class="list">${items.map(rowFor).join('')}</div>`)
      .join('');

    const avatar = prof.avatar && String(prof.avatar).startsWith('data:image/')
      ? `<img class="avatar" src="${prof.avatar}" alt="">`
      : `<div class="initial">${esc(name.trim().charAt(0).toUpperCase())}</div>`;

    res.setHeader('Cache-Control', 's-maxage=600, stale-while-revalidate=86400');
    return res.status(200).end(page(`${name} — Whim`, `
      <div class="kicker">Whim · Taste on record</div>
      <div class="head">${avatar}<div>
        <h1>${esc(name)}</h1>
        <div class="kicker">@${esc(prof.username)}</div>
      </div></div>
      ${prof.bio ? `<div class="bio">${esc(prof.bio)}</div>` : ''}
      <div class="stats">${hearts.length} saves · ${prof.swipe_count || 0} swipes judged</div>
      ${sections || '<p style="font:400 15px -apple-system,sans-serif; color:#676c79;">Nothing saved yet. The taste is still forming.</p>'}
      <a class="cta" href="/?add=${encodeURIComponent(prof.username)}">Add ${esc(name.split(' ')[0])} on Whim →</a>`,
      `<meta property="og:title" content="${esc(name)} on Whim">
<meta property="og:description" content="${esc(prof.bio || `${hearts.length} places worth stealing. A taste profile on record.`)}">
<meta property="og:image" content="https://${esc(req.headers.host || 'whim-eta.vercel.app')}/whim-og.jpg">`));
  } catch (e) {
    res.setHeader('Cache-Control', 's-maxage=60');
    return res.status(200).end(privatePage());
  }
}
