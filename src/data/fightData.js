// Donnees des mini-jeux de combat

// --- Chasse aux verbes (anglais) ---
// Verbes irreguliers courants au college (base verbale affichee)
export const IRREGULAR_VERBS = [
  'be', 'become', 'begin', 'break', 'bring', 'build', 'buy', 'catch',
  'choose', 'come', 'cut', 'do', 'drink', 'drive', 'eat', 'fall',
  'feel', 'fight', 'find', 'fly', 'forget', 'get', 'give', 'go',
  'have', 'hear', 'keep', 'know', 'leave', 'lose', 'make', 'meet',
  'pay', 'put', 'read', 'ride', 'run', 'say', 'see', 'sell',
  'send', 'sing', 'sit', 'sleep', 'speak', 'stand', 'steal', 'swim',
  'take', 'teach', 'tell', 'think', 'throw', 'understand', 'wear', 'win', 'write',
];

// Verbes reguliers (preterit en -ed, sans variante irreguliere)
export const REGULAR_VERBS = [
  'answer', 'arrive', 'ask', 'call', 'clean', 'climb', 'close', 'cook',
  'cry', 'dance', 'enjoy', 'finish', 'help', 'jump', 'like', 'listen',
  'live', 'look', 'love', 'need', 'open', 'paint', 'play', 'smile',
  'start', 'stay', 'study', 'talk', 'try', 'use', 'visit', 'wait',
  'walk', 'want', 'wash', 'watch', 'work',
];

// --- Le Grand Tri (SVT) ---
// Defis de categorisation : toucher tous les elements de la categorie
// demandee parmi des intrus. good = a toucher, bad = intrus.
export const SVT_CHALLENGES = [
  {
    id: 'vertebres',
    prompt: 'Touche tous les VERTÉBRÉS !', prompt_en: 'Tap all the VERTEBRATES!',
    good: ['chien', 'aigle', 'truite', 'grenouille', 'vipère', 'requin', 'tortue', 'cheval', 'pigeon', 'lézard'],
    bad: ['fourmi', 'escargot', 'méduse', 'araignée', 'pieuvre', 'crabe', 'papillon', 'ver de terre', 'moustique', 'étoile de mer', 'criquet', 'abeille'],
  },
  {
    id: 'ovipares',
    prompt: 'Touche les animaux OVIPARES (qui pondent des œufs) !', prompt_en: 'Tap the OVIPAROUS animals (that lay eggs)!',
    good: ['poule', 'tortue', 'crocodile', 'saumon', 'grenouille', 'autruche', 'couleuvre', 'papillon'],
    bad: ['chien', 'vache', 'baleine', 'chauve-souris', 'lion', 'dauphin', 'cheval', 'lapin', 'éléphant', 'chat'],
  },
  {
    id: 'mammiferes',
    prompt: 'Touche tous les MAMMIFÈRES !', prompt_en: 'Tap all the MAMMALS!',
    good: ['baleine', 'chauve-souris', 'dauphin', 'être humain', 'lion', 'souris', 'vache', 'kangourou'],
    bad: ['requin', 'manchot', 'crocodile', 'autruche', 'thon', 'grenouille', 'abeille', 'tortue', 'perroquet', 'truite'],
  },
  {
    id: 'digestif',
    prompt: "Touche les organes de l'appareil DIGESTIF !", prompt_en: 'Tap the organs of the DIGESTIVE system!',
    good: ['estomac', 'œsophage', 'intestin grêle', 'gros intestin', 'foie', 'pancréas', 'glandes salivaires', 'bouche'],
    bad: ['cœur', 'poumon', 'rein', 'vessie', 'cerveau', 'trachée', 'artère', 'diaphragme'],
  },
  {
    id: 'squelette',
    prompt: 'Touche les OS du squelette !', prompt_en: 'Tap the BONES of the skeleton!',
    good: ['fémur', 'tibia', 'humérus', 'radius', 'crâne', 'vertèbre', 'bassin', 'cubitus'],
    bad: ['biceps', 'quadriceps', 'cœur', 'foie', 'triceps', 'tendon', 'estomac', 'poumon'],
  },
  {
    id: 'renouvelables',
    prompt: "Touche les sources d'énergie RENOUVELABLES !", prompt_en: 'Tap the RENEWABLE energy sources!',
    good: ['solaire', 'éolienne', 'hydraulique', 'géothermie', 'biomasse', 'marémotrice'],
    bad: ['pétrole', 'charbon', 'gaz naturel', 'uranium', 'essence', 'fioul', 'kérosène', 'butane'],
  },
];

// ════════════════════════════════════════════════════════════════════════════
// CONTENU DE THÈMES SUPPLÉMENTAIRES — démontre la réutilisation des moteurs
// existants (timeline, bubble) pour des thèmes arbitraires, SANS nouveau code.
// ════════════════════════════════════════════════════════════════════════════

