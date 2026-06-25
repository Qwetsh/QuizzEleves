// Catalogue d'effets + distributeur ÉQUILIBRÉ pour les potions (rééquilibrage
// 2026-06). Objectif : utiliser ~30 types d'effets (quasi tout l'éditeur, hors
// effets liés à une question active — potions utilisables SUR LA CARTE seulement)
// avec une distribution maîtrisée. La cohérence ingrédient→potion n'est PAS
// recherchée (choix validé) : on vise une répartition cible.
//
// Chaque entrée : { key, cat:'self'|'foe', weight, flavor:{word,word_en,icon},
//   art:[codes de fiole], build(rng, rarity) -> action(s) }.
// `build` renvoie une action OU un objet { roll:true, table } pour le gamble.

// — Aides de magnitude —
const ri = (rng, lo, hi) => lo + Math.floor(rng() * (hi - lo + 1));
// Plage par rareté : [commun, rare, légendaire] chacune [lo,hi].
const byRar = (rng, rarity, c, r, l) => { const [lo, hi] = rarity === 'legendaire' ? l : rarity === 'rare' ? r : c; return ri(rng, lo, hi); };
// Montant « varié » : la plupart du temps une valeur fixe, parfois une valeur À
// L'ÉCHELLE (série/précision) pour casser l'uniformité (feature inutilisée avant).
function variedAmount(rng, rarity, c, r, l) {
  const flat = byRar(rng, rarity, c, r, l);
  const roll = rng();
  if (roll < 0.16) { // à l'échelle sur la série
    const base = Math.max(1, Math.round(flat * 0.4));
    const factor = Math.max(1, Math.round(flat * 0.5));
    return { per: 'streak', factor, base };
  }
  if (roll < 0.24) { // à l'échelle sur la précision (%)
    const base = Math.max(1, Math.round(flat * 0.3));
    const factor = Math.max(1, Math.round(flat / 12));
    return { per: 'precision', factor, base };
  }
  return flat;
}
const foeTarget = (rng) => { const r = rng(); return r < 0.5 ? 'allOthers' : r < 0.82 ? 'randomOpponent' : 'target'; };

