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
  const who = TARGET_LABEL[a.target] || a.target || 'soi';
  switch (a.action) {
    case 'move':
      return `${a.dir === 'back' ? 'recule' : 'avance'} ${who} de ${amountLabel(a.n)} case${a.n === 1 ? '' : 's'}`;
    case 'money': {
      const verb = a.mode === 'steal' ? 'vole' : a.mode === 'lose' ? 'retire' : 'donne';
      return `${verb} ${amountLabel(a.n)}${a.unit === 'percent' ? '%' : ''} d'or ${a.mode === 'gain' ? 'à' : 'à'} ${who}`;
    }
    case 'rerollQuestion': return `change la question (${subjectLabel(a.subject)})`;
    case 'forceSubject': return `force ${who} à une question ${SUBJECTS[a.subject]?.name || a.subject}`;
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
    case 'tempeteImmune': txt = `immunité à la Tempête`; break;
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
  if (fx.on === 'roll') return `${chancePrefix}si le dé fait ${(fx.values || []).join('/')} : ${joinDo(fx.do)}`;
  if (fx.on === 'correct') return `${chancePrefix}à chaque bonne réponse : ${joinDo(fx.do)}`;
  if (fx.on === 'wrong') return `${chancePrefix}à chaque erreur (ou temps écoulé) : ${joinDo(fx.do)}`;
  if (fx.on === 'question') return `bouton « Changer la question » → ${subjectLabel(fx.do?.[0]?.subject)}`;
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
export function itemEffectLines(item) {
  const expert = typeof item?.descExpert === 'string' ? item.descExpert.trim() : '';
  if (expert) return expert.split('\n').map((l) => l.trim()).filter(Boolean);
  return describeItemEffects(item);
}
