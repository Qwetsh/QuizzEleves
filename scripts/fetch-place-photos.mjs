// Recupere les photos des lieux du mini-jeu Tour du monde depuis Wikipedia FR
// (image principale de l'article, hebergee sur Wikimedia Commons) et leurs
// credits (auteur + licence) pour attribution.
// Sortie : src/assets/places/<slug>.jpg + src/data/placePhotoCredits.json
// Usage : node scripts/fetch-place-photos.mjs
import { mkdirSync, writeFileSync } from 'fs';

const UA = 'QueteDesMatieres/1.0 (jeu pedagogique de classe ; contact: tomicharles@gmail.com)';
const THUMB_WIDTH = 800;

// slug (nom de fichier + champ photo de GEO_PLACES) -> titre d'article Wikipedia FR
const PLACES = {
  'tour-eiffel': 'Tour Eiffel',
  'mont-saint-michel': 'Mont-Saint-Michel',
  'statue-liberte': 'Statue de la Liberté',
  'machu-picchu': 'Machu Picchu',
  'pyramides-gizeh': 'Pyramides de Gizeh',
  'grande-muraille': 'Grande Muraille',
  'taj-mahal': 'Taj Mahal',
  'opera-sydney': 'Opéra de Sydney',
  'mont-fuji': 'Mont Fuji',
  'kilimandjaro': 'Kilimandjaro',
  'christ-redempteur': 'Christ Rédempteur',
  'colisee': 'Colisée',
  'acropole': "Acropole d'Athènes",
  'big-ben': 'Big Ben',
  'kremlin': 'Kremlin de Moscou',
  'sagrada-familia': 'Sagrada Família',
  'chutes-niagara': 'Chutes du Niagara',
  'grand-canyon': 'Grand Canyon',
  'everest': 'Everest',
  'petra': 'Pétra',
  'angkor-vat': 'Angkor Vat',
  'ile-paques': 'Île de Pâques',
  'chichen-itza': 'Chichén Itzá',
  'burj-khalifa': 'Burj Khalifa',
  'amazonie': 'Forêt amazonienne',
  'golden-gate': 'Golden Gate Bridge',
  'sainte-sophie': 'Sainte-Sophie (Constantinople)',
  'montagne-table': 'Montagne de la Table',
  'chutes-victoria': 'Chutes Victoria',
  'uluru': 'Uluru',
  'geysir': 'Geysir',
  'lac-baikal': 'Lac Baïkal',
  'cervin': 'Cervin',
  'stonehenge': 'Stonehenge',
  'cap-horn': 'Cap Horn',
  'baobabs': 'Allée des baobabs',
  'yellowstone': 'Parc national de Yellowstone',
  'kilauea': 'Kīlauea',
  'porte-brandebourg': 'Porte de Brandebourg',
  'venise': 'Venise',
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function api(base, params) {
  const url = `${base}?${new URLSearchParams({ format: 'json', ...params })}`;
  const res = await fetch(url, { headers: { 'User-Agent': UA } });
  if (!res.ok) throw new Error(`${res.status} ${url}`);
  return res.json();
}

function stripHtml(s) {
  return (s || '').replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
}

const outDir = new URL('../src/assets/places/', import.meta.url);
mkdirSync(outDir, { recursive: true });

const credits = {};
const report = [];

for (const [slug, title] of Object.entries(PLACES)) {
  try {
    // 1. Image principale de l'article (redirections suivies)
    const data = await api('https://fr.wikipedia.org/w/api.php', {
      action: 'query', titles: title, redirects: '1',
      prop: 'pageimages', piprop: 'thumbnail|name', pithumbsize: String(THUMB_WIDTH),
    });
    const page = Object.values(data.query.pages)[0];
    const thumb = page?.thumbnail?.source;
    const fileName = page?.pageimage;
    if (!thumb || !fileName) { report.push(`MANQUANT  ${slug} (${title})`); continue; }

    // 2. Telechargement
    const imgRes = await fetch(thumb, { headers: { 'User-Agent': UA } });
    if (!imgRes.ok) { report.push(`ECHEC DL  ${slug} (${imgRes.status})`); continue; }
    const buf = Buffer.from(await imgRes.arrayBuffer());
    writeFileSync(new URL(`${slug}.jpg`, outDir), buf);

    // 3. Credits (auteur + licence) depuis Commons
    let author = '', license = '';
    try {
      const meta = await api('https://commons.wikimedia.org/w/api.php', {
        action: 'query', titles: `File:${fileName}`,
        prop: 'imageinfo', iiprop: 'extmetadata',
      });
      const info = Object.values(meta.query.pages)[0]?.imageinfo?.[0]?.extmetadata || {};
      author = stripHtml(info.Artist?.value);
      license = stripHtml(info.LicenseShortName?.value);
    } catch { /* credits facultatifs */ }

    credits[slug] = { title, file: fileName, author, license, source: `https://commons.wikimedia.org/wiki/File:${encodeURIComponent(fileName)}` };
    report.push(`OK        ${slug}  ${(buf.length / 1024).toFixed(0)} Ko  [${license || 'licence ?'}]`);
    await sleep(250); // politesse API
  } catch (e) {
    report.push(`ERREUR    ${slug} (${e.message})`);
  }
}

writeFileSync(
  new URL('../src/data/placePhotoCredits.json', import.meta.url),
  JSON.stringify(credits, null, 2),
  'utf8'
);

console.log(report.join('\n'));
console.log(`\n${Object.keys(credits).length}/${Object.keys(PLACES).length} photos recuperees — credits dans src/data/placePhotoCredits.json`);