// — Catalogue (30 types) ——————————————————————————————————————————————————————
export const CATALOG = [
  // ---- SELF : aides ----
  { key: 'moneyGain', cat: 'self', weight: 9, flavor: { word: "de l'Avare", word_en: 'of the Miser', icon: '🟡' }, art: ['r3c4', 'r3c1', 'r1c4', 'r1c1'],
    build: (rng, rar) => ({ action: 'money', mode: 'gain', target: 'self', n: variedAmount(rng, rar, [8, 14], [14, 24], [24, 42]), unit: 'flat' }) },
  { key: 'moveFwd', cat: 'self', weight: 6, flavor: { word: 'de la Ruée', word_en: 'of the Rush', icon: '🚀' }, art: ['r4c6', 'r1c6', 'r5c1', 'r3c2'],
    build: (rng, rar) => ({ action: 'move', target: 'self', dir: 'forward', n: byRar(rng, rar, [1, 2], [2, 3], [3, 4]) }) },
  { key: 'time', cat: 'self', weight: 7, flavor: { word: 'du Temps', word_en: 'of Time', icon: '⏳' }, art: ['r3c8', 'r5c7', 'r5c4', 'r3c2'],
    build: (rng, rar) => ({ action: 'extraTime', n: byRar(rng, rar, [5, 8], [8, 12], [12, 16]) }) },
  { key: 'shield', cat: 'self', weight: 7, flavor: { word: 'du Roc', word_en: 'of the Rock', icon: '🛡️' }, art: ['r1c5', 'r5c2', 'r1c4', 'r2c6'],
    build: (rng, rar) => ({ action: 'shieldNext', n: byRar(rng, rar, [1, 1], [2, 2], [2, 3]) }) },
  { key: 'charge', cat: 'self', weight: 6, flavor: { word: "de l'Arcane", word_en: 'of the Arcane', icon: '🔮' }, art: ['r2c1', 'r2c8', 'r3c5'],
    build: () => ({ action: 'gainCharge' }) },
  { key: 'loot', cat: 'self', weight: 6, flavor: { word: 'du Butin', word_en: 'of Loot', icon: '🎁' }, art: ['r3c4', 'r4c8', 'r4c7'],
    build: (rng) => ({ action: 'loot', category: rng() < 0.7 ? 'consumable' : 'equipment' }) },
  { key: 'teleport', cat: 'self', weight: 5, flavor: { word: 'du Mirage', word_en: 'of the Mirage', icon: '🌀' }, art: ['r4c7', 'r4c8', 'r4c3'],
    build: () => ({ action: 'teleportFurthest', target: 'self' }) },
  { key: 'fumigene', cat: 'self', weight: 5, flavor: { word: 'de la Brume', word_en: 'of the Mist', icon: '💨' }, art: ['r2c3', 'r3c7', 'r4c4'],
    build: (rng, rar) => ({ action: 'fumigene', turns: byRar(rng, rar, [1, 1], [1, 2], [2, 3]) }) },
  { key: 'buffDice', cat: 'self', weight: 6, flavor: { word: 'du Joueur', word_en: 'of the Gambler', icon: '🎲' }, art: ['r4c3', 'r1c6', 'r5c8', 'r3c3'],
    build: (rng, rar) => ({ action: 'buff', target: 'self', buff: { type: 'diceBonus', turns: byRar(rng, rar, [2, 2], [2, 3], [3, 4]), n: byRar(rng, rar, [1, 1], [1, 2], [2, 2]) } }) },
  { key: 'buffMoveDie', cat: 'self', weight: 5, flavor: { word: 'de la Cavalcade', word_en: 'of the Cavalcade', icon: '🐎' }, art: ['r4c6', 'r1c6', 'r5c1'],
    build: (rng, rar) => ({ action: 'buff', target: 'self', buff: { type: 'moveDieSides', turns: byRar(rng, rar, [2, 3], [3, 4], [3, 5]), n: rar === 'commun' ? 6 : 10 } }) },
  { key: 'buffNoRecul', cat: 'self', weight: 5, flavor: { word: 'de la Ténacité', word_en: 'of Tenacity', icon: '🧱' }, art: ['r1c5', 'r5c2', 'r2c6'],
    build: (rng, rar) => ({ action: 'buff', target: 'self', buff: { type: 'noRecul', turns: byRar(rng, rar, [1, 2], [2, 3], [3, 4]) } }) },
  { key: 'buffAdvance', cat: 'self', weight: 5, flavor: { word: 'du Marathon', word_en: 'of the Marathon', icon: '🏃' }, art: ['r1c6', 'r4c6', 'r5c4', 'r2c5'],
    build: (rng, rar) => ({ action: 'buff', target: 'self', buff: { type: 'advanceOnCorrect', turns: byRar(rng, rar, [1, 2], [2, 3], [2, 3]), n: byRar(rng, rar, [1, 1], [1, 2], [1, 2]) } }) },
  { key: 'buffTheme', cat: 'self', weight: 5, flavor: { word: 'du Savoir', word_en: 'of Knowledge', icon: '📚' }, art: ['r2c8', 'r3c5', 'r2c7'],
    build: (rng, rar) => ({ action: 'buff', target: 'self', buff: { type: 'themeBonus', turns: byRar(rng, rar, [2, 2], [2, 3], [3, 4]), n: byRar(rng, rar, [4, 6], [6, 9], [9, 12]) } }) },
  { key: 'buffDuelImmune', cat: 'self', weight: 4, flavor: { word: 'du Rempart', word_en: 'of the Bulwark', icon: '🏰' }, art: ['r5c2', 'r1c5', 'r2c6', 'r1c4'],
    build: (rng, rar) => ({ action: 'buff', target: 'self', buff: { type: 'duelImmune', turns: byRar(rng, rar, [1, 2], [2, 3], [3, 4]) } }) },
  { key: 'buffReflect', cat: 'self', weight: 5, flavor: { word: 'du Miroir', word_en: 'of the Mirror', icon: '🪞' }, art: ['r2c3', 'r2c4', 'r3c6'],
    build: (rng, rar) => ({ action: 'buff', target: 'self', buff: { type: 'reflectChance', turns: byRar(rng, rar, [1, 2], [2, 3], [3, 4]), n: byRar(rng, rar, [20, 30], [30, 45], [45, 60]) } }) },
  { key: 'buffGoldGuard', cat: 'self', weight: 4, flavor: { word: 'du Coffre', word_en: 'of the Vault', icon: '🔒' }, art: ['r1c4', 'r1c5', 'r3c4'],
    build: (rng, rar) => ({ action: 'buff', target: 'self', buff: { type: 'goldStealImmune', turns: byRar(rng, rar, [2, 3], [3, 4], [3, 5]) } }) },
  { key: 'buffItemGuard', cat: 'self', weight: 4, flavor: { word: 'du Gardien', word_en: 'of the Warden', icon: '🧿' }, art: ['r5c2', 'r2c8', 'r1c4'],
    build: (rng, rar) => ({ action: 'buff', target: 'self', buff: { type: 'itemStealImmune', turns: byRar(rng, rar, [2, 3], [3, 4], [3, 5]) } }) },

  // ---- FOE : sabotage ----
  { key: 'moneyLose', cat: 'foe', weight: 5, flavor: { word: 'du Larcin', word_en: 'of Larceny', icon: '🪙' }, art: ['r5c5', 'r1c3', 'r3c6'],
    build: (rng, rar) => ({ action: 'money', mode: 'lose', target: foeTarget(rng), n: byRar(rng, rar, [3, 6], [6, 12], [12, 20]), unit: 'flat' }) },
  { key: 'moneySteal', cat: 'foe', weight: 4, flavor: { word: 'du Pillage', word_en: 'of Plunder', icon: '🏴‍☠️' }, art: ['r5c5', 'r1c3', 'r3c6'],
    build: (rng, rar) => ({ action: 'money', mode: 'steal', target: rng() < 0.6 ? 'randomOpponent' : 'target', n: byRar(rng, rar, [4, 8], [8, 14], [14, 24]), unit: 'flat' }) },
  { key: 'moveBack', cat: 'foe', weight: 5, flavor: { word: 'du Faux Pas', word_en: 'of the Misstep', icon: '🥾' }, art: ['r4c4', 'r4c5', 'r1c8'],
    build: (rng, rar) => ({ action: 'move', target: foeTarget(rng), dir: 'back', n: byRar(rng, rar, [1, 1], [1, 2], [2, 3]) }) },
  { key: 'forceSubject', cat: 'foe', weight: 4, flavor: { word: 'du Défi', word_en: 'of the Challenge', icon: '💀' }, art: ['r1c3', 'r5c5', 'r2c8'],
    build: (rng) => ({ action: 'forceSubject', target: foeTarget(rng), subject: rng() < 0.5 ? 'hardcore' : 'cultureG' }) },
  { key: 'curseTimer', cat: 'foe', weight: 4, flavor: { word: 'de la Hâte', word_en: 'of Haste', icon: '⏱️' }, art: ['r1c8', 'r2c3', 'r3c2'],
    build: (rng) => ({ action: 'curseTimer', target: foeTarget(rng), divisor: 2 }) },
  { key: 'curseExtraQ', cat: 'foe', weight: 4, flavor: { word: "de l'Examen", word_en: 'of the Exam', icon: '❓' }, art: ['r2c8', 'r3c6', 'r1c3'],
    build: (rng, rar) => ({ action: 'curseExtraQuestion', target: foeTarget(rng), n: byRar(rng, rar, [1, 1], [1, 2], [2, 2]) }) },
  { key: 'randomPath', cat: 'foe', weight: 4, flavor: { word: "de l'Égarement", word_en: 'of Straying', icon: '🧭' }, art: ['r4c5', 'r4c3', 'r4c1'],
    build: (rng) => ({ action: 'randomPathNext', target: foeTarget(rng) }) },
  { key: 'blockPowers', cat: 'foe', weight: 4, flavor: { word: 'du Silence', word_en: 'of Silence', icon: '🤐' }, art: ['r5c5', 'r3c6', 'r1c3'],
    build: (rng, rar) => ({ action: 'blockPowers', target: foeTarget(rng), turns: byRar(rng, rar, [1, 1], [1, 2], [2, 2]) }) },
  { key: 'blockConsum', cat: 'foe', weight: 4, flavor: { word: 'du Bâillon', word_en: 'of the Gag', icon: '😶' }, art: ['r3c6', 'r1c3', 'r5c5'],
    build: (rng, rar) => ({ action: 'blockConsumables', target: foeTarget(rng), turns: byRar(rng, rar, [1, 1], [1, 2], [2, 2]) }) },
  { key: 'loseItem', cat: 'foe', weight: 4, flavor: { word: 'du Chapardeur', word_en: 'of the Pilferer', icon: '🧤' }, art: ['r5c5', 'r1c3', 'r4c5'],
    build: (rng, rar) => ({ action: 'loseItem', target: rng() < 0.6 ? 'randomOpponent' : 'target', category: '', fallbackGold: byRar(rng, rar, [5, 8], [8, 12], [12, 18]) }) },
  { key: 'bleedFoe', cat: 'foe', weight: 5, flavor: { word: 'de la Sangsue', word_en: 'of the Leech', icon: '🩸' }, art: ['r5c6', 'r5c3', 'r1c7', 'r1c3', 'r5c5'],
    build: (rng, rar) => { const ft = foeTarget(rng); return { action: 'buff', target: ft, buff: { type: 'bleedGold', turns: byRar(rng, rar, [1, 2], [2, 2], [2, 3]), n: byRar(rng, rar, [3, 5], [5, 8], [8, 12]), mode: ft === 'allOthers' ? 'lose' : 'steal' } }; } },
  { key: 'placeTrap', cat: 'foe', weight: 5, flavor: { word: 'du Piège', word_en: 'of the Trap', icon: '🪤' }, art: ['r1c3', 'r5c5', 'r4c5'],
    build: (rng, rar) => {
      const r = rng();
      const inner = r < 0.4 ? { action: 'move', target: 'self', dir: 'back', n: byRar(rng, rar, [1, 2], [2, 2], [2, 3]) }
        : r < 0.75 ? { action: 'money', mode: 'lose', target: 'self', n: byRar(rng, rar, [4, 7], [7, 12], [12, 18]), unit: 'flat' }
          : { action: 'curseTimer', target: 'self', divisor: 2 };
      return { action: 'placeTrap', trap: { label: 'Piège alchimique', label_en: 'Alchemical trap', icon: '🪤', do: [inner] } };
    } },
];

