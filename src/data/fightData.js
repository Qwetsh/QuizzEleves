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

export function shuffle(arr) {
  const p = arr.slice();
  for (let i = p.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [p[i], p[j]] = [p[j], p[i]];
  }
  return p;
}
