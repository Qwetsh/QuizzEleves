// Traduction LISIBLE (français) des effets d'un objet, pour les joueurs (au tap
// en boutique/inventaire/companion) ET l'aperçu de l'éditeur. Source unique de
// vérité de la description — couvre TOUTES les formes du moteur :
//   - effets simples legacy { type, value, chance? }
//   - déclencheurs { kind:'trigger', on:'use'|'roll'|'correct'|'wrong'|'question', ... }
//   - valeurs : nombre fixe | dé 'd2'..'d10' | objet à l'échelle { per, factor, base }
// Voir src/store/effectEngine.js et src/logic/itemEffects.js.
import { SUBJECTS } from '../data/subjects.js';

const METRIC_LABEL = {
  streak: 'série', correct: 'bonnes réponses', wrong: 'erreurs',
  precision: '% de précision', imprecision: "% d'imprécision", timeleft: '% de temps restant',
};

// Étiquette d'une quantité : 3 → "3", 'd6' → "1D6", { per, factor, base } → "5×série" (+base).
export function amountLabel(n) {
  if (typeof n === 'string') return /^d\d+$/.test(n) ? `1${n.toUpperCase()}` : n;
  if (n != null && typeof n === 'object') {
    const f = n.factor ?? 1, b = n.base ?? 0;
    return `${b ? `${b}+` : ''}${f}×${METRIC_LABEL[n.per] || n.per}`;
  }
  return `${n ?? 0}`;
}

const TARGET_LABEL = {
  self: 'soi', target: 'une cible', randomOpponent: 'un adversaire au hasard', all: 'toutes les équipes',
};
const subjectLabel = (s) => (s === 'choose' ? 'thème au choix' : !s || s === 'same' ? 'même thème' : SUBJECTS[s]?.name || s);

// Une action atomique (do[]) en clair.
export function describeAction(a) {
  if (!a) return '';
  const self = !a.target || a.target === 'self';
  const who = TARGET_LABEL[a.target] || a.target || 'soi';
  switch (a.action) {
    case 'move': {
      const cases = `${amountLabel(a.n)} case${a.n === 1 ? '' : 's'}`;
      // Point de vue du porteur quand c'est « soi » : « avance de 2 cases ».
      if (self) return `${a.dir === 'back' ? 'recule' : 'avance'} de ${cases}`;
      return `fait ${a.dir === 'back' ? 'reculer' : 'avancer'} ${who} de ${cases}`;
    }
    case 'money': {
      const amt = `${amountLabel(a.n)}${a.unit === 'percent' ? '%' : ''}`;
      const unit = a.unit === 'percent' ? " d'or" : ` pièce${a.n === 1 ? '' : 's'}`;
      if (a.mode === 'steal') return `vole ${amt}${unit} à ${who}`;
      if (a.mode === 'lose') return self ? `perds ${amt}${unit}` : `retire ${amt}${unit} à ${who}`;
      return self ? `gagne ${amt}${unit}` : `donne ${amt}${unit} à ${who}`;
    }
    case 'rerollQuestion': return typeof a.chance === 'number'
      ? `change la question (${Math.round(a.chance * 100)}% ${subjectLabel(a.subject)}, sinon ${subjectLabel(a.elseSubject || 'hardcore')})`
      : `change la question (${subjectLabel(a.subject)})`;
    case 'forceSubject': return `force ${who} à une question ${SUBJECTS[a.subject]?.name || a.subject}`;
    case 'randomPathNext': return self ? 'rend ta prochaine voie aléatoire' : `rend la prochaine voie de ${who} aléatoire`;
    case 'teleportFurthest': return self ? 'te téléporte sur la case la plus avancée atteinte' : `téléporte ${who} sur sa case la plus avancée atteinte`;
    case 'challenge': {
      const win = (a.do || []).map(describeAction).filter(Boolean).join(', ') || 'rien';
      const lose = (a.else || []).map(describeAction).filter(Boolean).join(', ');
      return `défi : ta question forcée en ${SUBJECTS[a.subject]?.name || a.subject} — si juste : ${win}${lose ? ` ; si raté : ${lose}` : ''}`;
    }
    case 'placeTrap': {
      const inner = (a.trap?.do || []).map(describeAction).join(', ');
      return `pose un piège${a.trap?.label ? ` « ${a.trap.label} »` : ''}${inner ? ` : ${inner}` : ''}`;
    }
    case 'gainCharge': return 'recharge un pouvoir';
    case 'loot': return `loot un objet${a.category === 'consumable' ? ' (consommable)' : a.category === 'equipment' ? ' (équipement)' : ''}`;
    case 'buff': {
      const b = a.buff || {};
      const turns = `pendant ${b.turns ?? 3} tour${(b.turns ?? 3) > 1 ? 's' : ''}`;
      const tgt = self ? 'toi' : (TARGET_LABEL[a.target] || a.target);
      const D = {
        themeBonus: `+${amountLabel(b.n ?? 5)} or par bonne réponse${b.subject ? ` en ${SUBJECTS[b.subject]?.name || b.subject}` : ''}`,
        advanceOnCorrect: `avance de ${amountLabel(b.n ?? 'd4')} à chaque bonne réponse`,
        diceBonus: `chaque lancer de dé fait +${amountLabel(b.n ?? 1)}`,
        noRecul: 'aucun recul en cas d’erreur',
        loseOnWrong: `perd ${amountLabel(b.n ?? 5)} or à chaque erreur`,
        randomPath: 'voie choisie au hasard aux carrefours',
        duelImmune: 'immunisé contre les duels',
      };
      return `${turns}, ${tgt} : ${D[b.type] || b.type}`;
    }
    case 'hideWrong': return `élimine ${amountLabel(a.n ?? 1)} mauvaise réponse${a.n === 1 ? '' : 's'}`;
    case 'shieldNext': return `bouclier (annule ${amountLabel(a.n ?? 1)} recul${a.n === 1 ? '' : 's'})`;
    case 'fumigene': return `fumigène${a.turns ? ` pendant ${amountLabel(a.turns)} tour${a.turns === 1 ? '' : 's'}` : ''}`;
    case 'extraTime': return `+${amountLabel(a.n)}s à la prochaine question`;
    default: return a.action || '';
  }
}

