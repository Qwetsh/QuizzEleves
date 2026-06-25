// Traduction LISIBLE (FR/EN) des effets d'un objet, pour les joueurs (au tap en
// boutique/inventaire/companion) ET l'aperçu de l'éditeur. Source unique de
// vérité de la description — couvre TOUTES les formes du moteur :
//   - effets simples legacy { type, value, chance? }
//   - déclencheurs { kind:'trigger', on:'use'|'roll'|'correct'|'wrong'|'question', ... }
//   - valeurs : nombre fixe | dé 'd2'..'d10' | objet à l'échelle { per, factor, base }
// La langue vient de getLang() (synchronisée avec englishMode) — par défaut FR
// (éditeur/tests). Voir src/store/effectEngine.js et src/logic/itemEffects.js.
import { SUBJECTS } from '../data/subjects.js';
import { getLang } from '../i18n/lang.js';

const EN = (lang) => lang === 'en';
// Nom de matière (name_en si dispo, sinon FR — cf. data/subjects.js).
const subjName = (s, lang) => SUBJECTS[s]?.[EN(lang) ? 'name_en' : 'name'] || SUBJECTS[s]?.name || s;
// Pluriel : vrai si n est un nombre « singulier » (EN: 1 ; FR: 0/1). Les valeurs
// dé/échelle (string/objet) sont traitées comme pluriel.
const isOne = (n, lang) => typeof n === 'number' && (EN(lang) ? n === 1 : Math.abs(n) <= 1);
const word = (n, lang, fr1, frN, en1, enN) => (EN(lang) ? (isOne(n, lang) ? en1 : enN) : (isOne(n, lang) ? fr1 : frN));
const spaceW = (n, lang) => word(n, lang, 'case', 'cases', 'space', 'spaces');
const coinW = (n, lang) => word(n, lang, 'pièce', 'pièces', 'coin', 'coins');
const setbackW = (n, lang) => word(n, lang, 'recul', 'reculs', 'setback', 'setbacks');
const turnW = (n, lang) => word(n, lang, 'tour', 'tours', 'turn', 'turns');
const wrongAnsW = (n, lang) => word(n, lang, 'mauvaise réponse', 'mauvaises réponses', 'wrong answer', 'wrong answers');

const METRIC = {
  fr: { streak: 'série', correct: 'bonnes réponses', wrong: 'erreurs', precision: '% de précision', imprecision: "% d'imprécision", timeleft: '% de temps restant' },
  en: { streak: 'streak', correct: 'correct answers', wrong: 'wrong answers', precision: '% accuracy', imprecision: '% inaccuracy', timeleft: '% time left' },
};

// Étiquette d'une quantité : 3 → "3", 'd6' → "1D6", { per, factor, base } → "5×série" (+base).
export function amountLabel(n, lang = getLang()) {
  if (typeof n === 'string') return /^d\d+$/.test(n) ? `1${n.toUpperCase()}` : n;
  if (n != null && typeof n === 'object') {
    const f = n.factor ?? 1, b = n.base ?? 0;
    return `${b ? `${b}+` : ''}${f}×${METRIC[EN(lang) ? 'en' : 'fr'][n.per] || n.per}`;
  }
  return `${n ?? 0}`;
}

const TARGET = {
  fr: { self: 'soi', target: 'une cible', randomOpponent: 'un adversaire au hasard', all: 'toutes les équipes' },
  en: { self: 'self', target: 'a target', randomOpponent: 'a random opponent', all: 'all teams' },
};
const targetWho = (a, lang) => TARGET[EN(lang) ? 'en' : 'fr'][a.target] || a.target || TARGET[EN(lang) ? 'en' : 'fr'].self;
const subjectLabel = (s, lang) => (s === 'choose'
  ? (EN(lang) ? 'subject of your choice' : 'thème au choix')
  : (!s || s === 'same') ? (EN(lang) ? 'same subject' : 'même thème') : subjName(s, lang));

