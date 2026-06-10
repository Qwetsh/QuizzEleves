// Decoupe _cycle4.js en un JSON par matiere (chantier distracteurs).
// Usage: node scripts/split-questions.mjs
import { CYCLE4_QUESTIONS } from '../src/data/questions/_cycle4.js';
import { mkdirSync, writeFileSync } from 'fs';

const OUT = new URL('../tmp_distractors/', import.meta.url);
mkdirSync(OUT, { recursive: true });

const stats = {};
for (const [subject, questions] of Object.entries(CYCLE4_QUESTIONS)) {
  let biased = 0;
  for (const q of questions) {
    const lens = q.a.map((s) => s.length);
    const maxLen = Math.max(...lens);
    if (lens[q.c] === maxLen && lens.filter((l) => l === maxLen).length === 1) biased++;
  }
  stats[subject] = { total: questions.length, biased };
  writeFileSync(new URL(`${subject}.json`, OUT), JSON.stringify(questions, null, 1), 'utf8');
}
console.log(JSON.stringify(stats, null, 2));