// Volet HASARD (d6) — assemblé à part. Inclut une vraie contrepartie en 1.
export const GAMBLE = {
  flavor: { word: 'du Hasard', word_en: 'of Chance', icon: '🃏' }, art: ['r4c3', 'r5c8', 'r4c1', 'r1c2'],
  build: (rng, rar) => ({
    roll: 'd6',
    table: {
      '1': [rng() < 0.5
        ? { action: 'money', mode: 'lose', target: 'self', n: byRar(rng, rar, [2, 4], [3, 6], [4, 8]), unit: 'flat' }
        : { action: 'buff', target: 'self', buff: { type: 'loseOnWrong', turns: 2, n: byRar(rng, rar, [3, 5], [5, 8], [8, 12]) } }],
      '2-3': [{ action: 'move', target: 'self', dir: 'forward', n: 1 }],
      '4-5': [{ action: 'money', mode: 'gain', target: 'self', n: byRar(rng, rar, [8, 14], [14, 22], [22, 34]), unit: 'flat' }],
      '6': [{ action: 'money', mode: 'gain', target: 'self', n: byRar(rng, rar, [15, 22], [22, 34], [34, 50]), unit: 'flat' }],
    },
  }),
};

const SELF = CATALOG.filter((e) => e.cat === 'self');
const FOE = CATALOG.filter((e) => e.cat === 'foe');
const byKey = Object.fromEntries(CATALOG.map((e) => [e.key, e]));

