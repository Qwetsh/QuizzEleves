// Curioscope — applique un labels.json au spots.csv d'une session.
// labels.json : { "<t>": ["label", difficulte, actif], ... } (clé = colonne t du CSV).
// Écrase label / difficulte / actif des lignes correspondantes, préserve le reste.
//
//   node scripts/curioscope/apply-labels.mjs <dossier-session>
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { parseCsv, toCsv } from './snaplib.mjs';

const dir = process.argv[2];
if (!dir || !existsSync(join(dir, 'spots.csv')) || !existsSync(join(dir, 'labels.json'))) {
  console.error('Usage: node scripts/curioscope/apply-labels.mjs <dossier-session>  (spots.csv + labels.json requis)');
  process.exit(1);
}

const labels = JSON.parse(readFileSync(join(dir, 'labels.json'), 'utf8'));
const rows = parseCsv(readFileSync(join(dir, 'spots.csv'), 'utf8'));

let applied = 0; let missing = 0;
for (const r of rows) {
  const l = labels[r.t];
  if (!l) continue;
  const [label, difficulte, actif] = l;
  r.label = label;
  r.difficulte = String(difficulte);
  r.actif = String(actif);
  applied++;
}
const csvKeys = new Set(rows.map((r) => r.t));
for (const t of Object.keys(labels)) if (!csvKeys.has(t)) { console.warn(`⚠ clé labels absente du CSV : ${t}`); missing++; }

writeFileSync(join(dir, 'spots.csv'), toCsv(rows), 'utf8');
console.log(`✔ ${applied} ligne(s) mise(s) à jour · ${missing} clé(s) sans correspondance`);
