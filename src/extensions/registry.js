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
    icon: '🎒',
    desc: 'Équipement porté, consommables, sac, boutique & Marché Noir, coffres, butin, sets et événements liés aux objets. Désactivé : partie « pure » sans économie d’objets.',
    default: true,
  },
  {
    id: 'mastery',
    name: 'Maîtrise des pouvoirs',
    icon: '⚡',
    desc: 'Pouvoirs améliorables jusqu’au niveau 10, avec un embranchement stratégique (3 voies) aux niveaux 5 et 10. Désactivé : pouvoirs classiques à 3 niveaux.',
    default: true,
  },
  {
    id: 'trade',
    name: 'Troc entre équipes',
    icon: '🤝',
    desc: 'Les équipes proposent des échanges depuis leur téléphone (objets, or, équipement). Nécessite le mode téléphone et l’extension Objets pour échanger des objets.',
    default: true,
    needsItems: true,
  },
  {
    id: 'alchemy',
    name: 'Alchimie',
    icon: '⚗️',
    desc: 'Ingrédients à combiner par 3 pour distiller des potions (recettes à découvrir). Atelier et grimoire sur le téléphone. Désactivée : pas d’ingrédients ni de potions.',
    default: false,
    needsItems: true,
  },
  {
    id: 'enchant',
    name: 'Enchantement',
    icon: '📜',
    desc: 'Parchemins à appliquer sur une pièce d’équipement pour l’enchanter pendant la partie (l’effet suit l’objet). Désactivée : pas de parchemins.',
    default: false,
    needsItems: true,
  },
];

// État par défaut : { equipment: true, ... }
export const defaultExtensions = () =>
  Object.fromEntries(EXTENSIONS.map((e) => [e.id, e.default !== false]));

// Une extension est active si explicitement true OU absente (compat des saves
// antérieures au système : tout activé = comportement historique).
export const extOn = (extensions, id) => extensions == null || extensions[id] !== false;