// Une action atomique (do[]) en clair.
export function describeAction(a, lang = getLang()) {
  if (!a) return '';
  const en = EN(lang);
  const self = !a.target || a.target === 'self';
  const who = targetWho(a, lang);
  switch (a.action) {
    case 'move': {
      const cases = `${amountLabel(a.n, lang)} ${spaceW(a.n, lang)}`;
      if (self) return en ? `move ${a.dir === 'back' ? 'back' : 'forward'} ${cases}` : `${a.dir === 'back' ? 'recule' : 'avance'} de ${cases}`;
      return en ? `move ${who} ${a.dir === 'back' ? 'back' : 'forward'} ${cases}` : `fait ${a.dir === 'back' ? 'reculer' : 'avancer'} ${who} de ${cases}`;
    }
    case 'money': {
      const amt = `${amountLabel(a.n, lang)}${a.unit === 'percent' ? '%' : ''}`;
      const unit = a.unit === 'percent' ? (en ? ' of gold' : " d'or") : ` ${coinW(a.n, lang)}`;
      if (a.mode === 'steal') return en ? `steal ${amt}${unit} from ${who}` : `vole ${amt}${unit} à ${who}`;
      if (a.mode === 'lose') return self ? (en ? `lose ${amt}${unit}` : `perds ${amt}${unit}`) : (en ? `remove ${amt}${unit} from ${who}` : `retire ${amt}${unit} à ${who}`);
      return self ? (en ? `gain ${amt}${unit}` : `gagne ${amt}${unit}`) : (en ? `give ${amt}${unit} to ${who}` : `donne ${amt}${unit} à ${who}`);
    }
    case 'rerollQuestion': return typeof a.chance === 'number'
      ? (en
        ? `change the question (${Math.round(a.chance * 100)}% ${subjectLabel(a.subject, lang)}, else ${subjectLabel(a.elseSubject || 'hardcore', lang)})`
        : `change la question (${Math.round(a.chance * 100)}% ${subjectLabel(a.subject, lang)}, sinon ${subjectLabel(a.elseSubject || 'hardcore', lang)})`)
      : (en ? `change the question (${subjectLabel(a.subject, lang)})` : `change la question (${subjectLabel(a.subject, lang)})`);
    case 'forceSubject': return en ? `force ${who} into a ${subjName(a.subject, lang)} question` : `force ${who} à une question ${subjName(a.subject, lang)}`;
    case 'randomPathNext': return self
      ? (en ? 'makes your next path random' : 'rend ta prochaine voie aléatoire')
      : (en ? `makes ${who}'s next path random` : `rend la prochaine voie de ${who} aléatoire`);
    case 'teleportFurthest': return self
      ? (en ? 'teleports you to the furthest space reached' : 'te téléporte sur la case la plus avancée atteinte')
      : (en ? `teleports ${who} to their furthest space reached` : `téléporte ${who} sur sa case la plus avancée atteinte`);
    case 'challenge': {
      const win = (a.do || []).map((x) => describeAction(x, lang)).filter(Boolean).join(', ') || (en ? 'nothing' : 'rien');
      const lose = (a.else || []).map((x) => describeAction(x, lang)).filter(Boolean).join(', ');
      return en
        ? `challenge: your question forced in ${subjName(a.subject, lang)} — if right: ${win}${lose ? ` ; if wrong: ${lose}` : ''}`
        : `défi : ta question forcée en ${subjName(a.subject, lang)} — si juste : ${win}${lose ? ` ; si raté : ${lose}` : ''}`;
    }
    case 'placeTrap': {
      const inner = (a.trap?.do || []).map((x) => describeAction(x, lang)).join(', ');
      return en
        ? `place a trap${a.trap?.label ? ` « ${a.trap.label} »` : ''}${inner ? ` : ${inner}` : ''}`
        : `pose un piège${a.trap?.label ? ` « ${a.trap.label} »` : ''}${inner ? ` : ${inner}` : ''}`;
    }
    case 'gainCharge': return en ? 'recharge a power' : 'recharge un pouvoir';
    case 'loot': {
      const cat = a.category === 'consumable' ? (en ? ' (consumable)' : ' (consommable)') : a.category === 'equipment' ? (en ? ' (equipment)' : ' (équipement)') : '';
      return en ? `loot an item${cat}` : `loot un objet${cat}`;
    }
    case 'buff': {
      const b = a.buff || {};
      const tn = b.turns ?? 3;
      const dur = en ? `for ${tn} ${turnW(tn, lang)}` : `pendant ${tn} ${turnW(tn, lang)}`;
      const tgt = self ? (en ? 'you' : 'toi') : who;
      const D = EN(lang) ? {
        themeBonus: `+${amountLabel(b.n ?? 5, lang)} gold per correct answer${b.subject ? ` in ${subjName(b.subject, lang)}` : ''}`,
        advanceOnCorrect: `move forward ${amountLabel(b.n ?? 'd4', lang)} on each correct answer`,
        diceBonus: `each die roll gets +${amountLabel(b.n ?? 1, lang)}`,
        noRecul: 'no setback on a wrong answer',
        loseOnWrong: `lose ${amountLabel(b.n ?? 5, lang)} gold on each mistake`,
        randomPath: 'path chosen at random at junctions',
        duelImmune: 'immune to duels',
        bleedGold: `${b.mode === 'steal' ? 'is bled of' : 'loses'} ${amountLabel(b.n ?? 'd10', lang)} gold each turn`,
        itemStealImmune: 'immune to item theft',
        goldStealImmune: 'immune to gold theft',
        reflectChance: `${amountLabel(b.n ?? 0, lang)}% chance to reflect a negative effect`,
        moveDieSides: `movement die becomes a D${b.n ?? 6}`,
      } : {
        themeBonus: `+${amountLabel(b.n ?? 5, lang)} or par bonne réponse${b.subject ? ` en ${subjName(b.subject, lang)}` : ''}`,
        advanceOnCorrect: `avance de ${amountLabel(b.n ?? 'd4', lang)} à chaque bonne réponse`,
        diceBonus: `chaque lancer de dé fait +${amountLabel(b.n ?? 1, lang)}`,
        noRecul: 'aucun recul en cas d’erreur',
        loseOnWrong: `perd ${amountLabel(b.n ?? 5, lang)} or à chaque erreur`,
        randomPath: 'voie choisie au hasard aux carrefours',
        duelImmune: 'immunisé contre les duels',
        bleedGold: `${b.mode === 'steal' ? 'se fait voler' : 'perd'} ${amountLabel(b.n ?? 'd10', lang)} or chaque tour`,
        itemStealImmune: "immunisé au vol d'objet",
        goldStealImmune: "immunisé au vol d'or",
        reflectChance: `${amountLabel(b.n ?? 0, lang)}% de chance de renvoyer un effet négatif`,
        moveDieSides: `dé de mouvement transformé en D${b.n ?? 6}`,
      };
      return `${dur}, ${tgt} : ${D[b.type] || b.type}`;
    }
    case 'blockPowers': return en ? `blocks ${who}'s powers for ${amountLabel(a.turns ?? 2, lang)} ${turnW(a.turns ?? 2, lang)}` : `bloque les pouvoirs de ${who} pendant ${amountLabel(a.turns ?? 2, lang)} ${turnW(a.turns ?? 2, lang)}`;
    case 'blockConsumables': return en ? `blocks ${who}'s consumables for ${amountLabel(a.turns ?? 2, lang)} ${turnW(a.turns ?? 2, lang)}` : `bloque les consommables de ${who} pendant ${amountLabel(a.turns ?? 2, lang)} ${turnW(a.turns ?? 2, lang)}`;
    case 'loseItem': return en ? `makes ${who} lose an item${a.fallbackGold ? ` (or −${amountLabel(a.fallbackGold, lang)} gold)` : ''}` : `fait perdre un objet à ${who}${a.fallbackGold ? ` (ou −${amountLabel(a.fallbackGold, lang)} or)` : ''}`;
    case 'hideWrong': return en ? `removes ${amountLabel(a.n ?? 1, lang)} ${wrongAnsW(a.n ?? 1, lang)}` : `élimine ${amountLabel(a.n ?? 1, lang)} ${wrongAnsW(a.n ?? 1, lang)}`;
    case 'shieldNext': return en ? `shield (cancels ${amountLabel(a.n ?? 1, lang)} ${setbackW(a.n ?? 1, lang)})` : `bouclier (annule ${amountLabel(a.n ?? 1, lang)} ${setbackW(a.n ?? 1, lang)})`;
    case 'fumigene': return en
      ? `smoke bomb${a.turns ? ` for ${amountLabel(a.turns, lang)} ${turnW(a.turns, lang)}` : ''}`
      : `fumigène${a.turns ? ` pendant ${amountLabel(a.turns, lang)} ${turnW(a.turns, lang)}` : ''}`;
    case 'extraTime': return en ? `+${amountLabel(a.n, lang)}s on the next question` : `+${amountLabel(a.n, lang)}s à la prochaine question`;
    default: return a.action || '';
  }
}

