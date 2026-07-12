// Renomme les 52 événements intégrés (thème spatial). Remplace UNIQUEMENT le champ
// `name: '...'` (pas name_en ni les descriptions). Chaque cible doit être trouvée
// exactement une fois, sinon on abandonne (sécurité). Usage : node scripts/rename-events.mjs
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FILE = path.resolve(__dirname, '../src/data/events.js');

// [ancien, nouveau] — chaînes telles qu'écrites dans le fichier (apostrophes échappées).
const PAIRS = [
  ['Rejouer', 'Relance orbitale'],
  ['Decharge electrique', 'Surcharge ionique'],
  ['Sacrifice', 'Manœuvre risquée'],
  ['Coup de pouce', 'Propulseur de secours'],
  ['Teleporteur', 'Saut hyperspatial'],
  ['Recharge', 'Recharge de noyau'],
  ['Vol', "Siphon d\\'énergie"],
  ['Echange', 'Permutation quantique'],
  ['Question bonus', 'Défi cosmique'],
  ['Tresor cache', "Cache d\\'astéroïde"],
  ['Marche noir', 'Marché orbital clandestin'],
  ['Vol de pieces', 'Piratage de crédits'],
  ['Banquier', 'Banque stellaire'],
  ['Coffre au tresor', 'Capsule au trésor'],
  ['Marchand ambulant', 'Marchand interstellaire'],
  ['Pillage', 'Raid de cargo'],
  ['Les trois coffres', 'Les trois capsules'],
  ['Benediction', 'Aura solaire'],
  ['Poseur de pieges', 'Poseur de mines orbitales'],
  ['La Forge', 'Atelier orbital'],
  ['Le Reliquaire', 'Relique stellaire'],
  ["L\\'Herboriste", 'Botaniste spatial'],
  ['Le Chaudron abandonné', 'Réacteur abandonné'],
  ["Pluie d\\'essences", "Pluie d\\'essences stellaires"],
  ['Eurêka !', 'Signal Eurêka !'],
  ['Le Scribe ambulant', 'Archiviste itinérant'],
  ['Rune mystérieuse', 'Glyphe astral'],
  ['Encre runique', 'Encre cosmique'],
  ['Subvention du scribe', "Bourse de l\\'Archiviste"],
  ['Recul force', 'Poussée inverse'],
  ["Trou de l\\'oubli", "Trou noir de l\\'oubli"],
  ['Tempete', 'Tempête cosmique'],
  ['Taxe commune', 'Taxe galactique'],
  ['Malediction', 'Anomalie maudite'],
  ['Tempete magnetique', 'Orage magnétique'],
  ['Explosion du chaudron', 'Explosion du synthétiseur'],
  ['Duel-question', 'Duel de transmission'],
  ['Pari', 'Pari orbital'],
  ['Le Va-tout', 'Va-tout stellaire'],
  ['Le Sphinx', 'Oracle galactique'],
  ['Tournoi eclair', 'Tournoi photonique'],
  ['Don de cases', 'Poussée offerte'],
  ['Embuscade', 'Interception pirate'],
  ['Impot royal', 'Tribut impérial'],
  ['Pickpocket !', 'Larcin orbital'],
  ['Boussole cassee', 'Navigation brouillée'],
  ['Hacking', 'Intrusion système'],
  ['Effacement', 'Effacement astral'],
  ['Quitte ou double', 'Orbite ou chute'],
  ['Jackpot', 'Pactole stellaire'],
  ['Loterie', 'Loterie cosmique'],
  ['Troc du destin', 'Troc quantique'],
];

let src = fs.readFileSync(FILE, 'utf8');
const errors = [];
for (const [oldN, newN] of PAIRS) {
  const target = `name: '${oldN}'`;
  const repl = `name: '${newN}'`;
  const count = src.split(target).length - 1;
  if (count !== 1) { errors.push(`«${oldN}» trouvé ${count}× (attendu 1)`); continue; }
  src = src.replace(target, repl);
}
if (errors.length) { console.error('ÉCHEC :\n' + errors.join('\n')); process.exit(1); }
fs.writeFileSync(FILE, src, 'utf8');
console.log(`${PAIRS.length} événements renommés.`);
