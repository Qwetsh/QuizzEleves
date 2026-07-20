// Mapping capacité Pokémon → ARCHÉTYPE d'animation d'attaque (couche
// présentation UNIQUEMENT — le moteur pur logic/pokemonBattle.js ne bouge pas).
// Chaque archétype est une vraie animation directionnelle rendue par PkmnStage
// (VfxLayer) : elle part du LANCEUR vers la CIBLE (ou joue sur soi).
//
// Archétypes :
//   wave        vague d'eau qui déferle du lanceur sur la cible (Surf…)
//   beam        rayon continu d'orbes lumineuses lanceur → cible (Laser Glace…)
//   projectile  projectile(s) en arc (dards, feuilles, bulles, œufs…)
//   flames      boule de feu puis flammes qui montent sur la cible
//   bolt        éclair qui tombe du ciel sur la cible + flash
//   quake       débris + poussière au sol, grosse secousse de l'arène
//   slash       balafres tranchantes sur la cible (le lanceur charge)
//   charge      ruée physique + étoile d'impact (le lanceur charge)
//   spores      nuage de spores/poison qui dérive du lanceur vers la cible
//   psy         anneaux psychiques concentriques sur la cible
//   drain       orbes vertes aspirées de la cible VERS le lanceur
//   buff        aura montante + anneau sur SOI (danses, armures, hâte…)
//   debuff      chevrons descendants + assombrissement sur la cible
//   notes       notes de musique qui flottent vers la cible (berceuses)
//
// Résolution : id de capacité connu → archétype dédié ; sinon repli par
// type + catégorie (attaque / statut).

import MONS from '../data/pokemonBattle.json';

// Capacités connues, par id (toutes celles du JSON sont couvertes ici — le
// repli ne sert que pour de futurs ajouts de données).
const BY_ID = {
  // Eau / glace
  surf: 'wave', withdraw: 'buff', 'bubble-beam': 'projectile', 'ice-beam': 'beam',
  // Électrique
  thunderbolt: 'bolt', 'thunder-wave': 'bolt',
  // Feu
  'fire-blast': 'flames', 'fire-punch': 'charge',
  // Plante / insecte
  'razor-leaf': 'projectile', 'mega-drain': 'drain', 'leech-life': 'drain',
  'sleep-powder': 'spores', spore: 'spores', 'stun-spore': 'spores',
  'string-shot': 'debuff', twineedle: 'projectile',
  // Poison
  'poison-sting': 'projectile', sludge: 'projectile', acid: 'projectile', toxic: 'spores',
  'acid-armor': 'buff',
  // Sol / roche
  earthquake: 'quake',
  // Psy / spectre
  psychic: 'psy', hypnosis: 'psy', lick: 'charge',
  agility: 'buff', amnesia: 'buff', barrier: 'buff', meditate: 'buff',
  // Combat / normal — contact
  'karate-chop': 'charge', 'rolling-kick': 'charge', 'mega-kick': 'charge',
  tackle: 'charge', 'body-slam': 'charge', slam: 'charge', strength: 'charge',
  bite: 'charge', peck: 'charge', 'drill-peck': 'charge',
  // Tranchant
  cut: 'slash', slash: 'slash', 'wing-attack': 'slash',
  // Projectiles normaux
  swift: 'projectile', 'egg-bomb': 'projectile', 'tri-attack': 'beam',
  // Statuts normaux
  'swords-dance': 'buff', harden: 'buff', 'defense-curl': 'buff',
  growl: 'debuff', leer: 'debuff', 'tail-whip': 'debuff', screech: 'debuff', glare: 'debuff',
  sing: 'notes', 'lovely-kiss': 'notes',
};

// Repli des capacités OFFENSIVES (power > 0) par type.
const FALLBACK_ATK = {
  water: 'wave', ice: 'beam', electric: 'bolt', fire: 'flames',
  ground: 'quake', rock: 'quake', grass: 'projectile', bug: 'projectile',
  poison: 'projectile', psychic: 'psy', ghost: 'psy', dragon: 'beam',
  flying: 'slash', fighting: 'charge', normal: 'charge',
};

function computeArchetype(mv) {
  if (BY_ID[mv.id]) return BY_ID[mv.id];
  if (mv.power > 0) return FALLBACK_ATK[mv.type] || 'charge';
  const eff = (mv.effects || [])[0];
  if (eff?.kind === 'boost' && eff.target === 'self') return 'buff';
  if (eff?.kind === 'ailment') return eff.ailment === 'slp' ? 'notes' : 'spores';
  return 'debuff';
}

// Les événements du moteur ne portent que le NOM FR de la capacité (+ type) —
// on indexe donc par nom FR, construit une fois depuis les données.
const BY_FR = {};
for (const m of MONS) {
  for (const mv of m.moves) {
    if (!BY_FR[mv.fr]) BY_FR[mv.fr] = computeArchetype(mv);
  }
}

export function archetypeForMove(frName, type) {
  return BY_FR[frName] || FALLBACK_ATK[type] || 'charge';
}

// Archétypes joués sur le LANCEUR (la « cible » visuelle est soi-même).
export const SELF_ARCHETYPES = new Set(['buff']);
// Archétypes de contact : le lanceur garde sa ruée (lunge) ; les autres font
// une pulsation d'incantation (cast) — un Pokémon qui tire un rayon ne fonce pas.
export const CONTACT_ARCHETYPES = new Set(['charge', 'slash']);