const joinDo = (acts, lang) => (acts || []).map((a) => describeAction(a, lang)).filter(Boolean).join(', ');
const pct = (c) => `${Math.round((c ?? 0) * 100)}%`;

// Effet simple legacy { type, value, chance? } en clair (point de vue du porteur).
function describeLegacy(fx, lang) {
  const en = EN(lang);
  const v = amountLabel(fx.value, lang);
  let txt;
  switch (fx.type) {
    case 'timerBonus': txt = en ? `+${v}s answer time` : `+${v}s au temps de réponse`; break;
    case 'indiceBoost': txt = en ? `removes ${v} ${wrongAnsW(fx.value, lang)} each question` : `élimine ${v} ${wrongAnsW(fx.value, lang)} à chaque question`; break;
    case 'moneyPerCorrect': txt = en ? `+${v} ${coinW(fx.value, lang)} per correct answer` : `+${v} ${coinW(fx.value, lang)} par bonne réponse`; break;
    case 'taxReduction': txt = en ? `−${v}% on taxes and tolls` : `−${v}% sur les impôts et taxes`; break;
    case 'stealProtection': txt = en ? `−${v}% on the gold stolen from you` : `−${v}% sur l'or qu'on te vole`; break;
    case 'itemStealImmune': txt = en ? 'immune to item theft' : "immunisé au vol d'objet"; break;
    case 'goldStealImmune': txt = en ? 'immune to gold theft' : "immunisé au vol d'or"; break;
    case 'reflectChance': txt = en ? `${v}% chance to reflect a negative effect onto the attacker` : `${v}% de chance de renvoyer un effet négatif sur l'attaquant`; break;
    case 'reculReduction': txt = en ? `setback reduced by ${v} ${spaceW(fx.value, lang)}` : `recul subi réduit de ${v} ${spaceW(fx.value, lang)}`; break;
    case 'reculReductionPct': txt = en ? `setback reduced by ${v}%` : `recul subi réduit de ${v}%`; break;
    case 'moveDieSides': txt = en ? `movement die turned into a D${fx.value}` : `dé de mouvement transformé en D${fx.value}`; break;
    case 'hardcoreChance': txt = en ? `${v}% chance your question is Hardcore` : `${v}% de chance que ta question soit en Hardcore`; break;
    case 'tempeteImmune': txt = en ? 'immune to the Storm' : `immunité à la Tempête`; break;
    case 'duelImmune': txt = en ? 'immune to duels' : `immunité aux duels`; break;
    case 'oubliProtect': txt = en ? "protects from the Memory Hole" : `protège du Trou de l'oubli`; break;
    case 'fightStealBonus': txt = en ? `+${v} ${coinW(fx.value, lang)} stolen in a duel` : `+${v} ${coinW(fx.value, lang)} volée${fx.value === 1 ? '' : 's'} en duel`; break;
    case 'lootBonusConsumable': txt = en ? `+${v}% chance to loot a consumable` : `+${v}% de chance de looter un consommable`; break;
    case 'lootBonusEquipment': txt = en ? `+${v}% chance to loot equipment` : `+${v}% de chance de looter un équipement`; break;
    case 'lootBonusSubject': txt = en ? `+${v}% ingredient loot on ${subjName(fx.subject, lang)} spaces` : `+${v}% de loot d'ingrédient sur les cases ${subjName(fx.subject, lang) || '—'}`; break;
    case 'gainMoney': txt = en ? `gain ${v} ${coinW(fx.value, lang)}` : `gagne ${v} pièces`; break;
    case 'gainMoneyAll': txt = en ? `${v} ${coinW(fx.value, lang)} for all teams` : `${v} pièces pour toutes les équipes`; break;
    case 'moveForward': txt = en ? `move forward ${v} ${spaceW(fx.value, lang)}` : `avance de ${v} ${spaceW(fx.value, lang)}`; break;
    case 'extraTime': txt = en ? `+${v}s on the next question` : `+${v}s à la prochaine question`; break;
    case 'shieldNext': txt = en ? `cancels ${v} ${setbackW(fx.value, lang)}` : `annule ${v} ${setbackW(fx.value, lang)}`; break;
    case 'gainCharge': txt = en ? 'recharge a power' : `recharge un pouvoir`; break;
    case 'fumigene': txt = en ? 'cancels the next offensive power against you' : `annule le prochain pouvoir offensif subi`; break;
    default: txt = fx.type || '';
  }
  if (typeof fx.chance !== 'number') return txt;
  return en ? `${pct(fx.chance)} chance: ${txt}` : `${pct(fx.chance)} de chance : ${txt}`;
}

