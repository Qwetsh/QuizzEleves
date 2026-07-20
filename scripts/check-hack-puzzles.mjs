#!/usr/bin/env node
// Validateur de la banque d'enigmes « hacking » (mini-jeu duel, theme informatique_numerique).
// Contenu FICTIF/EDUCATIF : ce sont des enigmes de programmation habillees « hacker » (CTF de film),
// pas de vrais outils d'attaque. Node pur, sans dependance.
//
// Verifie pour chaque enigme :
//  - les marqueurs §N dans `lines` forment 0..k-1 sans trou ni doublon
//  - le nombre de marqueurs distincts == blanks.length
//  - chaque blank : answer ∈ choices, 4 choices distinctes
//  - lang ∈ liste connue, level ∈ {1,2,3}
//  - ids uniques
//  - le caractere § n'apparait QUE comme marqueur valide (§ suivi d'un chiffre)
// Affiche un decompte langage × niveau et sort en erreur si un probleme.

import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_PATH = join(__dirname, '..', 'src', 'data', 'hackPuzzles.json');

const LANGS = ['python', 'javascript', 'bash', 'sql', 'c', 'php'];
const LEVELS = [1, 2, 3];

const errors = [];
const fail = (id, msg) => errors.push(`[${id}] ${msg}`);

function extractMarkers(lines, id) {
  // Tout § doit etre suivi d'un ou plusieurs chiffres. On collecte les index.
  const indices = [];
  const joined = lines.join('\n');
  const re = /§(\d*)/g;
  let m;
  while ((m = re.exec(joined)) !== null) {
    if (m[1] === '') {
      fail(id, `marqueur § sans index (le caractere § ne doit apparaitre que comme §N)`);
      continue;
    }
    indices.push(Number(m[1]));
  }
  return indices;
}

async function main() {
  let raw;
  try {
    raw = await readFile(DATA_PATH, 'utf8');
  } catch (e) {
    console.error(`Impossible de lire ${DATA_PATH}: ${e.message}`);
    process.exit(1);
  }

  let data;
  try {
    data = JSON.parse(raw);
  } catch (e) {
    console.error(`JSON invalide: ${e.message}`);
    process.exit(1);
  }

  const puzzles = data && Array.isArray(data.puzzles) ? data.puzzles : null;
  if (!puzzles) {
    console.error('Le fichier doit contenir un tableau `puzzles`.');
    process.exit(1);
  }

  const seenIds = new Set();
  // counts[lang][level]
  const counts = {};
  for (const l of LANGS) counts[l] = { 1: 0, 2: 0, 3: 0 };

  for (const p of puzzles) {
    const id = p && p.id ? p.id : '(sans id)';

    if (!p.id || typeof p.id !== 'string') {
      fail(id, 'id manquant ou non-string');
    } else if (seenIds.has(p.id)) {
      fail(id, 'id en doublon');
    } else {
      seenIds.add(p.id);
    }

    if (!LANGS.includes(p.lang)) {
      fail(id, `lang inconnu: ${JSON.stringify(p.lang)}`);
    }
    if (!LEVELS.includes(p.level)) {
      fail(id, `level invalide: ${JSON.stringify(p.level)}`);
    }
    for (const field of ['title', 'titleEn']) {
      if (typeof p[field] !== 'string' || !p[field].trim()) {
        fail(id, `${field} manquant ou vide`);
      }
    }

    if (!Array.isArray(p.lines) || p.lines.length === 0) {
      fail(id, 'lines manquant ou vide');
      continue;
    }
    if (!p.lines.every((l) => typeof l === 'string')) {
      fail(id, 'lines doit etre un tableau de chaines');
      continue;
    }
    if (!Array.isArray(p.blanks)) {
      fail(id, 'blanks manquant');
      continue;
    }

    // Marqueurs
    const markers = extractMarkers(p.lines, id);
    const uniq = [...new Set(markers)];
    if (markers.length !== uniq.length) {
      fail(id, `marqueur §N en doublon dans les lignes (${markers.join(',')})`);
    }
    const sorted = [...uniq].sort((a, b) => a - b);
    const expected = p.blanks.length;
    const contiguous =
      sorted.length === expected && sorted.every((v, i) => v === i);
    if (!contiguous) {
      fail(
        id,
        `marqueurs [${sorted.join(',')}] doivent former 0..${expected - 1} (blanks.length=${expected})`
      );
    }

    if (p.blanks.length < 2 || p.blanks.length > 4) {
      fail(id, `nombre de trous ${p.blanks.length} hors bornes 2..4`);
    }

    p.blanks.forEach((b, i) => {
      if (!b || !Array.isArray(b.choices)) {
        fail(id, `blank ${i}: choices manquant`);
        return;
      }
      if (b.choices.length !== 4) {
        fail(id, `blank ${i}: ${b.choices.length} choices (attendu 4)`);
      }
      if (new Set(b.choices).size !== b.choices.length) {
        fail(id, `blank ${i}: choices en doublon (${b.choices.join(' | ')})`);
      }
      if (!('answer' in b)) {
        fail(id, `blank ${i}: answer manquant`);
      } else if (!b.choices.includes(b.answer)) {
        fail(id, `blank ${i}: answer ${JSON.stringify(b.answer)} absent de choices`);
      }
    });

    if (LANGS.includes(p.lang) && LEVELS.includes(p.level)) {
      counts[p.lang][p.level] += 1;
    }
  }

  // Decompte + verification de couverture (>= 12 par langage, >= 3 par niveau)
  console.log('Decompte par langage × niveau :');
  console.log('  lang        L1   L2   L3   total');
  let total = 0;
  for (const l of LANGS) {
    const c = counts[l];
    const t = c[1] + c[2] + c[3];
    total += t;
    console.log(
      `  ${l.padEnd(10)} ${String(c[1]).padStart(3)}  ${String(c[2]).padStart(3)}  ${String(c[3]).padStart(3)}   ${String(t).padStart(3)}`
    );
    if (t < 12) fail(`lang:${l}`, `couverture insuffisante: ${t} enigmes (>= 12 attendues)`);
    for (const lv of LEVELS) {
      if (c[lv] < 3) fail(`lang:${l}`, `niveau ${lv}: ${c[lv]} enigmes (>= 3 attendues)`);
    }
  }
  console.log(`  TOTAL: ${total} enigmes`);

  if (errors.length) {
    console.error(`\n${errors.length} probleme(s) detecte(s) :`);
    for (const e of errors) console.error('  - ' + e);
    process.exit(1);
  }

  console.log('\nOK — banque valide (100%). Contenu fictif/educatif (enigmes de programmation, CTF de film).');
}

main();
