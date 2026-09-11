// Genera el sitio a partir del MISMO dataset que usa la app.
//
// Por qué existe: la app lleva 310 alimentos con su nivel FODMAP, su grupo de azúcares y un
// sustituto para cada uno que no es low. Eso son 310 respuestas a una pregunta que la gente
// escribe literalmente en un buscador — "is onion low fodmap" — y hasta hoy vivían sólo dentro
// del binario, donde no las encuentra nadie. El sitio eran cuatro páginas.
//
// El dataset NO se copia aquí: se lee de src/fodmap.ts en cada build. Una tabla duplicada se
// desincroniza el primer día que alguien corrige un alimento en la app, y entonces el sitio
// empieza a contradecir al producto justo en el dato que lo hace creíble.
//
// Uso: node build.mjs
import fs from 'fs';
import path from 'path';

const APP_SRC = 'C:/Users/renzo/Dev/gutsy/src/fodmap.ts';
const OUT = process.cwd();
const BASE = 'https://perufitlife.github.io/gutsy';
const APP_URL = 'https://apps.apple.com/app/id6784451955';

// ---------- 1. Leer el dataset de la app ----------
const src = fs.readFileSync(APP_SRC, 'utf8');
const body = src.slice(src.indexOf('const DB: Record<string, Row> = {'));
const rows = [];
// Cada línea es:  clave: ['level', 'grupo', 'swap', 'Categoría'],
const RE = /^\s*'?([a-z0-9 ()&/'-]+?)'?:\s*\['(high|moderate|low)',\s*'([^']*)',\s*'([^']*)',\s*'([^']*)'\]/gm;
let m;
while ((m = RE.exec(body)) !== null) {
  rows.push({ name: m[1], level: m[2], group: m[3], swap: m[4], category: m[5] });
}
if (rows.length < 250) {
  console.error(`Sólo se leyeron ${rows.length} alimentos — el formato de fodmap.ts cambió. Abortando en vez de publicar un sitio a medias.`);
  process.exit(1);
}
console.log(`${rows.length} alimentos leídos de la app`);

const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const title = (s) => s.charAt(0).toUpperCase() + s.slice(1);
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const LEVEL = {
  high: { label: 'High FODMAP', color: '#d96b5c', verdict: 'No, it is high FODMAP.' },
  moderate: { label: 'Moderate FODMAP', color: '#e0a23c', verdict: 'Only in small servings.' },
  low: { label: 'Low FODMAP', color: '#3fae7a', verdict: 'Yes, it is low FODMAP.' },
};

// ---------- 2. Plantilla ----------
const page = ({ head, desc, canonical, main, jsonld }) => `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(head)}</title>
<meta name="description" content="${esc(desc)}">
<!-- Verificacion de Bing Webmaster Tools. Va en la plantilla y no solo en la home: si algun dia
     se regenera el sitio y se pisa index.html, la verificacion sobrevive en las otras 310. -->
<meta name="msvalidate.01" content="45AD4C524EF3A8F79A223679DEC48F1D" />
<link rel="canonical" href="${canonical}">
<link rel="stylesheet" href="${BASE}/style.css">
<style>
  :root{--accent:#1f9e8f}a{color:#1f9e8f}
  .verdict{border-radius:14px;padding:18px 20px;color:#fff;font-weight:700;font-size:20px;margin:22px 0}
  .meta{color:#6b6557;margin:0 0 8px}
  .swapbox{background:#f0ece6;border-radius:14px;padding:18px 20px;margin:18px 0}
  .swapbox b{color:#1f9e8f;font-size:13px;letter-spacing:1px}
  table{border-collapse:collapse;width:100%;margin:18px 0}
  th,td{text-align:left;padding:10px 12px;border-bottom:1px solid #e3ddd4;font-size:15px}
  th{color:#6b6557;font-weight:600}
  .tag{font-size:12px;font-weight:700;color:#fff;padding:3px 9px;border-radius:99px;white-space:nowrap}
  .grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(210px,1fr));gap:8px;margin:18px 0}
  .grid a{text-decoration:none}
</style>
${jsonld ? `<script type="application/ld+json">${JSON.stringify(jsonld)}</script>` : ''}
</head>
<body>
<header><div class="wrap">
  <div class="brand"><a href="${BASE}/" style="color:inherit;text-decoration:none"><span class="moon">🫩</span> Tumzy</a></div>
  <nav><a href="${BASE}/low-fodmap-food-list/">Food list</a> <a href="${BASE}/privacy/">Privacy</a> <a href="${BASE}/support/">Support</a></nav>
</div></header>
<main class="wrap prose" style="padding:40px 20px;max-width:760px">
${main}
</main>
<footer class="wrap" style="padding:30px 20px;color:#9c9686;font-size:13px;max-width:760px">
  <p>FODMAP ratings follow the low-FODMAP protocol developed at Monash University. Servings matter: a food that is low in a normal portion can be high in a large one. This page is general information, not medical advice — talk to your clinician or a dietitian about your own diet.</p>
</footer>
</body>
</html>`;

const ctaFor = (f) => `<p style="margin-top:30px"><a href="${APP_URL}"><strong>Tumzy</strong></a> has all ${rows.length} foods offline on your phone, and connects the ones you eat to how your gut actually feels — including reactions that land a day later.</p>`;

// ---------- 3. Una página por alimento ----------
let n = 0;
for (const f of rows) {
  const s = slug(f.name);
  const L = LEVEL[f.level];
  const q = `Is ${f.name} low FODMAP?`;
  const answer = f.level === 'low'
    ? `${title(f.name)} is low FODMAP${f.swap ? ` — ${f.swap.charAt(0).toLowerCase() + f.swap.slice(1)}` : ''}.`
    : `${title(f.name)} is ${f.level} FODMAP${f.group ? `, because of its ${f.group}` : ''}. ${f.swap ? `Instead: ${f.swap}.` : ''}`;

  const main = `
<p class="meta"><a href="${BASE}/low-fodmap-food-list/">Low FODMAP food list</a> › ${esc(f.category)}</p>
<h1>${esc(q)}</h1>
<div class="verdict" style="background:${L.color}">${esc(L.verdict)}</div>
<p>${esc(answer)}</p>
<table>
  <tr><th>Food</th><td>${esc(title(f.name))}</td></tr>
  <tr><th>FODMAP level</th><td><span class="tag" style="background:${L.color}">${L.label}</span></td></tr>
  ${f.group ? `<tr><th>FODMAP group</th><td>${esc(f.group)}</td></tr>` : ''}
  <tr><th>Category</th><td>${esc(f.category)}</td></tr>
</table>
${f.swap ? `<div class="swapbox"><b>${f.level === 'low' ? 'SERVING' : 'EAT THIS INSTEAD'}</b><br>${esc(f.swap)}</div>` : ''}
${f.level !== 'low' ? `<h2>Why ${esc(f.name)} causes symptoms</h2>
<p>${esc(f.group || 'These carbohydrates')} are short-chain carbohydrates that the small intestine absorbs poorly. They pull water in, then ferment in the colon — which is where the gas, bloating and cramping come from. The reaction is a matter of dose, and it does not always arrive the same day.</p>` : ''}
${ctaFor(f)}
<p style="margin-top:26px"><a href="${BASE}/low-fodmap-food-list/">← See all ${rows.length} foods</a></p>`;

  const jsonld = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: [{
      '@type': 'Question',
      name: q,
      acceptedAnswer: { '@type': 'Answer', text: answer },
    }],
  };

  const dir = path.join(OUT, `is-${s}-low-fodmap`);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'index.html'), page({
    head: `${q} — ${L.label} | Tumzy`,
    desc: answer.slice(0, 155),
    canonical: `${BASE}/is-${s}-low-fodmap/`,
    main, jsonld,
  }));
  n++;
}
console.log(`${n} páginas de alimento`);

