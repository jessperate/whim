// Shareable place pages: /p/<id> (rewritten here) serves rich OG previews to
// link crawlers, then bounces humans into the app with the sheet open.
// Curated snapshot below is generated from index.html's PLACES — regenerate on
// dataset changes. Wildcards arrive via ?n=<name>&k=<kind> instead.

const PLACES = [{"id":"p1","name":"Du Pain et des Idées","kind":"Boulangerie","area":"Canal Saint-Martin","lat":48.871,"lng":2.3628,"blurb":"Reddit\\u2019s eternal answer to \\u201cbest bakery?\\u201d The pistachio escargot has ended relationships."},{"id":"p2","name":"Boulangerie Utopie","kind":"Boulangerie","area":"11e","lat":48.8664,"lng":2.3702,"blurb":"The internet\\u2019s favorite underdog bakery. The charcoal-sesame baguette has a fan club."},{"id":"p3","name":"La Fontaine de Belleville","kind":"Café","area":"10e","lat":48.8749,"lng":2.3705,"blurb":"Actually good coffee, zinc counter, locals debating nothing. Peak Paris."},{"id":"p21","name":"Café de Flore","kind":"Café","area":"6e","lat":48.8542,"lng":2.3326,"blurb":"Sartre\\u2019s old office, now a \\u20ac7 espresso. You\\u2019re paying for the ghosts and the people-watching."},{"id":"p29","name":"Breizh Café","kind":"Crêperie","area":"Le Marais","lat":48.8609,"lng":2.3623,"blurb":"Buckwheat crêpes that make the street carts look like a prank."},{"id":"p30","name":"Marché des Enfants Rouges","kind":"Market","area":"3e","lat":48.8626,"lng":2.3618,"blurb":"The oldest covered market in Paris. Come hungry, leave with opinions."},{"id":"p5","name":"Sainte-Chapelle","kind":"Landmark","area":"Île de la Cité","lat":48.8554,"lng":2.345,"blurb":"1,113 stained-glass panels. The one line every forum agrees is worth it."},{"id":"p6","name":"Musée de l\\u2019Orangerie","kind":"Museum","area":"1er","lat":48.8638,"lng":2.3226,"blurb":"Monet\\u2019s water lilies, wall to wall, minus the Louvre crowds. The connoisseur\\u2019s pick."},{"id":"p22","name":"Musée Rodin","kind":"Museum","area":"7e","lat":48.8555,"lng":2.3158,"blurb":"The Thinker, a rose garden, and the least exhausting great museum in Paris."},{"id":"p23","name":"Musée Carnavalet","kind":"Museum","area":"Le Marais","lat":48.8577,"lng":2.3626,"blurb":"Paris\\u2019s own attic \\u2014 free entry, zero guilt if you bail after an hour."},{"id":"p4","name":"Canal Saint-Martin stroll","kind":"Walk","area":"10e","lat":48.872,"lng":2.3654,"blurb":"Lock bridges, quiche picnics, effortlessly cool locals. Bring sunglasses."},{"id":"p7","name":"Marché d\\u2019Aligre","kind":"Market","area":"12e","lat":48.8493,"lng":2.3785,"blurb":"Chaotic flea stalls, cheap produce, zero tourists. A local-thread legend."},{"id":"p8","name":"L\\u2019As du Fallafel","kind":"Street food","area":"Le Marais","lat":48.8571,"lng":2.359,"blurb":"The falafel with a permanent line. Lenny Kravitz is a regular, allegedly."},{"id":"p24","name":"Place des Vosges","kind":"Garden","area":"Le Marais","lat":48.8556,"lng":2.3655,"blurb":"The oldest square in Paris. Sit under the arcades and act like you own a duplex here."},{"id":"p9","name":"Coulée Verte","kind":"Walk","area":"12e","lat":48.8496,"lng":2.3714,"blurb":"An elevated park on old rail tracks. The High Line copied Paris, not the other way around."},{"id":"p10","name":"Jardin du Luxembourg","kind":"Garden","area":"6e","lat":48.8462,"lng":2.3372,"blurb":"Steal a green chair by the fountain. It\\u2019s tradition."},{"id":"p33","name":"Berthillon","kind":"Ice cream","area":"Île Saint-Louis","lat":48.8517,"lng":2.3568,"blurb":"The ice cream old Parisians cross the city for. Salted caramel. Thank me later."},{"id":"p11","name":"Shakespeare and Company","kind":"Bookshop","area":"5e","lat":48.8526,"lng":2.3471,"blurb":"Buy a book you\\u2019ll never finish. The stamp alone is worth it."},{"id":"p31","name":"Père Lachaise wander","kind":"Walk","area":"20e","lat":48.8614,"lng":2.3933,"blurb":"Jim Morrison, Oscar Wilde, and the best gothic strolling in Europe."},{"id":"p32","name":"Galerie Vivienne","kind":"Passage","area":"2e","lat":48.8666,"lng":2.3397,"blurb":"A glass-roofed passage from 1823. Rain is great here \\u2014 you get to be smug and dry."},{"id":"p25","name":"Parc des Buttes-Chaumont","kind":"Park","area":"19e","lat":48.8809,"lng":2.3819,"blurb":"Cliffs, a temple, suspicious hills. The locals\\u2019 park \\u2014 tourists never make it this far."},{"id":"p12","name":"Montmartre wander","kind":"Walk","area":"18e","lat":48.8867,"lng":2.3431,"blurb":"Hills, artists, and one very smug basilica view."},{"id":"p35","name":"Palais de Tokyo","kind":"Museum","area":"16e","lat":48.8642,"lng":2.2968,"blurb":"Contemporary art in raw concrete, open till midnight. Weird in the best way."},{"id":"p16","name":"Sunset at Sacré-Cœur","kind":"Viewpoint","area":"18e","lat":48.8863,"lng":2.343,"blurb":"The city turns gold and everyone forgets their phone. Almost."},{"id":"p13","name":"Le Baron Rouge","kind":"Wine bar","area":"Bastille","lat":48.8503,"lng":2.3778,"blurb":"Wine from barrels, oysters on car hoods. Every \\u201cwhere do locals drink\\u201d thread, answered."},{"id":"p14","name":"Le Comptoir Général","kind":"Bar","area":"Canal Saint-Martin","lat":48.8709,"lng":2.366,"blurb":"A hidden canal-side bar full of oddities. Weird, wonderful, word-of-mouth famous."},{"id":"p26","name":"Le Mary Céleste","kind":"Bar","area":"Le Marais","lat":48.8618,"lng":2.3646,"blurb":"Oysters and cocktails at a round bar built for eavesdropping."},{"id":"p28","name":"Septime","kind":"Bistro","area":"11e","lat":48.8531,"lng":2.381,"blurb":"The reservation everyone claims they can get. If you land one, cancel everything else."},{"id":"p15","name":"Bouillon Pigalle","kind":"Bistro","area":"9e","lat":48.8823,"lng":2.3379,"blurb":"Steak frites at 1998 prices. The line moves, trust."},{"id":"p27","name":"Candelaria","kind":"Bar","area":"3e","lat":48.8629,"lng":2.3629,"blurb":"Tacos in front, speakeasy behind an unmarked door. Yes, that door."},{"id":"p36","name":"Pont Alexandre III at night","kind":"Landmark","area":"8e","lat":48.8639,"lng":2.3136,"blurb":"The most dramatic bridge in Paris. Gold statues, zero chill."},{"id":"p17","name":"Caveau de la Huchette","kind":"Jazz club","area":"5e","lat":48.8527,"lng":2.3464,"blurb":"Swing dancing in a medieval cellar. Yes, really."},{"id":"p18","name":"38Riv Jazz Club","kind":"Jazz club","area":"4e","lat":48.8561,"lng":2.3556,"blurb":"A tiny vaulted jazz cave. Regulars go three times in eleven days. It\\u2019s that kind of place."},{"id":"p34","name":"Little Red Door","kind":"Cocktail bar","area":"3e","lat":48.8637,"lng":2.3639,"blurb":"World\\u2019s-50-Best cocktails behind, yes, a little red door."},{"id":"p19","name":"Eiffel sparkle run","kind":"Landmark","area":"7e","lat":48.8584,"lng":2.2945,"blurb":"It glitters on the hour. Cynics have cried."},{"id":"p37","name":"Jardin d’Acclimatation","kind":"Park","area":"Bois de Boulogne","lat":48.8785,"lng":2.2635,"blurb":"Vintage carousels, rollercoasters, wandering peacocks. The 1860s’ idea of fun, still correct."},{"id":"p38","name":"Ménagerie du Jardin des Plantes","kind":"Zoo","area":"5e","lat":48.8443,"lng":2.3614,"blurb":"One of the world’s oldest zoos. Small, walkable, dangerously heavy on red pandas."},{"id":"p39","name":"Cité des Sciences","kind":"Museum","area":"La Villette","lat":48.8956,"lng":2.3877,"blurb":"A giant science playground. Kids lose their minds; adults pretend it’s for the kids."},{"id":"p20","name":"Crêpe au Nutella, standing","kind":"Street food","area":"120m away, always","lat":48.859,"lng":2.36,"blurb":"The official dessert of poor decisions after midnight."}];

