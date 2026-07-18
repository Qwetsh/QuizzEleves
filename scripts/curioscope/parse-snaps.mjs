// Curioscope P3 — étape 1 : SavedVariables + screenshots → spots.csv éditable.
//
//   node scripts/curioscope/parse-snaps.mjs <dossier-session>
//
// <dossier-session> (ex. C:\CurioscopeAssets\wow\session-1) doit contenir :
//   - CurioSnap.lua            (copié depuis WTF/Account/<COMPTE>/SavedVariables/)
//   - WoWScrnShot_*.jpg        (copiés depuis le dossier Screenshots/ du jeu)
// Produit/complète spots.csv dans ce dossier (fusion : les lignes existantes
// — labels/difficultés édités à la main — sont conservées, seules les
// captures NOUVELLES sont ajoutées). Éditer ensuite label/difficulte/actif
// dans un tableur, puis lancer build-spots.mjs.
import { readFileSync, writeFileSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { parseSavedVariables, entriesToRows, mergeRows, parseCsv, toCsv } from './snaplib.mjs';

const dir = process.argv[2];
if (!dir || !existsSync(dir)) {
  console.error('Usage: node scripts/curioscope/parse-snaps.mjs <dossier-session>');
  process.exit(1);
}

const luaPath = join(dir, 'CurioSnap.lua');
if (!existsSync(luaPath)) {
  console.error(`Introuvable : ${luaPath} (copie le fichier SavedVariables dans le dossier de session)`);
  process.exit(1);
}

const entries = parseSavedVariables(readFileSync(luaPath, 'utf8'));
console.log(`Journal : ${entries.length} capture(s) dans CurioSnap.lua`);

// Screenshots présents dans le dossier, indexés par timestamp du nom.
const imagesByT = new Map();
for (const f of readdirSync(dir)) {
  const m = f.match(/^WoWScrnShot_(\d{6}_\d{6})\.(jpe?g|png|tga)$/i);
  if (m) imagesByT.set(m[1], f);
}
console.log(`Images  : ${imagesByT.size} screenshot(s) dans ${dir}`);

const fresh = entriesToRows(entries, imagesByT);
const noImg = fresh.filter((r) => !r.fichier).length;
const noCont = fresh.filter((r) => r.fichier && !r.actif).length;
if (noImg) console.warn(`⚠ ${noImg} capture(s) sans image correspondante (screenshot manquant ?)`);
if (noCont) console.warn(`⚠ ${noCont} capture(s) sans position continent (grotte/donjon ?) → actif=0`);

const csvPath = join(dir, 'spots.csv');
const existing = existsSync(csvPath) ? parseCsv(readFileSync(csvPath, 'utf8')) : [];
const merged = mergeRows(existing, fresh);
writeFileSync(csvPath, toCsv(merged), 'utf8');
console.log(`✔ ${csvPath} : ${merged.length} ligne(s) (${merged.length - existing.length} nouvelle(s))`);
console.log('→ Édite label / difficulte (1-5) / actif, puis : node scripts/curioscope/build-spots.mjs ' + dir);