const joinDo = (acts) => (acts || []).map(describeAction).filter(Boolean).join(', ');
const pct = (c) => `${Math.round((c ?? 0) * 100)}%`;

// Effet simple legacy { type, value, chance? } en clair (point de vue du porteur/utilisateur).
function describeLegacy(fx) {
  const v = amountLabel(fx.value);
  let txt;
  switch (fx.type) {
    case 'timerBonus': txt = `+${v}s au temps de réponse`; break;
    case 'indiceBoost': txt = `élimine ${v} mauvaise réponse${fx.value === 1 ? '' : 's'} à chaque question`; break;
    case 'moneyPerCorrect': txt = `+${v} pièce${fx.value === 1 ? '' : 's'} par bonne réponse`; break;
    case 'taxReduction': txt = `−${v}% sur les impôts et taxes`; break;
    case 'stealProtection': txt = `−${v}% sur l'or qu'on te vole`; break;
    case 'reculReduction': txt = `recul subi réduit de ${v} case${fx.value === 1 ? '' : 's'}`; break;
    case 'reculReductionPct': txt = `recul subi réduit de ${v}%`; break;
    case 'moveDieSides': txt = `dé de mouvement transformé en D${fx.value}`; break;
    case 'hardcoreChance': txt = `${v}% de chance que ta question soit en Hardcore`; break;
    case 'tempeteImmune': txt = `immunité à la Tempête`; break;
    case 'duelImmune': txt = `immunité aux duels`; break;
    case 'oubliProtect': txt = `protège du Trou de l'oubli`; break;
    case 'fightStealBonus': txt = `+${v} pièce${fx.value === 1 ? '' : 's'} volée${fx.value === 1 ? '' : 's'} en duel`; break;
    case 'lootBonusConsumable': txt = `+${v}% de chance de looter un consommable`; break;
    case 'lootBonusEquipment': txt = `+${v}% de chance de looter un équipement`; break;
    case 'gainMoney': txt = `gagne ${v} pièces`; break;
    case 'gainMoneyAll': txt = `${v} pièces pour toutes les équipes`; break;
    case 'moveForward': txt = `avance de ${v} case${fx.value === 1 ? '' : 's'}`; break;
    case 'extraTime': txt = `+${v}s à la prochaine question`; break;
    case 'shieldNext': txt = `annule ${v} recul${fx.value === 1 ? '' : 's'}`; break;
    case 'gainCharge': txt = `recharge un pouvoir`; break;
    case 'fumigene': txt = `annule le prochain pouvoir offensif subi`; break;
    default: txt = fx.type || '';
  }
  return typeof fx.chance === 'number' ? `${pct(fx.chance)} de chance : ${txt}` : txt;
}

