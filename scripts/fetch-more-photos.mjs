// Recupere les photos de la 2e vague de lieux (Tour du monde) depuis
// Wikipedia EN (images principales plus fiables que FR, qui met parfois
// des cartes) et fusionne les credits dans placePhotoCredits.json.
// Usage : node scripts/fetch-more-photos.mjs
import { mkdirSync, writeFileSync, readFileSync } from 'fs';

const UA = 'QueteDesMatieres/1.0 (jeu pedagogique de classe ; contact: tomicharles@gmail.com)';
const THUMB_WIDTH = 800;

// slug -> { title (article), lang }
const PLACES = {
  // Metropoles mondiales (programme geo cycle 4)
  'tokyo': { title: 'Shibuya Crossing', lang: 'en' },
  'shanghai': { title: 'Pudong', lang: 'en' },
  'singapour': { title: 'Marina Bay Sands', lang: 'en' },
  'hong-kong': { title: 'Victoria Harbour', lang: 'en' },
  'cite-interdite': { title: 'Forbidden City', lang: 'en' },
  'mumbai': { title: 'Gateway of India', lang: 'en' },
  'hollywood': { title: 'Hollywood Sign', lang: 'en' },
  // Mondialisation : canaux, detroits, ports
  'canal-suez': { title: 'Suez Canal', lang: 'en' },
  'canal-panama': { title: 'Panama Canal', lang: 'en' },
  'gibraltar': { title: 'Strait of Gibraltar', lang: 'en' },
  'rotterdam': { title: 'Port of Rotterdam', lang: 'en' },
  'petronas': { title: 'Petronas Towers', lang: 'en' },
  // Deserts et espaces de faible densite
  'sahara': { title: 'Erg Chebbi', lang: 'en' },
  'atacama': { title: 'Atacama Desert', lang: 'en' },
  'ilulissat': { title: 'Ilulissat Icefjord', lang: 'en' },
  'antarctique': { title: 'Antarctica', lang: 'en' },
  // Littoraux, tourisme, amenagement, agriculture
  'barriere-corail': { title: 'Great Barrier Reef', lang: 'en' },
  'kinderdijk': { title: 'Kinderdijk', lang: 'en' },
  'trois-gorges': { title: 'Three Gorges Dam', lang: 'en' },
  'banaue': { title: 'Banaue Rice Terraces', lang: 'en' },
  'mekong': { title: 'Mekong Delta', lang: 'en' },
  // France
  'mont-blanc': { title: 'Mont Blanc', lang: 'en' },
  'versailles': { title: 'Palace of Versailles', lang: 'en' },
  'dune-pilat': { title: 'Dune of Pilat', lang: 'en' },
  'pont-gard': { title: 'Pont du Gard', lang: 'en' },
  'calanques': { title: 'Calanques National Park', lang: 'en' },
  // Lieux celebres pour completer
  'iguacu': { title: 'Iguazu Falls', lang: 'en' },
  'uyuni': { title: 'Salar de Uyuni', lang: 'en' },
  'torres-paine': { title: 'Torres del Paine National Park', lang: 'en' },
  'rushmore': { title: 'Mount Rushmore', lang: 'en' },
  'lac-moraine': { title: 'Moraine Lake', lang: 'en' },
  'djenne': { title: 'Great Mosque of Djenné', lang: 'en' },
  'cappadoce': { title: 'Cappadocia', lang: 'en' },
  'pompei': { title: 'Pompeii', lang: 'en' },
  'alhambra': { title: 'Alhambra', lang: 'en' },
  'neuschwanstein': { title: 'Neuschwanstein Castle', lang: 'en' },
  'moher': { title: 'Cliffs of Moher', lang: 'en' },
  'geiranger': { title: 'Geirangerfjord', lang: 'en' },
  'bagan': { title: 'Bagan', lang: 'en' },
  'fushimi-inari': { title: 'Fushimi Inari-taisha', lang: 'en' },
  'santorin': { title: 'Santorini', lang: 'en' },
  // Correction : l'article FR donnait une carte
  'amazonie': { title: 'Amazon rainforest', lang: 'en' },
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

const creditsPath = new URL('../src/data/placePhotoCredits.json', import.meta.url);
const credits = JSON.parse(readFileSync(creditsPath, 'utf8'));
delete credits['lac-baikal']; // lieu retire du jeu
const report = [];

for (const [slug, { title, lang }] of Object.entries(PLACES)) {
  try {
    const data = await api(`https://${lang}.wikipedia.org/w/api.php`, {
      action: 'query', titles: title, redirects: '1',
      prop: 'pageimages', piprop: 'thumbnail|name', pithumbsize: String(THUMB_WIDTH),
    });
    const page = Object.values(data.query.pages)[0];
    const thumb = page?.thumbnail?.source;
    const fileName = page?.pageimage;
    if (!thumb || !fileName) { report.push(`MANQUANT  ${slug} (${title})`); continue; }

    const imgRes = await fetch(thumb, { headers: { 'User-Agent': UA } });
    if (!imgRes.ok) { report.push(`ECHEC DL  ${slug} (${imgRes.status})`); continue; }
    const buf = Buffer.from(await imgRes.arrayBuffer());
    writeFileSync(new URL(`${slug}.jpg`, outDir), buf);

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
    await sleep(250);
  } catch (e) {
    report.push(`ERREUR    ${slug} (${e.message})`);
  }
}

writeFileSync(creditsPath, JSON.stringify(credits, null, 2), 'utf8');
console.log(report.join('\n'));
console.log(`\nTermine — credits fusionnes dans src/data/placePhotoCredits.json`);