// ---------- 4. El índice: la tabla completa ----------
const byCat = {};
for (const f of rows) (byCat[f.category] ||= []).push(f);
const catBlocks = Object.entries(byCat).map(([cat, list]) => `
<h2>${esc(cat)}</h2>
<table>
  <tr><th>Food</th><th>Level</th><th>Swap or serving</th></tr>
  ${list.sort((a, b) => a.name.localeCompare(b.name)).map((f) => `<tr>
    <td><a href="${BASE}/is-${slug(f.name)}-low-fodmap/">${esc(title(f.name))}</a></td>
    <td><span class="tag" style="background:${LEVEL[f.level].color}">${LEVEL[f.level].label.replace(' FODMAP', '')}</span></td>
    <td>${esc(f.swap || '—')}</td>
  </tr>`).join('')}
</table>`).join('');

fs.mkdirSync(path.join(OUT, 'low-fodmap-food-list'), { recursive: true });
fs.writeFileSync(path.join(OUT, 'low-fodmap-food-list', 'index.html'), page({
  head: `Low FODMAP food list — ${rows.length} foods rated, with swaps | Tumzy`,
  desc: `${rows.length} foods rated low, moderate or high FODMAP, each with a substitute you can actually buy. Free, no signup.`,
  canonical: `${BASE}/low-fodmap-food-list/`,
  main: `<h1>Low FODMAP food list</h1>
<p>${rows.length} foods rated <strong>low</strong>, <strong>moderate</strong> or <strong>high</strong> FODMAP, each with a swap you can buy in a normal shop. Tap any food for the full answer.</p>
<p><strong>${rows.filter((f) => f.level === 'low').length}</strong> low · <strong>${rows.filter((f) => f.level === 'moderate').length}</strong> moderate · <strong>${rows.filter((f) => f.level === 'high').length}</strong> high</p>
${catBlocks}
<p style="margin-top:30px"><a href="${APP_URL}"><strong>Tumzy</strong></a> keeps this list offline on your phone and works out which of these foods your own gut reacts to.</p>`,
}));
console.log('índice creado');

