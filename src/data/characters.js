// Personnages jouables (pixel-art, univers espace). Chaque personnage se compose
// de deux calques alignés générés par scripts/space-characters.mjs :
//   <id>.png        — le corps détouré (couleurs d'origine)
//   <id>-scarf.png  — l'écharpe seule, en gris clair ombré, recolorée à la
//                     couleur d'équipe au rendu (filtre SVG multiply).
// Utilisé comme pion sur le plateau et comme avatar au choix d'équipe.

const URLS = import.meta.glob('../assets/characters/*.png', { eager: true, query: '?url', import: 'default' });
const asset = (name) => URLS[`../assets/characters/${name}.png`];

// `badge` = petit emoji thématique conservé pour les avatars miniatures
// (cartes d'équipe, HUD, journal) où un sprite serait illisible.
const DEFS = [
  // Planche 1 — humains & créatures de l'espace
  { id: 'aviatrice', name: 'Aviatrice', nameEn: 'Aviator', badge: '\u{1F9D1}‍✈️' },
  { id: 'gameur', name: 'Gameur', nameEn: 'Gamer', badge: '\u{1F3AE}' },
  { id: 'robot', name: 'Robot', nameEn: 'Robot', badge: '\u{1F916}' },
  { id: 'drone', name: 'Drone', nameEn: 'Drone', badge: '\u{1F6F8}' },
  { id: 'alien', name: 'Petit-gris', nameEn: 'Grey Alien', badge: '\u{1F47D}' },
  { id: 'mecano', name: 'Mécano', nameEn: 'Mechanic', badge: '\u{1F527}' },
  { id: 'pilote', name: 'Pilote', nameEn: 'Pilot', badge: '\u{1F680}' },
  { id: 'martien', name: 'Martien', nameEn: 'Martian', badge: '\u{1F47E}' },
  { id: 'singe', name: 'Astro-singe', nameEn: 'Space Monkey', badge: '\u{1F435}' },
  { id: 'dragon', name: 'Dragon', nameEn: 'Dragon', badge: '\u{1F409}' },
  // Planche 2 — baroudeurs & aventuriers
  { id: 'baroudeuse', name: 'Baroudeuse', nameEn: 'Adventurer', badge: '\u{1F97D}' },
  { id: 'streamer', name: 'Streamer', nameEn: 'Streamer', badge: '\u{1F3A7}' },
  { id: 'mercenaire', name: 'Mercenaire', nameEn: 'Mercenary', badge: '\u{1F5E1}️' },
  { id: 'exploratrice', name: 'Exploratrice', nameEn: 'Explorer', badge: '\u{1F9ED}' },
  { id: 'cosmonaute', name: 'Cosmonaute', nameEn: 'Cosmonaut', badge: '\u{1F9D1}‍\u{1F680}' },
  { id: 'lezard', name: 'Homme-lézard', nameEn: 'Lizardman', badge: '\u{1F98E}' },
  { id: 'mystique', name: 'Mystique', nameEn: 'Mystic', badge: '\u{1F9D9}' },
  { id: 'capitaine', name: 'Capitaine', nameEn: 'Captain', badge: '\u{1F9D4}' },
  { id: 'lapin', name: 'Lapin', nameEn: 'Rabbit', badge: '\u{1F430}' },
  { id: 'felin', name: 'Félin', nameEn: 'Feline', badge: '\u{1F431}' },
  // Planche 3 — animaux anthropomorphes
  { id: 'renard', name: 'Renard', nameEn: 'Fox', badge: '\u{1F98A}' },
  { id: 'loup', name: 'Loup', nameEn: 'Wolf', badge: '\u{1F43A}' },
  { id: 'ours', name: 'Ours', nameEn: 'Bear', badge: '\u{1F43B}' },
  { id: 'lievre', name: 'Lièvre', nameEn: 'Hare', badge: '\u{1F407}' },
  { id: 'panda', name: 'Panda', nameEn: 'Panda', badge: '\u{1F43C}' },
  { id: 'aigle', name: 'Aigle', nameEn: 'Eagle', badge: '\u{1F985}' },
  { id: 'dragonnet', name: 'Dragonnet', nameEn: 'Drakeling', badge: '\u{1F432}' },
  { id: 'cerf', name: 'Cerf', nameEn: 'Stag', badge: '\u{1F98C}' },
  { id: 'herisson', name: 'Hérisson', nameEn: 'Hedgehog', badge: '\u{1F994}' },
  { id: 'tigre', name: 'Tigre', nameEn: 'Tiger', badge: '\u{1F42F}' },
];

export const CHARACTERS = DEFS.map((c) => ({
  ...c,
  body: asset(c.id),
  scarf: asset(`${c.id}-scarf`),
}));

export const CHARACTERS_BY_ID = Object.fromEntries(CHARACTERS.map((c) => [c.id, c]));

// Personnage par défaut de chaque équipe (index) — un spread lisible.
export const TEAM_DEFAULT_CHARACTERS = ['aviatrice', 'gameur', 'robot', 'drone', 'alien', 'mecano'];

export function characterById(id) {
  return (id && CHARACTERS_BY_ID[id]) || null;
}

export function defaultCharacterFor(i) {
  return TEAM_DEFAULT_CHARACTERS[i] || CHARACTERS[i % CHARACTERS.length].id;
}