// --- Films (moteur `timeline`) : replacer par année de sortie ---
export const MOVIE_EVENTS = [
  { name: 'Les Temps modernes', year: 1936 },
  { name: 'Le Magicien d\'Oz', year: 1939 },
  { name: 'Les 400 coups', year: 1959 },
  { name: 'La Grande Vadrouille', year: 1966 },
  { name: '2001, l\'Odyssée de l\'espace', year: 1968 },
  { name: 'Le Parrain', year: 1972 },
  { name: 'Les Dents de la mer', year: 1975 },
  { name: 'Star Wars', year: 1977 },
  { name: 'E.T. l\'extra-terrestre', year: 1982 },
  { name: 'Retour vers le futur', year: 1985 },
  { name: 'Le Roi Lion', year: 1994 },
  { name: 'Titanic', year: 1997 },
  { name: 'Le Seigneur des Anneaux', year: 2001 },
  { name: 'Avatar', year: 2009 },
  { name: 'Intouchables', year: 2011 },
  { name: 'La Reine des neiges', year: 2013 },
  { name: 'Interstellar', year: 2014 },
  { name: 'Avengers: Endgame', year: 2019 },
  { name: 'Spider-Man: No Way Home', year: 2021 },
  { name: 'Barbie', year: 2023 },
];

// --- Jeux vidéo (moteur `bubble`) : « clique tous les RPG » ---
export const RPG_CHALLENGE = {
  id: 'jeux-rpg',
  prompt: 'Touche tous les jeux de RÔLE (RPG) !', prompt_en: 'Tap all the ROLE-PLAYING games (RPG)!',
  good: ['Final Fantasy', 'The Witcher 3', 'Skyrim', 'Pokémon', 'Elden Ring', 'Dragon Quest', "Baldur's Gate 3", 'Persona 5', 'Mass Effect', 'Diablo', 'Dark Souls', 'Kingdom Hearts', 'Chrono Trigger', 'Fallout'],
  bad: ['FIFA', 'Call of Duty', 'Minecraft', 'Fortnite', 'Tetris', 'Mario Kart', 'Counter-Strike', 'Among Us', 'Rocket League', 'Street Fighter', 'Pac-Man', 'Overwatch', 'Just Dance', 'Angry Birds'],
};

// --- Timeline (histoire) ---
// Evenements dates du programme college, a replacer dans l'ordre
export const TIMELINE_EVENTS = [
  { name: 'Bataille d\'Alésia', year: -52 },
  { name: 'Chute de l\'Empire romain d\'Occident', year: 476 },
  { name: 'Couronnement de Charlemagne', year: 800 },
  { name: 'Première croisade', year: 1096 },
  { name: 'Bataille de Bouvines', year: 1214 },
  { name: 'Prise de Constantinople par les Ottomans', year: 1453 },
  { name: 'Christophe Colomb arrive en Amérique', year: 1492 },
  { name: 'Les 95 thèses de Luther', year: 1517 },
  { name: 'Édit de Nantes', year: 1598 },
  { name: 'Début du règne personnel de Louis XIV', year: 1661 },
  { name: 'Premier volume de l\'Encyclopédie', year: 1751 },
  { name: 'Prise de la Bastille', year: 1789 },
  { name: 'Proclamation de la Première République', year: 1792 },
  { name: 'Sacre de Napoléon Ier', year: 1804 },
  { name: 'Bataille de Waterloo', year: 1815 },
  { name: 'Abolition de l\'esclavage en France', year: 1848 },
  { name: 'Commune de Paris', year: 1871 },
  { name: 'Lois Jules Ferry sur l\'école', year: 1882 },
  { name: 'Séparation des Églises et de l\'État', year: 1905 },
  { name: 'Début de la Première Guerre mondiale', year: 1914 },
  { name: 'Révolution russe', year: 1917 },
  { name: 'Krach boursier de Wall Street', year: 1929 },
  { name: 'Front populaire en France', year: 1936 },
  { name: 'Début de la Seconde Guerre mondiale', year: 1939 },
  { name: 'Débarquement de Normandie', year: 1944 },
  { name: 'Bombe atomique sur Hiroshima', year: 1945 },
  { name: 'Traité de Rome (CEE)', year: 1957 },
  { name: 'Construction du mur de Berlin', year: 1961 },
  { name: 'Premiers pas sur la Lune', year: 1969 },
  { name: 'Chute du mur de Berlin', year: 1989 },
  { name: 'Mise en circulation de l\'euro', year: 2002 },
];

// --- Vocabulaire (moteur `memory`) : associer chaque mot anglais à sa traduction ---
// Forme générique `memory` : [{ a, b }] = deux faces liées d'une paire.
export const MEMORY_VOCAB = [
  { a: 'dog', b: 'chien' },
  { a: 'house', b: 'maison' },
  { a: 'water', b: 'eau' },
  { a: 'book', b: 'livre' },
  { a: 'tree', b: 'arbre' },
  { a: 'sun', b: 'soleil' },
  { a: 'school', b: 'école' },
  { a: 'friend', b: 'ami' },
  { a: 'cat', b: 'chat' },
  { a: 'bread', b: 'pain' },
  { a: 'horse', b: 'cheval' },
  { a: 'flower', b: 'fleur' },
  { a: 'night', b: 'nuit' },
  { a: 'king', b: 'roi' },
  { a: 'island', b: 'île' },
  { a: 'fire', b: 'feu' },
];

export function shuffle(arr) {
  const p = arr.slice();
  for (let i = p.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [p[i], p[j]] = [p[j], p[i]];
  }
  return p;
}