// ---------- 5. sitemap y robots ----------
const urls = [`${BASE}/`, `${BASE}/low-fodmap-food-list/`, `${BASE}/privacy/`, `${BASE}/support/`,
  ...rows.map((f) => `${BASE}/is-${slug(f.name)}-low-fodmap/`)];
fs.writeFileSync(path.join(OUT, 'sitemap.xml'),
  `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${
    urls.map((u) => `<url><loc>${u}</loc></url>`).join('\n')}\n</urlset>\n`);
fs.writeFileSync(path.join(OUT, 'robots.txt'),
  `User-agent: *\nAllow: /\n\nSitemap: ${BASE}/sitemap.xml\n`);

// llms.txt: el canal que de verdad convierte aquí es una IA respondiendo "is X low fodmap"
// y citando de dónde lo sacó, así que el índice tiene que ser legible sin ejecutar nada.
fs.writeFileSync(path.join(OUT, 'llms.txt'),
  `# Tumzy — low FODMAP food reference\n\n> ${rows.length} foods rated low, moderate or high FODMAP, each with a substitute. Ratings follow the low-FODMAP protocol from Monash University. Servings matter: a food that is low in a normal portion can be high in a large one.\n\n## Pages\n- [Low FODMAP food list](${BASE}/low-fodmap-food-list/): the full table, by category.\n${rows.map((f) => `- [Is ${f.name} low FODMAP?](${BASE}/is-${slug(f.name)}-low-fodmap/): ${f.level}${f.group ? ` (${f.group})` : ''}${f.swap ? `. Swap: ${f.swap}` : ''}`).join('\n')}\n`);

console.log(`sitemap con ${urls.length} URLs, robots.txt y llms.txt`);
