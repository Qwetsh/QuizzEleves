// Convertit quiz_brevet_complet.json (format DNB) vers le format interne du jeu
// et l'écrit dans src/data/questions/_brevet.js (export BREVET_QUESTIONS).
//
// - Exclut les questions necessite_doc (14) : pas de support pour les figures.
// - Mappe les 5 matières DNB vers les 6 matières du plateau :
//     Français → francais ; Mathématiques → maths ; SVT + Physique-Chimie → svt
//     Histoire-Géographie-EMC → histoire (Histoire+EMC) / geographie (Géographie)
//   (pas de questions d'anglais dans le brevet)
// - Mélange les choix de chaque question (Fisher-Yates seedé par id) pour casser
//   le biais de position : dans la source, la bonne réponse est en case 1 dans
//   67 % des cas. Le seed rend le résultat stable d'un run à l'autre.
//
// Usage : node scripts/convert-brevet.mjs

import fs from 'node:fs';
import path from 'node:path';

const SRC = 'quiz_brevet_complet.json';
const DEST = 'src/data/questions/_brevet.js';

// PRNG déterministe (mulberry32) pour un mélange stable seedé par l'id
function hashSeed(str) {
  let h = 1779033703 ^ str.length;
  for (let i = 0; i < str.length; i++) {
    h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return h >>> 0;
}
function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Mélange choix[] en suivant l'index correct. Retourne { a, c }.
function shuffleChoices(choix, correctIdx, seed) {
  const rng = mulberry32(seed);
  const arr = choix.map((text, i) => ({ text, correct: i === correctIdx }));
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return { a: arr.map((x) => x.text), c: arr.findIndex((x) => x.correct) };
}

function subjectFor(q) {
  switch (q.matiere) {
    case 'Français': return 'francais';
    case 'Mathématiques': return 'maths';
    case 'SVT':
    case 'Physique-Chimie': return 'svt';
    case 'Histoire-Géographie-EMC':
      return q.theme === 'Géographie' ? 'geographie' : 'histoire';
    default: return null;
  }
}

const raw = JSON.parse(fs.readFileSync(SRC, 'utf8'));
const out = { francais: [], maths: [], histoire: [], geographie: [], svt: [], anglais: [] };
let skippedDoc = 0, skippedOther = 0;

for (const q of raw.questions) {
  if (q.necessite_doc) { skippedDoc++; continue; }
  const subject = subjectFor(q);
  if (!subject || !Array.isArray(q.choix) || q.correctes?.length !== 1) { skippedOther++; continue; }

  const { a, c } = shuffleChoices(q.choix, q.correctes[0], hashSeed(q.id));
  out[subject].push({
    q: q.question,
    a,
    c,
    e: q.explication || '',
    t: `Brevet · ${q.chapitre || q.theme}`,
  });
}

// Vérif anti-biais : distribution de l'index correct après mélange
const dist = [0, 0, 0, 0];
let total = 0;
for (const arr of Object.values(out)) for (const q of arr) { dist[q.c]++; total++; }

const header = `// Questions « spécial Brevet » (DNB 3e) — converties depuis quiz_brevet_complet.json
// par scripts/convert-brevet.mjs. NE PAS éditer à la main : relancer le script.
//
// Pool ADDITIF : activé via le toggle « + Brevet » du Setup, fusionné aux
// questions du niveau choisi (cf. getQuestions dans index.js). Même structure
// { q, a, c, e, t } que _cycle4.js. Les choix ont été mélangés (seed par id)
// pour neutraliser le biais de position de la source.
//
// Total : ${total} questions — doc exclus : ${skippedDoc}
`;

const body = 'export const BREVET_QUESTIONS = ' + JSON.stringify(out, null, 1) + ';\n';
fs.mkdirSync(path.dirname(DEST), { recursive: true });
fs.writeFileSync(DEST, header + body);

console.log(`Écrit ${DEST}`);
console.log(`Total : ${total} | doc exclus : ${skippedDoc} | autres exclus : ${skippedOther}`);
console.log('Par matière :', Object.fromEntries(Object.entries(out).map(([k, v]) => [k, v.length])));
console.log('Distribution index correct :', dist.map((n, i) => `c${i}=${(100 * n / total).toFixed(0)}%`).join(' '));
