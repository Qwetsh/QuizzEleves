// Reassemble les JSON par matiere en _cycle4.js, avec validation stricte :
// memes questions (q/c/e/t intacts), 4 reponses non vides, c valide.
// Usage: node scripts/merge-questions.mjs
import { CYCLE4_QUESTIONS } from '../src/data/questions/_cycle4.js';
import { readFileSync, writeFileSync } from 'fs';

const subjects = Object.keys(CYCLE4_QUESTIONS);
const out = {};
const problems = [];
let total = 0;

for (const s of subjects) {
  const orig = CYCLE4_QUESTIONS[s];
  const next = JSON.parse(readFileSync(new URL(`../tmp_distractors/${s}.json`, import.meta.url), 'utf8'));
  if (next.length !== orig.length) problems.push(`${s}: ${next.length} questions au lieu de ${orig.length}`);
  next.forEach((q, i) => {
    const o = orig[i];
    if (!o) return;
    if (q.q !== o.q || q.c !== o.c || q.e !== o.e || q.t !== o.t) problems.push(`${s}[${i}]: champ q/c/e/t modifié`);
    if (!Array.isArray(q.a) || q.a.length !== 4 || q.a.some((x) => typeof x !== 'string' || !x.trim())) {
      problems.push(`${s}[${i}]: réponses invalides`);
    }
    if (!Number.isInteger(q.c) || q.c < 0 || q.c > 3) problems.push(`${s}[${i}]: index c invalide`);
    const dedup = new Set(q.a.map((x) => x.trim().toLowerCase()));
    if (dedup.size !== 4) problems.push(`${s}[${i}]: réponses en doublon`);
  });
  out[s] = next;
  total += next.length;
}

if (problems.length) {
  console.error('ÉCHEC VALIDATION :\n' + problems.join('\n'));
  process.exit(1);
}

let body = '';
for (const s of subjects) {
  body += `  ${s}: [\n`;
  for (const q of out[s]) {
    body += `    ${JSON.stringify(q)},\n`;
  }
  body += '  ],\n';
}

const content = `/**
 * Questions Cycle 4 (5e + 4e + 3e) - ${total} questions
 * Chaque question a un champ \`t\` dont le prefixe indique le niveau (5e, 4e, 3e).
 * Ce fichier est la source de verite, importe par index.js qui filtre par niveau.
 *
 * Structure: { q: question, a: [4 reponses], c: index correct, e: explication, t: theme }
 *
 * NB: les distracteurs ont ete calibres pour que la longueur de la reponse
 * ne soit pas un indice (la bonne reponse n'est plus systematiquement la plus longue).
 */
export const CYCLE4_QUESTIONS = {
${body}};
`;

writeFileSync(new URL('../src/data/questions/_cycle4.js', import.meta.url), content, 'utf8');

// Mesure finale du biais
let biased = 0;
for (const qs of Object.values(out)) {
  for (const q of qs) {
    const lens = q.a.map((x) => x.length);
    const m = Math.max(...lens);
    if (lens[q.c] === m && lens.filter((l) => l === m).length === 1) biased++;
  }
}
console.log(`OK — ${total} questions réécrites dans _cycle4.js`);
console.log(`Bonne réponse strictement la plus longue : ${biased}/${total} (${Math.round((100 * biased) / total)}%)`);
