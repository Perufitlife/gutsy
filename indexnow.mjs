// Avisa a Bing (y a quien comparta el protocolo) de las 314 URLs.
// Se puede volver a correr cuando se añadan alimentos: es idempotente.
import fs from 'fs';
const KEY = 'b53e43fa632ad0eaad9201e0d53996a4';
const HOST = 'perufitlife.github.io';
const sitemap = fs.readFileSync('sitemap.xml', 'utf8');
const urls = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
console.log(`${urls.length} URLs en el sitemap`);
// IndexNow acepta hasta 10.000 por lote; aun así se trocea por prudencia.
for (let i = 0; i < urls.length; i += 100) {
  const lote = urls.slice(i, i + 100);
  const r = await fetch('https://api.indexnow.org/indexnow', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
    body: JSON.stringify({ host: HOST, key: KEY, keyLocation: `https://${HOST}/gutsy/${KEY}.txt`, urlList: lote }),
  });
  console.log(`  lote ${i / 100 + 1}: ${lote.length} URLs -> HTTP ${r.status}`);
}