// Déclencheur composable en clair.
function describeTrigger(fx, lang) {
  const en = EN(lang);
  if (fx.on === 'use') {
    if (fx.roll === 'd6' && fx.table) {
      const branches = Object.entries(fx.table)
        .map(([k, acts]) => `${k} → ${acts && acts.length ? joinDo(acts, lang) : (en ? 'nothing' : 'rien')}`)
        .join(' · ');
      return en ? `roll a die: ${branches}` : `lance un dé : ${branches}`;
    }
    if (typeof fx.chance === 'number') {
      const win = joinDo(fx.do, lang) || (en ? 'nothing' : 'rien');
      const lose = (fx.else && fx.else.length) ? joinDo(fx.else, lang) : null;
      return en
        ? `${pct(fx.chance)} chance: ${win}${lose ? ` — else: ${lose}` : ''}`
        : `${pct(fx.chance)} de chance : ${win}${lose ? ` — sinon : ${lose}` : ''}`;
    }
    return joinDo(fx.do, lang);
  }
  const chancePrefix = typeof fx.chance === 'number' ? (en ? `${pct(fx.chance)} chance — ` : `${pct(fx.chance)} de chance — `) : '';
  const onSubj = fx.subject ? (en ? ` in ${subjName(fx.subject, lang)}` : ` en ${subjName(fx.subject, lang)}`) : '';
  if (fx.on === 'roll') return en
    ? `${chancePrefix}if the die rolls ${(fx.values || []).join('/')}: ${joinDo(fx.do, lang)}`
    : `${chancePrefix}si le dé fait ${(fx.values || []).join('/')} : ${joinDo(fx.do, lang)}`;
  if (fx.on === 'questionSubject') {
    const subs = fx.subjects?.length ? fx.subjects.map((s) => subjName(s, lang)).join('/') : (en ? 'any subject' : 'toute matière');
    return en
      ? `${chancePrefix}when you land on a ${subs} question: ${joinDo(fx.do, lang)}`
      : `${chancePrefix}quand je tombe sur une question en ${subs} : ${joinDo(fx.do, lang)}`;
  }
  if (fx.on === 'correct') return en
    ? `${chancePrefix}on each correct answer${onSubj}: ${joinDo(fx.do, lang)}`
    : `${chancePrefix}à chaque bonne réponse${onSubj} : ${joinDo(fx.do, lang)}`;
  if (fx.on === 'wrong') return en
    ? `${chancePrefix}on each mistake${onSubj} (or timeout): ${joinDo(fx.do, lang)}`
    : `${chancePrefix}à chaque erreur${onSubj} (ou temps écoulé) : ${joinDo(fx.do, lang)}`;
  if (fx.on === 'fightWin') return en ? `${chancePrefix}when you win a duel: ${joinDo(fx.do, lang)}` : `${chancePrefix}quand tu gagnes un duel : ${joinDo(fx.do, lang)}`;
  if (fx.on === 'fightLose') return en ? `${chancePrefix}when you lose a duel: ${joinDo(fx.do, lang)}` : `${chancePrefix}quand tu perds un duel : ${joinDo(fx.do, lang)}`;
  if (fx.on === 'question') {
    const onSubjects = fx.subjects?.length
      ? (en ? ` (only in ${fx.subjects.map((s) => subjName(s, lang)).join('/')})` : ` (seulement en ${fx.subjects.map((s) => subjName(s, lang)).join('/')})`)
      : '';
    return en
      ? `« Change the question » button${onSubjects} → ${subjectLabel(fx.do?.[0]?.subject, lang)}`
      : `bouton « Changer la question »${onSubjects} → ${subjectLabel(fx.do?.[0]?.subject, lang)}`;
  }
  return joinDo(fx.do, lang);
}