// the curated snapshot carries raw \uXXXX JS escapes from index.html — decode them
const deesc = (s) => String(s).replace(/\\u([0-9a-fA-F]{4})/g, (m, h) => String.fromCharCode(parseInt(h, 16)));

const escapeHtml = (s) => String(s).replace(/[&<>"']/g, (c) => (
  { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
));

export default async function handler(req, res) {
  const id = String(req.query.id || '').slice(0, 60);
  const curated = PLACES.find((p) => p.id === id);
  const name = deesc(curated ? curated.name : String(req.query.n || '').slice(0, 90));
  if (!id || !name) {
    res.setHeader('Location', '/');
    return res.status(302).end();
  }
  const kind = curated ? curated.kind : String(req.query.k || 'Spot').slice(0, 40);
  const blurb = deesc(curated ? curated.blurb : '');
  const host = req.headers.host || 'whim-eta.vercel.app';

  const ll = curated ? `${curated.lat},${curated.lng}` : '';
  const photo = `https://${host}/api/og?n=${encodeURIComponent(name)}&k=${encodeURIComponent(kind)}${ll ? `&ll=${ll}` : ''}`;
  const desc = blurb || `${kind} in Paris, found on Whim — the pocket concierge that knows your taste.`;
  const app = `/?place=${encodeURIComponent(id)}&n=${encodeURIComponent(name)}&k=${encodeURIComponent(kind)}`;

  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', 's-maxage=86400, stale-while-revalidate=604800');
  return res.status(200).send(`<!doctype html>
<html lang="en"><head>
<meta charset="utf-8">
<title>${escapeHtml(name)} — Whim</title>
<meta property="og:site_name" content="Whim">
<meta property="og:title" content="${escapeHtml(name)} — Whim">
<meta property="og:description" content="${escapeHtml(desc)}">
<meta property="og:image" content="${escapeHtml(photo)}">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:type" content="website">
<meta property="og:url" content="https://${escapeHtml(host)}/p/${escapeHtml(id)}">
<meta name="twitter:card" content="summary_large_image">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta http-equiv="refresh" content="1;url=${escapeHtml(app)}">
</head>
<body style="font-family:Georgia,serif;background:#fff7f2;color:#451212;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;">
<p style="font-style:italic;">Opening ${escapeHtml(name)} on Whim…</p>
<script>location.replace(${JSON.stringify(app)});</script>
</body></html>`);
}
