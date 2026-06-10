// Remplace la photo d'UN lieu du Tour du monde par l'image principale
// d'un article Wikipedia donne, et met a jour les credits.
// Usage : node scripts/replace-photo.mjs <slug> <lang> <titre d'article...>
// Ex    : node scripts/replace-photo.mjs santorin en Oia, Greece
import { writeFileSync, readFileSync } from 'fs';

const UA = 'QueteDesMatieres/1.0 (jeu pedagogique de classe ; contact: tomicharles@gmail.com)';
const [slug, lang, ...titleParts] = process.argv.slice(2);
const title = titleParts.join(' ');
if (!slug || !lang || !title) {
  console.error('Usage: node scripts/replace-photo.mjs <slug> <lang> <titre>');
  process.exit(1);
}

function stripHtml(s) {
  return (s || '').replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
}

const headers = { 'User-Agent': UA };
const res = await fetch(
  `https://${lang}.wikipedia.org/w/api.php?${new URLSearchParams({
    format: 'json', action: 'query', titles: title, redirects: '1',
    prop: 'pageimages', piprop: 'thumbnail|name', pithumbsize: '800',
  })}`, { headers });
const data = await res.json();
const page = Object.values(data.query.pages)[0];
if (!page?.thumbnail) { console.error(`Pas d'image principale pour "${title}" (${lang})`); process.exit(1); }

const img = await fetch(page.thumbnail.source, { headers });
const buf = Buffer.from(await img.arrayBuffer());
const dest = new URL(`../src/assets/places/${slug}.jpg`, import.meta.url);
writeFileSync(dest, buf);

let author = '', license = '';
try {
  const meta = await fetch(
    `https://commons.wikimedia.org/w/api.php?${new URLSearchParams({
      format: 'json', action: 'query', titles: `File:${page.pageimage}`,
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
  title, file: page.pageimage, author, license,
  source: `https://commons.wikimedia.org/wiki/File:${encodeURIComponent(page.pageimage)}`,
};
writeFileSync(creditsPath, JSON.stringify(credits, null, 2), 'utf8');

console.log(`OK ${slug} <- ${page.pageimage} (${(buf.length / 1024).toFixed(0)} Ko) [${license || 'licence ?'}]`);
