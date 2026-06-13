// Copie les découpes d'équipement (art/item-sheets/cut) vers src/assets/items/
// nommées par CLÉ d'objet (items.js). Mapping vérifié visuellement via les
// planches-contact (art/item-sheets/contact-*.png) le 2026-06-13.
import fs from 'node:fs';
import path from 'node:path';

const SRC = 'art/item-sheets/cut';
const DEST = 'src/assets/items';

// clé d'objet (items.js) -> crop source
const MAP = {
  // --- Coiffes (slot head) ---
  chapeauPaille:    'coiffe-a-r1c1', // casque d'explorateur (chapeau de soleil)
  plumeScribe:      'coiffe-b-r3c4', // tricorne à plume
  lunettesLecture:  'coiffe-a-r2c4', // lunettes d'aviateur
  bandeauSage:      'coiffe-a-r2c3', // coiffe de feuilles
  monocleDetective: 'coiffe-b-r3c2', // lunettes de cuir
  couronneSavant:   'coiffe-a-r1c4', // couronne de laurier

  // --- Armures (slot body) ---
  bourseCuir:       'armure-a-r1c2', // brigandine de cuir
  amuletteFisc:     'armure-a-r1c1', // plastron de bronze
  fanionSupporter:  'armure-a-r2c4', // cuirasse à écharpe bleue
  banniereMarchand: 'armure-a-r2c2', // cotte d'écailles turquoise
  talismanOr:       'armure-a-r1c3', // robe pourpre ornée
  capeOmbre:        'armure-b-r3c1', // manteau sombre à fourrure
  armureGarde:      'armure-a-r2c1', // armure ailée dorée
  etendardRoyal:    'armure-a-r3c3', // cuirasse au soleil d'or

  // --- Amulettes (slot feet, rethématisé) ---
  bottesUsees:     'amulette-b-r1c1', // pendentif émeraude
  ancreMarine:     'amulette-b-r2c3', // conque nacrée
  bottesMontagne:  'amulette-a-r1c3', // boussole
  grappinVoyageur: 'amulette-c-r1c3', // médaillon arbre de vie
  eperonsDuel:     'amulette-c-r1c1', // talisman du dragon
  pegase:          'amulette-a-r3c1', // orbe céleste lune/étoile
};

fs.mkdirSync(DEST, { recursive: true });
let copied = 0;
const missing = [];
for (const [key, crop] of Object.entries(MAP)) {
  const src = path.join(SRC, crop + '.png');
  if (!fs.existsSync(src)) { missing.push(`${key} -> ${crop}`); continue; }
  fs.copyFileSync(src, path.join(DEST, key + '.png'));
  copied++;
}
console.log(`${copied} visuels d'équipement copiés vers ${DEST}`);
if (missing.length) console.log('Crops manquants :', missing.join(', '));
