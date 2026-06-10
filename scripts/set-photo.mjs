// Installe une photo PRECISE de Wikimedia Commons pour un lieu du Tour du
// monde (quand l'image principale d'article ne convient pas), credits inclus.
// Usage : node scripts/set-photo.mjs <slug> "<Nom de fichier Commons sans prefixe File:>"
// Ex    : node scripts/set-photo.mjs petronas "Petronas Panorama II.jpg"
import { writeFileSync, readFileSync } from 'fs';

const UA = 'QueteDesMatieres/1.0 (jeu pedagogique de classe ; contact: tomicharles@gmail.com)';
const [slug, ...fileParts] = process.argv.slice(2);
const fileName = fileParts.join(' ');
if (!slug || !fileName) {
  console.error('Usage: node scripts/set-photo.mjs <slug> "<fichier Commons>"');
  process.exit(1);
}

function stripHtml(s) {
  return (s || '').replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
}

const headers = { 'User-Agent': UA };

// Telechargement de la miniature 800px via Special:FilePath
const url = `https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(fileName)}?width=800`;
const img = await fetch(url, { headers });
if (!img.ok) { console.error(`Echec telechargement (${img.status}) : ${fileName}`); process.exit(1); }
const buf = Buffer.from(await img.arrayBuffer());
writeFileSync(new URL(`../src/assets/places/${slug}.jpg`, import.meta.url), buf);

let author = '', license = '';
try {
  const meta = await fetch(
    `https://commons.wikimedia.org/w/api.php?${new URLSearchParams({
      format: 'json', action: 'query', titles: `File:${fileName}`,
      prop: 'imageinfo', iiprop: 'extmetadata',
    })}`, { headers });
  const md = await meta.json();
  const info = Object.values(md.query.pages)[0]?.imageinfo?.[0]?.extmetadata || {};
  author = stripHtml(info.Artist?.value);
  license = stripHtml(info.LicenseShortName?.value);
} catch { /* credits facultatifs */ }

const creditsPath = new URL('../src/data/placePhotoCredits.json', import.meta.url);
const credits = JSON.parse(readFileSync(creditsPath, 'utf8'));
credits[slug] = {
  title: credits[slug]?.title || slug, file: fileName, author, license,
  source: `https://commons.wikimedia.org/wiki/File:${encodeURIComponent(fileName)}`,
};
writeFileSync(creditsPath, JSON.stringify(credits, null, 2), 'utf8');

console.log(`OK ${slug} <- ${fileName} (${(buf.length / 1024).toFixed(0)} Ko) [${license || 'licence ?'}]`);
