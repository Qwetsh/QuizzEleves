// Genere src/data/frenchWords.js a partir de la liste an-array-of-french-words (MIT).
// Filtre : mots de 2 a 9 lettres, diacritiques retires (tuiles A-Z facon Scrabble),
// uniquement alphabetique, dedupliques, tries.
// Usage: node scripts/gen-dictionary.mjs <chemin-index.json>
import { readFileSync, writeFileSync } from 'fs';

const src = process.argv[2];
if (!src) { console.error('Usage: node scripts/gen-dictionary.mjs <index.json>'); process.exit(1); }

const words = JSON.parse(readFileSync(src, 'utf8'));
const seen = new Set();

for (const w of words) {
  // Retire les diacritiques (é→e, œ→oe geree ensuite), passe en majuscules
  const norm = w
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/œ/g, 'oe').replace(/æ/g, 'ae')
    .toUpperCase();
  if (!/^[A-Z]{2,9}$/.test(norm)) continue;
  seen.add(norm);
}

const sorted = [...seen].sort();
const out = `// Lexique francais normalise (A-Z, 2-9 lettres) pour le mini-jeu Mot le Plus Long.
// Genere par scripts/gen-dictionary.mjs depuis an-array-of-french-words (licence MIT,
// https://github.com/words/an-array-of-french-words) — ${sorted.length} mots.
// Diacritiques retires (tuiles type Scrabble) : "ECOLE" valide "école".
export const FRENCH_WORDS = ${JSON.stringify(sorted.join('\n'))};
`;
writeFileSync(new URL('../src/data/frenchWords.js', import.meta.url), out, 'utf8');
console.log(`OK — ${sorted.length} mots, fichier ${(out.length / 1024 / 1024).toFixed(2)} Mo`);