// Tirage pondéré sans remise dans une liste de builders.
function weightedPick(rng, pool, exclude) {
  const avail = pool.filter((e) => !exclude.has(e.key));
  if (!avail.length) return null;
  const tot = avail.reduce((s, e) => s + e.weight, 0);
  let r = rng() * tot;
  for (const e of avail) { if (r < e.weight) return e; r -= e.weight; }
  return avail[avail.length - 1];
}

// Construit le contenu d'une potion : nb d'effets par rareté, mélange self/foe,
// gamble occasionnel. Renvoie { actions, rollTable, domKey, flavor, art }.
//   pGamble : probabilité d'un volet hasard. pFoe : proba qu'un slot soit « foe »
//   (plafonné à maxFoe par potion). On garantit ≥1 effet self.
export function buildPotionEffects(rng, rarity, opts = {}) {
  const { pGamble = 0.14, pFoe = 0.5, maxFoe = 2 } = opts;
  const count = rarity === 'legendaire' ? ri(rng, 4, 5) : rarity === 'rare' ? 3 : 2;
  const chosen = []; // builders
  const used = new Set();
  let foeCount = 0;
  let rollTable = null;
  let gambleFlavor = null;

  const wantGamble = rng() < pGamble;
  let slots = count;
  if (wantGamble) { const g = GAMBLE.build(rng, rarity); rollTable = g.table; gambleFlavor = GAMBLE; slots -= 1; }

  // 1er slot = self garanti (potion d'abord utile à soi).
  for (let s = 0; s < slots; s++) {
    const forceSelf = chosen.length === 0 && !gambleFlavor ? true : false;
    const canFoe = foeCount < maxFoe && s > 0;
    const pickFoe = canFoe && rng() < pFoe;
    const pool = (pickFoe && !forceSelf) ? FOE : SELF;
    const e = weightedPick(rng, pool, used);
    if (!e) continue;
    used.add(e.key);
    if (e.cat === 'foe') foeCount++;
    chosen.push(e);
  }

  const actions = chosen.map((e) => e.build(rng, rarity));
  // Effet dominant (pour nom/icône/visuel) : 1er effet self s'il existe, sinon
  // gamble, sinon 1er. (Le nom reflète l'aide principale.)
  const dom = chosen.find((e) => e.cat === 'self') || gambleFlavor || chosen[0] || byKey.moneyGain;
  return { actions, rollTable, domKey: dom.key || 'gamble', flavor: dom.flavor, art: dom.art };
}
