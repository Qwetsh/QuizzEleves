// ============================================================
//  Registre des EXTENSIONS (modules activables/désactivables)
//
//  Principe : une extension est un pan de jeu qu'on peut couper AVANT une
//  partie (choisi au Setup, puis VERROUILLÉ en cours de jeu — voir décision
//  produit). On ne sème pas de `if` partout : on coupe seulement les coutures
//  d'OCTROI (ce qui met du contenu dans une équipe) et les coutures d'UI
//  (montage de panneaux). Les lectures du moteur (getEffectValue, triggersOf…)
//  sont déjà neutres quand une équipe est « vide », donc rien à toucher côté
//  lecture.
//
//  Pour ajouter une extension : une entrée ici. Pour qu'un CONTENU dépende
//  d'une extension (événement, récompense…), il déclare sa dépendance dans ses
//  propres données (ex. `needsItems: true` sur un événement) et le sélecteur
//  filtre — modèle « déclaration de dépendance » plutôt que conditions
//  éparpillées.
// ============================================================

export const EXTENSIONS = [
  {
    id: 'equipment',
    name: 'Équipement & objets',
    short: 'Objets',
    icon: '🎒',
    desc: 'Équipement porté, consommables, sac, boutique & Marché Noir, coffres, butin, sets et événements liés aux objets. Désactivé : partie « pure » sans économie d’objets.',
    default: true,
  },
  {
    id: 'mastery',
    name: 'Maîtrise des pouvoirs',
    short: 'Maîtrise',
    icon: '⚡',
    desc: 'Pouvoirs améliorables jusqu’au niveau 10, avec un embranchement stratégique (3 voies) aux niveaux 5 et 10. Désactivé : pouvoirs classiques à 3 niveaux.',
    default: true,
  },
  {
    id: 'trade',
    name: 'Troc entre équipes',
    short: 'Troc',
    icon: '🤝',
    desc: 'Les équipes proposent des échanges depuis leur téléphone (objets, or, équipement). Nécessite le mode téléphone et l’extension Objets pour échanger des objets.',
    default: true,
    requires: ['equipment'],
  },
  {
    id: 'diplomacy',
    name: 'Complots & pactes',
    short: 'Complots',
    icon: '🐍',
    desc: 'Les équipes échangent en SECRET depuis leur téléphone : extorsion, cadeau de paix, pacte de non-agression mutuel, ou deal libre. Une promesse est brisable — trahir un pacte se paie au grand jour. Vit dans l’onglet Troc : nécessite l’extension Troc et le mode téléphone.',
    default: false,
    requires: ['trade'],
  },
  {
    id: 'alchemy',
    name: 'Alchimie',
    short: 'Alchimie',
    icon: '⚗️',
    desc: 'Ingrédients à combiner par 3 pour distiller des potions (recettes à découvrir). Atelier et grimoire sur le téléphone. Désactivée : pas d’ingrédients ni de potions.',
    default: false,
    requires: ['equipment'],
  },
  {
    id: 'enchant',
    name: 'Enchantement',
    short: 'Enchant.',
    icon: '📜',
    desc: 'Parchemins à appliquer sur une pièce d’équipement pour l’enchanter pendant la partie (l’effet suit l’objet). Désactivée : pas de parchemins.',
    default: false,
    requires: ['equipment'],
  },
  {
    id: 'forge',
    name: 'Forge de dés',
    short: 'Forge',
    icon: '🎲',
    desc: 'Chaque équipe personnalise les 6 faces de son dé (valeur de déplacement et/ou effet) : un 3ᵉ onglet « Faces » en boutique et un atelier de forge sur le téléphone. Désactivée : dé standard 1→6 pour tous.',
    default: false,
  },
  {
    id: 'weather',
    name: 'Événements de terrain (météo)',
    short: 'Météo',
    icon: '🌦️',
    desc: 'Tous les 3 à 5 tours, une météo globale s’abat sur tout le plateau : vent qui accélère ou freine, soleil qui recharge les pouvoirs, orage, séisme, pluies… Un moment collectif et spectaculaire, annoncé à l’avance pour les météos punitives. Désactivée : aucune météo.',
    default: false,
  },
  {
    id: 'magic',
    name: 'Magie',
    short: 'Magie',
    icon: '✨',
    desc: 'Chaque équipe a une barre de magie qui se recharge en temps réel (magie par minute). On lance un sort en traçant une séquence de runes au doigt sur la table des sorts (téléphone ou tableau) ; les runes et sorts connus s’archivent dans un codex, les autres se gagnent en jouant… ou se découvrent en expérimentant. Désactivée : pas de magie.',
    default: false,
  },
  {
    id: 'metier',
    name: 'Métiers',
    short: 'Métiers',
    icon: '⚒️',
    desc: 'Au 1ᵉʳ tour, juste après le coffre de bienvenue, chaque équipe choisit UN métier — 🔨 Forgeron, ⚗️ Alchimiste ou ✒️ Enchanteur — et s’y tient toute la partie. Chacune ne peut alors pratiquer QUE son artisanat : la spécialisation réduit la puissance de chacun et donne tout son sens au troc. Désactivée : les 3 artisanats restent ouverts à toutes les équipes. Nécessite les extensions Forge, Alchimie et Enchantement.',
    default: false,
    requires: ['forge', 'alchemy', 'enchant'],
  },
];

// Index id → extension (lookups dépendances/affichage).
export const EXT_BY_ID = Object.fromEntries(EXTENSIONS.map((e) => [e.id, e]));

// Dépendances DIRECTES déclarées par une extension (ids requis).
export const requiresOf = (id) => EXT_BY_ID[id]?.requires || [];

// Extensions qui dépendent DIRECTEMENT de `id` (relation inverse).
export const dependentsOf = (id) =>
  EXTENSIONS.filter((e) => (e.requires || []).includes(id)).map((e) => e.id);

// Applique le passage de `id` à l'état `on` en propageant les dépendances :
//   • activer  → active toutes ses dépendances (transitivement) ;
//   • désactiver → désactive tous ses dépendants (transitivement).
// Garantit qu'une extension active n'a jamais une dépendance coupée.
export function applyExtensionToggle(extensions, id, on) {
  const next = { ...extensions, [id]: on };
  const seen = new Set();
  const stack = [id];
  while (stack.length) {
    const cur = stack.pop();
    const linked = on ? requiresOf(cur) : dependentsOf(cur);
    for (const other of linked) {
      if (!seen.has(other)) {
        seen.add(other);
        next[other] = on;
        stack.push(other);
      }
    }
  }
  return next;
}

// État par défaut : { equipment: true, ... }
export const defaultExtensions = () =>
  Object.fromEntries(EXTENSIONS.map((e) => [e.id, e.default !== false]));

// Une extension est active si explicitement true OU absente (compat des saves
// antérieures au système : tout activé = comportement historique).
export const extOn = (extensions, id) => extensions == null || extensions[id] !== false;
