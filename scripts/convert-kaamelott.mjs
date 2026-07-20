// Convertit le CSV source Kaamelott (scripts/generated/pool/kaamelott_source.csv)
// au format « pool » attendu par seed-pool-questions.mjs :
//   { q, a:[bonne, d1, d2, d3], correct:0, e, difficulte, generalite }
// - Parseur CSV maison (délimiteur ';', champs entre guillemets → « ; » internes OK).
// - Ignore les lignes d'en-tête (theme;sous_theme;…) et les lignes vides.
// - Déduplique sur la question normalisée (les 2 lots fournis se recoupent).
// - Écarte (en le signalant) toute ligne aux 4 réponses non distinctes/vides.
// Idempotent : réécrit scripts/generated/pool/kaamelott.json.
//   node scripts/convert-kaamelott.mjs
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const DIR = path.join(process.cwd(), 'scripts', 'generated', 'pool');
const raw = readFileSync(path.join(DIR, 'kaamelott_source.csv'), 'utf8');

// --- Parseur CSV (délimiteur ';', guillemets doubles échappés par doublement) ---
function parseLine(line) {
  const out = [];
  let cur = '';
  let inQ = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (inQ) {
      if (c === '"') {
        if (line[i + 1] === '"') { cur += '"'; i++; }
        else inQ = false;
      } else cur += c;
    } else if (c === '"') inQ = true;
    else if (c === ';') { out.push(cur); cur = ''; }
    else cur += c;
  }
  out.push(cur);
  return out;
}

const norm = (s) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();
const toInt = (s) => { const n = parseInt(String(s).trim(), 10); return Number.isInteger(n) ? n : null; };

const lines = raw.split(/\r?\n/);
const seen = new Set();
const rows = [];
const skipped = [];
let dupes = 0;

for (const line of lines) {
  if (!line.trim()) continue;
  const f = parseLine(line);
  if (f[0] && f[0].trim().toLowerCase() === 'theme') continue; // en-tête
  // theme;sous_theme;question;bonne;d1;d2;d3;explication;difficulte;generalite;note
  const [, , q, bonne, d1, d2, d3, e, diff, gen] = f;
  const question = (q || '').trim();
  const answers = [bonne, d1, d2, d3].map((x) => (x || '').trim());
  if (!question || answers.some((a) => !a)) { skipped.push(`réponses/question vides: ${question || '(vide)'}`); continue; }
  if (new Set(answers.map((a) => a.toLowerCase())).size !== 4) { skipped.push(`réponses non distinctes: ${question}`); continue; }
  const key = norm(question);
  if (seen.has(key)) { dupes++; continue; }
  seen.add(key);
  rows.push({
    q: question,
    a: answers,
    correct: 0,
    e: (e || '').trim() || null,
    difficulte: toInt(diff),
    generalite: toInt(gen),
  });
}

writeFileSync(path.join(DIR, 'kaamelott.json'), JSON.stringify(rows, null, 0).replace(/},{/g, '},\n{') + '\n', 'utf8');

console.log(`✓ ${rows.length} questions écrites dans kaamelott.json`);
if (dupes) console.log(`  ${dupes} doublons fusionnés (question identique).`);
if (skipped.length) console.log(`  ${skipped.length} écartées :\n   - ${skipped.join('\n   - ')}`);