// Un effet (legacy ou trigger) → texte.
export function describeEffect(fx, lang = getLang()) {
  if (!fx) return '';
  if (fx.kind === 'trigger') return describeTrigger(fx, lang);
  if (fx.type) return describeLegacy(fx, lang);
  return '';
}

// Liste des descriptions d'effets d'un objet, AUTO-générée depuis ses effets.
export function describeItemEffects(item, lang = getLang()) {
  return (item?.effects || []).map((fx) => describeEffect(fx, lang)).filter(Boolean);
}

// Lignes affichées sous « Détail de l'effet » : descExpert (manuel) prime, sinon
// auto-généré. opts.lang force la langue (sinon getLang()). Source unique pour le jeu.
export function itemEffectLines(item, opts = {}) {
  const lang = opts.lang || getLang();
  // Vue joueur : l'effet d'un ingrédient d'alchimie reste CACHÉ tant que l'équipe
  // ne l'a pas utilisé au moins une fois (révélation par `knownIngredients`).
  if (item?.family === 'ingredient' && opts.key && Array.isArray(opts.knownIngredients)
      && !opts.knownIngredients.includes(opts.key)) {
    return [EN(lang) ? '❓ Unknown effect — use it once to reveal it' : '❓ Effet inconnu — utilise-le une fois pour le révéler'];
  }
  // Détail expert saisi à la main : en anglais on prend descExpert_en s'il existe,
  // sinon on retombe sur l'auto-généré (bilingue) ; en français, descExpert.
  const manual = EN(lang) ? item?.descExpert_en : item?.descExpert;
  const expert = (typeof manual === 'string') ? manual.trim() : '';
  if (expert) return expert.split('\n').map((l) => l.trim()).filter(Boolean);
  return describeItemEffects(item, lang);
}