// Déclencheur composable en clair.
function describeTrigger(fx) {
  if (fx.on === 'use') {
    if (fx.roll === 'd6' && fx.table) {
      const branches = Object.entries(fx.table)
        .map(([k, acts]) => `${k} → ${acts && acts.length ? joinDo(acts) : 'rien'}`)
        .join(' · ');
      return `lance un dé : ${branches}`;
    }
    if (typeof fx.chance === 'number') {
      const win = joinDo(fx.do) || 'rien';
      const lose = (fx.else && fx.else.length) ? joinDo(fx.else) : null;
      return `${pct(fx.chance)} de chance : ${win}${lose ? ` — sinon : ${lose}` : ''}`;
    }
    return joinDo(fx.do);
  }
  const chancePrefix = typeof fx.chance === 'number' ? `${pct(fx.chance)} de chance — ` : '';
  // Condition de thème (déclencheurs de réponse) : « … en Histoire ».
  const onSubj = fx.subject ? ` en ${SUBJECTS[fx.subject]?.name || fx.subject}` : '';
  if (fx.on === 'roll') return `${chancePrefix}si le dé fait ${(fx.values || []).join('/')} : ${joinDo(fx.do)}`;
  if (fx.on === 'questionSubject') {
    const subs = fx.subjects?.length
      ? fx.subjects.map((s) => SUBJECTS[s]?.name || s).join('/')
      : 'toute matière';
    return `${chancePrefix}quand je tombe sur une question en ${subs} : ${joinDo(fx.do)}`;
  }
  if (fx.on === 'correct') return `${chancePrefix}à chaque bonne réponse${onSubj} : ${joinDo(fx.do)}`;
  if (fx.on === 'wrong') return `${chancePrefix}à chaque erreur${onSubj} (ou temps écoulé) : ${joinDo(fx.do)}`;
  if (fx.on === 'fightWin') return `${chancePrefix}quand tu gagnes un duel : ${joinDo(fx.do)}`;
  if (fx.on === 'fightLose') return `${chancePrefix}quand tu perds un duel : ${joinDo(fx.do)}`;
  if (fx.on === 'question') {
    const onSubjects = fx.subjects?.length
      ? ` (seulement en ${fx.subjects.map((s) => SUBJECTS[s]?.name || s).join('/')})`
      : '';
    return `bouton « Changer la question »${onSubjects} → ${subjectLabel(fx.do?.[0]?.subject)}`;
  }
  return joinDo(fx.do);
}

// Un effet (legacy ou trigger) → texte.
export function describeEffect(fx) {
  if (!fx) return '';
  if (fx.kind === 'trigger') return describeTrigger(fx);
  if (fx.type) return describeLegacy(fx);
  return '';
}

// Liste des descriptions d'effets d'un objet, AUTO-générée depuis ses effets
// (1 entrée par effet, vides filtrées).
export function describeItemEffects(item) {
  return (item?.effects || []).map(describeEffect).filter(Boolean);
}

// Lignes affichées sous « Détail de l'effet » : si l'objet porte une description
// experte saisie à la main (descExpert), elle PRIME (découpée par lignes) ;
// sinon on retombe sur la traduction auto-générée. Source unique pour le jeu.
export function itemEffectLines(item, opts = {}) {
  // Vue joueur : l'effet d'un ingrédient d'alchimie reste CACHÉ tant que l'équipe
  // ne l'a pas utilisé au moins une fois (révélation par `knownIngredients`).
  // L'éditeur (prof) n'envoie pas d'opts → effet toujours visible.
  if (item?.family === 'ingredient' && opts.key && Array.isArray(opts.knownIngredients)
      && !opts.knownIngredients.includes(opts.key)) {
    return ['❓ Effet inconnu — utilise-le une fois pour le révéler'];
  }
  const expert = typeof item?.descExpert === 'string' ? item.descExpert.trim() : '';
  if (expert) return expert.split('\n').map((l) => l.trim()).filter(Boolean);
  return describeItemEffects(item);
}
