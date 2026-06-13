// Copie les decoupes brutes (art/board-sheets/cut) vers src/assets/board/
// avec des noms semantiques. Le mapping suit l'ordre ligne/colonne du
// manifest de slice-assets.mjs (verifie visuellement le 2026-06-11).
import fs from 'node:fs';
import path from 'node:path';

const SRC = 'art/board-sheets/cut';
const DEST = 'src/assets/board';

const MAP = {
  // --- sheet1 : tuiles de chemin, socles, rochers ---
  'sheet1-r1c1': 'tile-round',
  'sheet1-r1c2': 'tile-link-l',
  'sheet1-r1c3': 'tile-link-double',
  'sheet1-r1c4': 'tile-curve',
  'sheet1-r2c1': 'bridge-small',
  'sheet1-r2c2': 'junction-y-a',
  'sheet1-r2c3': 'junction-y-b',
  'sheet1-r2c4': 'junction-cross',
  'sheet1-r3c1': 'socle-depart',
  'sheet1-r3c2': 'socle-arrivee',
  'sheet1-r3c3': 'clairiere-sable',
  'sheet1-r4c1': 'rocher-grave-a',
  'sheet1-r4c2': 'rocher-corde',
  'sheet1-r4c3': 'rocher-grave-rune',

  // --- sheet2 : disques matieres (ordre des bannieres) + segments + bannieres ---
  // lignes : 1 francais (rose), 2 histoire (or), 3 svt (vert),
  //          4 anglais (bleu), 5 maths (orange), 6 geographie (turquoise)
  ...Object.fromEntries(
    ['francais', 'histoire', 'svt', 'anglais', 'maths', 'geographie'].flatMap((s, i) => [
      [`sheet2-r${i + 1}c1`, `disc-${s}-light`],
      [`sheet2-r${i + 1}c2`, `disc-${s}`],
      [`sheet2-r${i + 1}c3`, `tile-case-${s}`],
      [`sheet2-r${i + 1}c4`, `tile-case2-${s}`],
    ])
  ),
  'sheet2-r7c1': 'banner-francais',
  'sheet2-r7c2': 'banner-histoire',
  'sheet2-r7c3': 'banner-svt',
  'sheet2-r7c4': 'banner-anglais',
  'sheet2-r7c5': 'banner-maths',
  'sheet2-r7c6': 'banner-geographie',

  // --- sheet3 : props Francais + Histoire ---
  'sheet3-r1c1': 'prop-francais-livres',
  'sheet3-r1c2': 'prop-francais-livre-ouvert',
  'sheet3-r1c3': 'prop-francais-plume',
  'sheet3-r1c4': 'prop-francais-parchemin',
  'sheet3-r1c5': 'prop-francais-pupitre',
  'sheet3-r2c1': 'prop-francais-lettres',
  'sheet3-r3c1': 'clairiere-pierre-a',
  'sheet3-r3c2': 'clairiere-pierre-b',
  'sheet3-r3c3': 'clairiere-pierre-c',
  'sheet3-r4c1': 'prop-histoire-colonne',
  'sheet3-r4c2': 'prop-histoire-arche',
  'sheet3-r4c3': 'prop-histoire-amphore',
  'sheet3-r4c4': 'prop-histoire-casque',
  'sheet3-r4c5': 'prop-histoire-ruines-stele',
  'sheet3-r5c1': 'clairiere-fleurs-a',
  'sheet3-r5c2': 'clairiere-fleurs-b',
  'sheet3-r5c3': 'clairiere-fleurs-c',

  // --- sheet4 : props Geographie / voyage (+ bus pour Anglais) ---
  'sheet4-r1c1': 'prop-geographie-valise',
  'sheet4-r1c2': 'prop-anglais-bus',
  'sheet4-r1c3': 'prop-geographie-photo',
  'sheet4-r1c4': 'prop-geographie-globe-petit',
  'sheet4-r1c5': 'prop-geographie-panneau',
  'sheet4-r2c1': 'prop-geographie-passeports',
  'sheet4-r2c2': 'clairiere-geo-a',
  'sheet4-r2c3': 'clairiere-geo-b',
  'sheet4-r2c4': 'clairiere-geo-palmier',
  'sheet4-r3c1': 'prop-geographie-carte',
  'sheet4-r3c2': 'prop-geographie-longuevue',
  'sheet4-r3c3': 'prop-geographie-boussole',
  'sheet4-r3c4': 'prop-geographie-globe',
  'sheet4-r3c5': 'prop-geographie-rouleau',
  'sheet4-r4c1': 'prop-geographie-monuments',
  'sheet4-r4c2': 'prop-geographie-rocher',
  'sheet4-r4c3': 'prop-geographie-oasis',
  'sheet4-r4c4': 'prop-geographie-cactus',

  // --- sheet5 : props SVT + Maths ---
  'sheet5-r1c1': 'prop-svt-serre',
  'sheet5-r1c2': 'prop-svt-microscope',
  'sheet5-r1c3': 'prop-svt-cloche',
  'sheet5-r1c4': 'prop-svt-ammonite',
  'sheet5-r1c5': 'prop-svt-fioles',
  'sheet5-r2c1': 'prop-svt-pots',
  'sheet5-r2c2': 'prop-svt-crane',
  'sheet5-r2c3': 'prop-maths-tableau-compas',
  'sheet5-r2c4': 'prop-maths-equerre',
  'sheet5-r3c1': 'prop-maths-regle',
  'sheet5-r3c2': 'prop-maths-solides',
  'sheet5-r3c3': 'prop-maths-calculatrice',
  'sheet5-r3c4': 'prop-maths-cubes',
  'sheet5-r4c1': 'clairiere-svt-a',
  'sheet5-r4c2': 'clairiere-svt-b',
  'sheet5-r4c3': 'clairiere-svt-c',

  // --- sheet6 : vegetation, rochers, plages, ponts, fanions ---
  'sheet6-r1c1': 'palmier-a',
  'sheet6-r1c2': 'palmier-b',
  'sheet6-r1c3': 'palmier-c',
  'sheet6-r1c4': 'buisson-rose',
  'sheet6-r1c5': 'buisson-jaune',
  'sheet6-r1c6': 'buisson-rouge',
  'sheet6-r2c1': 'rocher-a',
  'sheet6-r2c2': 'rocher-b',
  'sheet6-r2c3': 'rocher-c',
  'sheet6-r2c4': 'plage-a',
  'sheet6-r2c5': 'plage-b',
  'sheet6-r3c1': 'pont-a',
  'sheet6-r3c2': 'pont-b',
  'sheet6-r3c3': 'pont-c',
  'sheet6-r3c4': 'pont-d',
  'sheet6-r3c5': 'fanion-rouge',
  'sheet6-r3c6': 'fanion-jaune',
  'sheet6-r4c1': 'colonne-ruine',
  'sheet6-r4c2': 'stele-ruine',
  'sheet6-r4c3': 'clairiere-herbe-a',
  'sheet6-r4c4': 'clairiere-herbe-b',

  // --- sheet7 : props Francais, fournee 2 (violet, 12 juin) ---
  'sheet7-r1c1': 'prop-francais-livres-b',
  'sheet7-r1c2': 'prop-francais-livre-ouvert-b',
  'sheet7-r1c3': 'prop-francais-encrier-plume',
  'sheet7-r1c4': 'prop-francais-parchemin-b',
  'sheet7-r2c1': 'prop-francais-enveloppe',
  'sheet7-r2c2': 'prop-francais-feuilles',
  'sheet7-r2c3': 'prop-francais-ecritoire',
  'sheet7-r2c4': 'prop-francais-marque-page',
  'sheet7-r3c1': 'prop-francais-rouleau',
  'sheet7-r3c2': 'prop-francais-encre',
  'sheet7-r3c3': 'prop-francais-plume-laurier',

  // --- sheet8 : props Anglais (bleu, 12 juin) ---
  'sheet8-r1c1': 'prop-anglais-valise',
  'sheet8-r1c2': 'prop-anglais-dictionnaire',
  'sheet8-r1c3': 'prop-anglais-bulle',
  'sheet8-r1c4': 'prop-anglais-globe',
  'sheet8-r2c1': 'prop-anglais-photo',
  'sheet8-r2c2': 'prop-anglais-bus-b',
  'sheet8-r2c3': 'prop-anglais-panneau',
  'sheet8-r2c4': 'prop-anglais-livre',
  'sheet8-r3c1': 'prop-anglais-the',
  'sheet8-r3c2': 'prop-anglais-casque',
  'sheet8-r3c3': 'prop-anglais-lettre',
  'sheet8-r3c4': 'prop-anglais-cabine',

  // --- sheet9 : props Maths, fournee 2 (orange, 12 juin) ---
  'sheet9-r1c1': 'prop-maths-calculatrice-b',
  'sheet9-r1c2': 'prop-maths-regles',
  'sheet9-r1c3': 'prop-maths-equerre-b',
  'sheet9-r1c4': 'prop-maths-compas',
  'sheet9-r2c1': 'prop-maths-tableau',
  'sheet9-r2c2': 'prop-maths-solides-b',
  'sheet9-r2c3': 'prop-maths-boulier',
  'sheet9-r2c4': 'prop-maths-rapporteur',
  'sheet9-r3c1': 'prop-maths-cubes-b',
  'sheet9-r3c2': 'prop-maths-metre',
  'sheet9-r3c3': 'prop-maths-graphique',
  'sheet9-r3c4': 'prop-maths-operations',

  // --- sheet10 : props SVT, fournee 2 (vert, 12 juin) ---
  'sheet10-r1c1': 'prop-svt-microscope-b',
  'sheet10-r1c2': 'prop-svt-fioles-b',
  'sheet10-r1c3': 'prop-svt-pots-b',
  'sheet10-r1c4': 'prop-svt-fougere',
  'sheet10-r2c1': 'prop-svt-ammonite-b',
  'sheet10-r2c2': 'prop-svt-crane-b',
  'sheet10-r2c3': 'prop-svt-cloche-b',
  'sheet10-r2c4': 'prop-svt-serre-b',
  'sheet10-r3c1': 'prop-svt-arrosoir',
  'sheet10-r3c2': 'prop-svt-pelle',
  'sheet10-r3c3': 'prop-svt-herbier',
  'sheet10-r3c4': 'prop-svt-loupe',

  // --- sheet11 : props Histoire, fournee 2 (dore, 12 juin) ---
  // r3c1 contenait rouleau+temple, scinde a la main en r3c1 / r3c1b
  'sheet11-r1c1': 'prop-histoire-colonne-b',
  'sheet11-r1c2': 'prop-histoire-arche-b',
  'sheet11-r1c3': 'prop-histoire-amphore-b',
  'sheet11-r1c4': 'prop-histoire-casque-b',
  'sheet11-r2c1': 'prop-histoire-tablette',
  'sheet11-r2c2': 'prop-histoire-buste',
  'sheet11-r2c3': 'prop-histoire-laurier',
  'sheet11-r2c4': 'prop-histoire-mosaique',
  'sheet11-r3c1': 'prop-histoire-rouleau',
  'sheet11-r3c1b': 'prop-histoire-temple',
  'sheet11-r3c2': 'prop-histoire-medaille',
  'sheet11-r3c3': 'prop-histoire-bouclier',

  // --- sheet12 : props Geographie, fournee 2 (turquoise, 12 juin) ---
  'sheet12-r1c1': 'prop-geographie-boussole-b',
  'sheet12-r1c2': 'prop-geographie-globe-c',
  'sheet12-r1c3': 'prop-geographie-carte-rouleau',
  'sheet12-r1c4': 'prop-geographie-telescope',
  'sheet12-r2c1': 'prop-geographie-panneau-b',
  'sheet12-r2c2': 'prop-geographie-carte-b',
  'sheet12-r2c3': 'prop-geographie-ile',
  'sheet12-r2c4': 'prop-geographie-cactus-b',
  'sheet12-r3c1': 'prop-geographie-oasis-b',
  'sheet12-r3c2': 'prop-geographie-jumelles',
  'sheet12-r3c3': 'prop-geographie-valise-b',
  'sheet12-r3c4': 'prop-geographie-dolmen',
};

fs.mkdirSync(DEST, { recursive: true });
const files = fs.readdirSync(SRC).filter((f) => f.endsWith('.png'));
let copied = 0;
const missing = [];
for (const f of files) {
  const key = path.basename(f, '.png');
  const name = MAP[key];
  if (!name) { missing.push(key); continue; }
  fs.copyFileSync(path.join(SRC, f), path.join(DEST, name + '.png'));
  copied++;
}
console.log(`${copied} assets copies vers ${DEST}`);
if (missing.length) console.log('Non mappes :', missing.join(', '));
const unmapped = Object.keys(MAP).filter((k) => !files.includes(k + '.png'));
if (unmapped.length) console.log('Mappes sans fichier :', unmapped.join(', '));
