// ============================================================
//  Moteur d'effets composable
//  Exécute une liste d'ACTIONS atomiques issues d'objets (consommables,
//  équipement, pièges). Gère les étapes INTERACTIVES au milieu d'une
//  séquence via une FILE suspendable dans le store (`pendingActions`)
//  + des « interrupts » (choix de cible/case/thème, lancer de d6, recharge,
//  jonction). Voir plan : objets ultra-custom.
// ============================================================
import { moveForward } from '../logic/pathfinding.js';
import { reducedSteal, applyStealProtection, resolveAmount, diceLabel, passesChance, activeSetEffects, mergedItem, isGoldStealImmune, rollsReflect, thornsPct, isAnchored, insurancePct, isDuelImmune } from '../logic/itemEffects.js';
import { applyRecul, questionDuration } from '../logic/turnHelpers.js';
import { extOn } from '../extensions/registry.js';
import { soundShield } from '../logic/sounds.js';
import { SUBJECTS, SUBJECT_KEYS } from '../data/subjects.js';
import { BUFF_INFO } from '../logic/teamStatus.js';
import { pickQuestion } from '../logic/questionPicker.js';
import { allSubjectsWithContent } from '../data/questions/index.js';
import { ITEMS } from '../data/items.js';
import { MAX_CHARGES } from '../data/powers.js';
import { saveGame } from './persistence.js';
import { tg, tgPlural } from '../i18n';
import { loc } from '../i18n/content';

const SLOTS_EQUIP = ['head', 'body', 'feet'];

// Quantités aléatoires (dés) : resolveAmount/diceLabel sont définis dans
// itemEffects.js (couche logique, sans dépendance) et ré-exportés ici pour
// les appelants/tests historiques du moteur.
export { resolveAmount, diceLabel };
// Suffixe lisible quand la quantité est aléatoire (dé 🎲) ou à l'échelle (📈).
function dieTag(n) {
  if (typeof n === 'string') return ` (🎲 ${diceLabel(n)})`;
  if (n && typeof n === 'object') return ` (📈 ${diceLabel(n)})`;
  return '';
}

// Formule lisible d'une quantité non fixe (dé/à l'échelle), pour le détail du
// journal — null si la quantité est un simple nombre.
function fxFormula(n) {
  return (typeof n === 'string' || (n && typeof n === 'object')) ? diceLabel(n) : null;
}

const cases = (n) => tgPlural('log.fx.cases', n, { n });

// --- Feedback visuel : « toasts » d'effet animés ----------------------
let fxId = 0;
export function announce(set, get, icon, text, color = '#e8b117') {
  const list = get().effectToasts || [];
  // borne pour éviter l'accumulation (d6/chaînes)
  const next = [...list, { id: ++fxId, icon, text, color }].slice(-4);
  set({ effectToasts: next });
}

// --- Helpers de schéma -------------------------------------------------

// Récupère les déclencheurs composables (`kind:'trigger'`) d'un objet pour un `on` donné.
export function triggersOf(item, on) {
  if (!item?.effects) return [];
  return item.effects.filter((fx) => fx && fx.kind === 'trigger' && fx.on === on);
}

// Déclencheurs apportés par les SETS actifs de l'équipe (mêmes que l'équipement).
function setTriggersOf(team, on) {
  return activeSetEffects(team).filter((fx) => fx && fx.kind === 'trigger' && fx.on === on);
}

// Adapte un effet de consommable LEGACY ({type,value}) en actions composables.
// Garantit la rétro-compatibilité des objets existants.
export function legacyToActions(fx) {
  switch (fx.type) {
    case 'gainMoney':    return [{ action: 'money', mode: 'gain', target: 'self', n: fx.value, unit: 'flat' }];
    case 'gainMoneyAll': return [{ action: 'money', mode: 'gain', target: 'all', n: fx.value, unit: 'flat' }];
    case 'moveForward':  return [{ action: 'move', target: 'self', dir: 'forward', n: fx.value }];
    case 'extraTime':    return [{ action: 'extraTime', n: fx.value }];
    case 'shieldNext':   return [{ action: 'shieldNext', n: fx.value }];
    case 'gainCharge':   return [{ action: 'gainCharge' }];
    case 'fumigene':     return [{ action: 'fumigene' }];
    default:             return [];
  }
}

// Déplie une liste de déclencheurs `on:'use'` en une liste plate d'actions.
// Résout `chance` (aléa synchrone) et marque les tables d6 (`__rollD6`).
export function expandUseTriggers(triggers) {
  const out = [];
  for (const t of triggers) {
    if (t.roll === 'd6' && t.table) {
      out.push({ action: '__rollD6', table: t.table });
      continue;
    }
    if (typeof t.chance === 'number') {
      out.push(...(Math.random() < t.chance ? (t.do || []) : (t.else || [])));
      continue;
    }
    out.push(...(t.do || []));
  }
  return out;
}

// Construit la liste d'actions d'un consommable (legacy + composable).
export function consumableActions(item) {
  const out = [];
  for (const fx of item.effects || []) {
    if (fx.kind === 'trigger') {
      if (fx.on === 'use') out.push(...expandUseTriggers([fx]));
    } else if (fx.type) {
      // effet simple : peut avoir une probabilité de déclenchement (chance 0..1)
      if (passesChance(fx.chance)) out.push(...legacyToActions(fx));
    }
  }
  return out;
}

// Actions des déclencheurs on:'roll' de l'équipement, pour une valeur de dé donnée.
export function equipOnRollActions(team, value) {
  const out = [];
  const consider = (t) => { if ((t.values || []).includes(value) && passesChance(t.chance)) out.push(...(t.do || [])); };
  for (const slot of SLOTS_EQUIP) {
    const it = mergedItem(team?.equipment?.[slot]);
    for (const t of triggersOf(it, 'roll')) consider(t);
  }
  for (const t of setTriggersOf(team, 'roll')) consider(t); // bonus de set
  return out;
}

// Actions des déclencheurs d'équipement liés à une réponse ('correct' | 'wrong').
// Tirés après qu'une question soit résolue (cf. answerQuestion / timeoutQuestion).
// `subject` = thème de la question résolue : un déclencheur portant `subject`
// (ex. « seulement si SVT ») n'est joué que s'il correspond.
export function equipTriggerActions(team, on, subject) {
  const out = [];
  const consider = (t) => {
    if (t.subject && t.subject !== subject) return; // condition de thème (mono) non remplie
    // Condition de thème MULTI (déclencheur on:questionSubject) : le thème courant
    // doit figurer dans la liste. Liste vide ⇒ toute matière.
    if (t.subjects?.length && !t.subjects.includes(subject)) return;
    if (passesChance(t.chance)) out.push(...(t.do || [])); // chance optionnelle
  };
  for (const slot of SLOTS_EQUIP) {
    const it = mergedItem(team?.equipment?.[slot]);
    for (const t of triggersOf(it, on)) consider(t);
  }
  for (const t of setTriggersOf(team, on)) consider(t); // bonus de set
  return out;
}

// Options de « changer la question » disponibles pour une équipe (équipement + sac).
// L'équipement est plafonné à un reroll par question (rerollUsed).
// `subject` = thème de la question courante : un déclencheur portant une condition
// de matières (`subjects: [...]`) n'est proposé que si elle correspond.
export function questionRerollOptions(team, rerollUsed, subject) {
  const opts = [];
  // Filtre de matières : pas de condition ⇒ toujours ; sinon le thème courant doit
  // être dans la liste.
  const subjectMatches = (t) => !t.subjects?.length || (subject != null && t.subjects.includes(subject));
  for (const slot of SLOTS_EQUIP) {
    const it = mergedItem(team?.equipment?.[slot]);
    const trig = triggersOf(it, 'question').filter(subjectMatches);
    if (trig.length && !rerollUsed) {
      opts.push({ itemName: it.name, icon: it.icon, fromBag: false, actions: trig.flatMap((t) => t.do || []) });
    }
  }
  // Une case de sac peut être une clé ("k") ou une pile ({ key, n }).
  const keyOf = (c) => (typeof c === 'string' ? c : c?.key);
  (team?.bag || []).forEach((c, i) => {
    const it = ITEMS[keyOf(c)];
    const trig = triggersOf(it, 'question').filter(subjectMatches);
    if (trig.length) opts.push({ itemName: it.name, icon: it.icon, fromBag: true, bagIndex: i, actions: trig.flatMap((t) => t.do || []) });
  });
  return opts;
}

// --- Résolution des cibles ---------------------------------------------

function resolveTargets(get, target, ctx) {
  const { teams } = get();
  const src = ctx.sourceTeam ?? 0;
  switch (target) {
    case 'self': return { indices: [src] };
    case 'all': return { indices: teams.map((_, i) => i) };
    case 'allOthers': return { indices: teams.map((_, i) => i).filter((i) => i !== src) };
    case 'randomOpponent': {
      const opp = teams.map((_, i) => i).filter((i) => i !== src);
      if (!opp.length) return { indices: [] };
      // Aléa déterministe-friendly : index pseudo-aléatoire
      const pick = opp[Math.floor(Math.random() * opp.length)];
      return { indices: [pick] };
    }
    case 'target':
      if (ctx.targetTeam != null) return { indices: [ctx.targetTeam] };
      return { needPicker: true };
    default: return { indices: [ctx.sourceTeam ?? 0] };
  }
}

const OFFENSIVE = (action) =>
  (action.action === 'move' && action.dir === 'back' && (action.target === 'target')) ||
  (action.action === 'money' && (action.mode === 'steal' || action.mode === 'lose') && action.target === 'target');

// Actions NÉGATIVES susceptibles d'être RENVOYÉES à l'attaquant (effet « miroir »).
// Le renvoi ne s'applique qu'à une cible UNIQUE qui n'est pas la source.
const REFLECTABLE = (action) => {
  switch (action.action) {
    case 'move': return action.dir === 'back';
    case 'money': return action.mode === 'steal' || action.mode === 'lose';
    case 'curseTimer':
    case 'curseExtraQuestion':
    case 'loseItem':
    case 'blockPowers':
    case 'blockConsumables':
    case 'curseFace':
    case 'unstableAnswers':
      return true;
    case 'buff': return !!action.__dot; // DoT « saignement d'or » uniquement
    default: return false;
  }
};

// Renvoi (« miroir ») : si l'action négative vise UNE seule équipe adverse qui
// possède une chance de renvoi (reflectChance) et que le tirage passe, l'effet
// est redirigé sur la SOURCE. Renvoie { indices, reflected } (indices = cibles
// effectives à appliquer ; reflected = true si redirigé). Émet log + VFX + son.
function applyReflection(set, get, action, ctx, indices) {
  const src = ctx.sourceTeam ?? 0;
  if (!REFLECTABLE(action) || !indices || indices.length !== 1) return { indices, reflected: false };
  const victimIdx = indices[0];
  if (victimIdx === src) return { indices, reflected: false };
  const victim = get().teams[victimIdx];
  if (!victim || !rollsReflect(victim)) return { indices, reflected: false };
  const attacker = get().teams[src];
  get().addLog(tg('log.fx.reflect', { vemoji: victim.emoji, vname: victim.name, aemoji: attacker.emoji, aname: attacker.name }));
  announce(set, get, '↩️', tg('log.fx.reflect.toast', { vname: victim.name, aname: attacker.name }), '#8745d4');
  get().emitVfx?.('reflect', victimIdx);
  return { indices: [src], reflected: true };
}

// --- Application des actions atomiques ---------------------------------

function applyMoveOne(set, get, idx, dir, n, allowJunction) {
  const { board, teams } = get();
  const team = teams[idx];

  // Recul : passe par la chaîne de bouclier unifiée (buff noRecul → Bouclier de
  // bois → pouvoir Bouclier → équipement). Vaut pour TOUS les reculs d'effet
  // (événements, consommables, pièges). La Foudre est gérée à part (offensif).
  if (dir === 'back') {
    const r = applyRecul(team, board, n, extOn(get().extensions, 'mastery'));
    const nt = [...teams];
    nt[idx] = { ...team, ...r.patch };
    // Forteresse (Bouclier L10) : le recul devient une avance (animation + journal).
    const movePath = r.path ? [{ teamIndex: idx, waypoints: r.path.map((id) => ({ x: board[id].x, y: board[id].y })), type: r.forward ? 'forward' : 'back' }] : null;
    set({ teams: nt, ...(movePath ? { movePath } : {}) });
    if (r.absorbedBy && r.absorbedBy !== 'equip') { soundShield(); get().emitVfx?.('shield', idx); }
    if (r.forward) get().addLog?.(tg('log.turn.fortressAdvance', { team: `${nt[idx].emoji} ${nt[idx].name}`, cases: r.advance }));
    return { moved: true, finalPos: r.patch.pos, applied: r.applied, advance: r.advance, forward: r.forward, base: n, detail: r.detail, absorbedBy: r.absorbedBy };
  }

  const res = moveForward(board, team.pos, n, { throughJunctions: !allowJunction });
  const nt = [...teams];
  const patch = { pos: res.finalPos };
  // High-water-mark : mémorise la case la plus avancée (par x) jamais atteinte —
  // sert à l'action `teleportFurthest`.
  if (board[res.finalPos]) {
    const curMaxX = team.maxPos && board[team.maxPos] ? board[team.maxPos].x : -Infinity;
    if (board[res.finalPos].x > curMaxX) patch.maxPos = res.finalPos;
  }
  nt[idx] = { ...team, ...patch };
  const movePath = res.path.length > 1
    ? [{ teamIndex: idx, waypoints: res.path.map((id) => ({ x: board[id].x, y: board[id].y })), type: 'forward' }]
    : null;
  set({ teams: nt, ...(movePath ? { movePath } : {}) });
  if (allowJunction && res.stoppedAtJunction) {
    set({ awaitingChoice: true, pendingMove: { remaining: res.remaining, noLanding: true, resumeEngine: true, teamIndex: idx } });
    return { suspended: true };
  }
  return { moved: true, finalPos: res.finalPos, applied: n };
}

function applyMoney(set, get, action, ctx, indices) {
  if (!indices || !indices.length) return; // ex. randomOpponent sans adversaire : rien à faire
  const { teams, addLog } = get();
  const src = ctx.sourceTeam ?? 0;
  // Bénéficiaire d'un vol : le POSEUR du piège si défini (ctx.ownerTeam), sinon
  // la source de l'effet (lanceur du consommable/pouvoir). Évite le « vol de soi
  // à soi » d'un piège dont la cible est « celui qui marche dessus » (= la source).
  const stealRecipient = ctx.ownerTeam ?? src;
  const nt = [...teams];
  // Étiquette de la base d'un montant (formule de dé/échelle, ou « X% de son or »).
  const baseLabel = action.unit === 'percent'
    ? tg('log.fx.percentOfGold', { prefix: action.formula ? action.formula + ' = ' : '', n: action.n })
    : (action.formula || null);
  const amountFor = (team) => {
    if (action.unit === 'percent') return Math.floor((team.money ?? 0) * (action.n / 100));
    return action.n;
  };
  if (action.mode === 'steal') {
    for (const i of indices) {
      if (i === stealRecipient) continue;
      const victim = nt[i];
      // Immunité au vol d'or : tirée UNE SEULE FOIS ici. On enchaîne ensuite sur
      // applyStealProtection (pourcentage seul) plutôt que reducedSteal, qui
      // re-testerait l'immunité et rejouerait sa probabilité (double tirage).
      if (isGoldStealImmune(victim)) {
        addLog(tg('log.fx.goldImmune', { emoji: victim.emoji, name: victim.name }));
        announce(set, get, '🔒', tg('log.fx.goldImmune.toast', { name: victim.name }), '#c8911f');
        continue;
      }
      const wanted = amountFor(victim);
      const purse = victim.money ?? 0;
      // Bourse vide : rien à prendre — le dire (sinon le journal écrit « vole 0 pièce »).
      if (wanted > 0 && purse <= 0) {
        addLog(tg('log.fx.stealEmpty', { emoji: nt[stealRecipient].emoji, vemoji: victim.emoji, vname: victim.name }));
        announce(set, get, '💸', tg('log.fx.stealEmpty.toast', { vname: victim.name }), '#c8911f');
        continue;
      }
      const raw = Math.min(wanted, purse);
      const stolen = applyStealProtection(victim, raw);
      if (stolen <= 0) {
        // Protection 100 % (raw > 0) ou montant arrondi à 0 (ex. % d'une petite bourse).
        addLog(raw > 0
          ? tg('log.fx.stealBlocked', { vemoji: victim.emoji, vname: victim.name })
          : tg('log.fx.stealNone', { emoji: nt[stealRecipient].emoji, vemoji: victim.emoji, vname: victim.name }));
        continue;
      }
      nt[i] = { ...victim, money: Math.max(0, purse - stolen) };
      nt[stealRecipient] = { ...nt[stealRecipient], money: (nt[stealRecipient].money ?? 0) + stolen };
      // Assurance : la victime récupère un % de l'or volé.
      const insS = insurancePct(victim);
      if (insS > 0) { const back = Math.floor((stolen * insS) / 100); if (back > 0) { nt[i] = { ...nt[i], money: (nt[i].money ?? 0) + back }; addLog(tg('log.fx.insurance', { emoji: victim.emoji, name: victim.name, n: back })); } }
      // Détail : montant visé, bourse insuffisante, protection éventuelle, butin réel.
      const cappedByPurse = wanted > purse;
      const detail = [];
      if (baseLabel) detail.push({ label: tg('log.fx.detail.stealPlanned'), note: baseLabel });
      if (cappedByPurse) detail.push({ label: tg('log.fx.detail.purseOf', { name: victim.name }), note: `${purse} 🪙` });
      if (stolen < raw) detail.push({ label: tg('log.fx.detail.protectionOf', { name: victim.name }), note: `−${raw - stolen} 🪙` });
      if (detail.length) detail.push({ label: tg('log.fx.detail.coinsStolen'), amount: stolen });
      addLog({
        // Bourse vidée intégralement : le dire dans le texte principal (vol partiel visible).
        text: cappedByPurse && stolen === purse
          ? tgPlural('log.fx.stealAll', stolen, { emoji: nt[stealRecipient].emoji, n: stolen, want: wanted, vemoji: victim.emoji, vname: victim.name })
          : tgPlural('log.fx.steal', stolen, { emoji: nt[stealRecipient].emoji, n: stolen, vemoji: victim.emoji, vname: victim.name }),
        detail: detail.length ? detail : undefined,
      });
      // Bouclier d'épines de la victime : l'attaquant (bénéficiaire du vol) perd en
      // retour un % de l'or volé. Sans objet pour un vol de soi-même.
      const th = thornsPct(victim);
      if (th > 0 && stealRecipient !== i) {
        const back = Math.min(nt[stealRecipient].money ?? 0, Math.floor((stolen * th) / 100));
        if (back > 0) {
          nt[stealRecipient] = { ...nt[stealRecipient], money: (nt[stealRecipient].money ?? 0) - back };
          get().emitCurseVfx?.(stealRecipient, { icon: '🌵', color: '#2f9d5a', tone: 'malus' });
          addLog(tg('log.fx.thorns', { vemoji: victim.emoji, vname: victim.name, aemoji: nt[stealRecipient].emoji, aname: nt[stealRecipient].name, n: back }));
        }
      }
    }
  } else if (action.mode === 'lose') {
    for (const i of indices) {
      const t = nt[i];
      // Une perte SUBIE (pas une dépense de soi) est bloquée par l'immunité au vol d'or.
      if (i !== src && isGoldStealImmune(t)) {
        addLog(tg('log.fx.goldImmune', { emoji: t.emoji, name: t.name }));
        continue;
      }
      const wanted = amountFor(t);
      const purse = t.money ?? 0;
      const lossRaw = i === src ? wanted : reducedSteal(t, wanted);
      // Plafonner à la bourse : le journal doit refléter la perte RÉELLE
      // (avant : « perd 5 pièces » alors que la bourse était à 0).
      const loss = Math.min(lossRaw, purse);
      nt[i] = { ...t, money: Math.max(0, purse - loss) };
      // Assurance : perte SUBIE (pas une dépense de soi) partiellement remboursée.
      if (i !== src && loss > 0) { const insL = insurancePct(t); if (insL > 0) { const back = Math.floor((loss * insL) / 100); if (back > 0) { nt[i] = { ...nt[i], money: (nt[i].money ?? 0) + back }; addLog(tg('log.fx.insurance', { emoji: t.emoji, name: t.name, n: back })); } } }
      if (loss > 0) {
        const detail = [];
        if (baseLabel) detail.push({ label: tg('log.fx.detail.lossPlanned'), note: baseLabel });
        if (lossRaw > purse) detail.push({ label: tg('log.fx.detail.purseOf', { name: t.name }), note: `${purse} 🪙` });
        if (lossRaw < wanted) detail.push({ label: tg('log.fx.detail.protection'), note: `−${wanted - lossRaw} 🪙` });
        if (detail.length) detail.push({ label: tg('log.fx.detail.coinsLost'), amount: -loss });
        addLog({
          text: lossRaw > purse
            ? tgPlural('log.fx.loseAll', loss, { emoji: t.emoji, name: t.name, n: loss, want: wanted })
            : tgPlural('log.fx.lose', loss, { emoji: t.emoji, name: t.name, n: loss }),
          detail: detail.length ? detail : undefined,
        });
      } else if (wanted > 0) {
        // Rien perdu : dire pourquoi (bourse déjà vide, ou protection totale).
        addLog(purse <= 0
          ? tg('log.fx.loseEmpty', { emoji: t.emoji, name: t.name, want: wanted })
          : tg('log.fx.stealBlocked', { vemoji: t.emoji, vname: t.name }));
      }
    }
  } else if (action.mode === 'give') {
    // La SOURCE distribue de l'or : chaque cible reçoit `n`, la source paie le total.
    let total = 0;
    for (const i of indices) {
      if (i === src) continue;
      const t = nt[i];
      const amt = amountFor(t);
      nt[i] = { ...t, money: (t.money ?? 0) + amt };
      total += amt;
      addLog(tgPlural('log.fx.give', amt, { emoji: t.emoji, name: t.name, n: amt }));
    }
    if (total > 0) nt[src] = { ...nt[src], money: Math.max(0, (nt[src].money ?? 0) - total) };
  } else { // gain
    for (const i of indices) {
      const t = nt[i];
      const amt = amountFor(t);
      nt[i] = { ...t, money: (t.money ?? 0) + amt };
      addLog({
        text: tgPlural('log.fx.gain', amt, { emoji: t.emoji, name: t.name, n: amt }),
        detail: baseLabel ? [{ label: baseLabel, amount: amt }] : undefined,
      });
    }
  }
  set({ teams: nt });
}

function applyReroll(set, get, action, ctx) {
  const { showQuestion, questions, askedQuestions, addLog } = get();
  let subject = action.subject || 'same';

  // Pas de question ouverte (ex. déclencheur « Selon le dé » qui se déclenche
  // AVANT l'atterrissage) : on FORCE le thème de la prochaine question du tour.
  if (!showQuestion?.question) {
    if (subject === 'same') return { done: true }; // rien à forcer sans question courante
    if (subject === 'choose') {
      if (ctx.subject == null) return { suspend: 'subjectPicker' };
      subject = ctx.subject;
    }
    set({ forcedSubject: subject });
    const sname0 = loc(SUBJECTS[subject], 'name') || subject;
    addLog(tg('log.fx.forcedNext', { subject: sname0 }));
    announce(set, get, SUBJECTS[subject]?.icon || '🔄', tg('log.fx.forcedNext.toast', { subject: sname0 }), '#8745d4');
    return { done: true };
  }

  if (subject === 'same') subject = showQuestion.subject;
  else if (subject === 'choose') {
    if (ctx.subject == null) return { suspend: 'subjectPicker' };
    subject = ctx.subject;
  }
  const pool = questions[subject] || [];
  const asked = askedQuestions[subject] || new Set();
  const result = pickQuestion(pool, asked);
  if (!result) { addLog(tg('log.fx.noQuestionIn', { subject: loc(SUBJECTS[subject], 'name') || subject })); return { done: true }; }
  // Nouvelle question → nouveau chrono (deadline) + sélection/révélation remises
  // à zéro (l'horloge et l'état de réponse vivent dans le store).
  const nsq = { ...showQuestion, question: result.question, subject, index: result.index };
  set({
    showQuestion: { ...nsq, deadline: Date.now() + questionDuration(nsq) * 1000, selected: null, answerRevealed: false, timeLeftAtReveal: null },
    askedQuestions: { ...askedQuestions, [subject]: result.newAsked },
    indiceUsed: false, indiceHidden: [], rerollUsed: true,
  });
  const sname1 = loc(SUBJECTS[subject], 'name') || subject;
  addLog(tg('log.fx.newQuestion', { icon: SUBJECTS[subject]?.icon || '', subject: sname1 }));
  announce(set, get, SUBJECTS[subject]?.icon || '🔄', tg('log.fx.newQuestion.toast', { subject: sname1 }), '#8745d4');
  return { done: true };
}

function rangeMatch(key, value) {
  if (key.includes('-')) {
    const [a, b] = key.split('-').map(Number);
    return value >= a && value <= b;
  }
  return Number(key) === value;
}

// Sélectionne la branche d'actions d'une table d6 pour une valeur (clé "N" ou "a-b").
export function d6Branch(table, value) {
  for (const key of Object.keys(table || {})) {
    if (rangeMatch(key, value)) return table[key] || [];
  }
  return [];
}

// --- Boucle de file ----------------------------------------------------

export function runEffects(set, get, actions, ctx = {}) {
  if (!actions || !actions.length) return;
  set({ pendingActions: { queue: [...actions], ctx: { trapDepth: 0, sourceTeam: get().currentTeam, ...ctx } } });
  runQueue(set, get);
}

export function runQueue(set, get) {
  let pa = get().pendingActions;
  if (!pa) return;
  let guard = 0;
  while (pa.queue.length && guard++ < 200) {
    const action = pa.queue[0];
    const r = stepHead(set, get, action, pa.ctx);
    if (r === 'suspend') return;        // interrupt posé, file en attente
    if (get().finished) { set({ pendingActions: null }); return; }
    // dépile la tête (et éventuelles actions injectées remplacent déjà la file)
    pa = get().pendingActions;
    if (!pa) return;
    set({ pendingActions: { ...pa, queue: pa.queue.slice(1) } });
    pa = get().pendingActions;
  }
  finishQueue(set, get);
}

// Traite l'action de tête. Retourne 'done' (appliquée → à dépiler) ou 'suspend'.
function stepHead(set, get, action, ctx) {
  // équipe source : sert à résoudre les quantités « à l'échelle » (série/précision)
  const srcTeam = get().teams[ctx.sourceTeam ?? get().currentTeam];
  switch (action.action) {
    case 'move': {
      // Reprise après un choix de jonction : le déplacement a déjà été complété
      // par chooseJunction, on dépile simplement l'action.
      if (ctx.junctionDone) { clearCtxResolution(set, get, 'junctionDone'); return 'done'; }
      const t = resolveTargets(get, action.target, ctx);
      if (t.needPicker) { postTargetPicker(set, get, action); return 'suspend'; }
      if (OFFENSIVE(action) && consumeFumigene(set, get, t.indices[0], action)) return 'done';
      const attackerIdx = ctx.sourceTeam ?? get().currentTeam;
      // Renvoi possible (recul vers une seule cible adverse → redirigé sur la source).
      let moveIndices = action.dir === 'back' ? applyReflection(set, get, action, ctx, t.indices).indices : t.indices;
      // Ancre : une équipe ancrée ne subit pas le recul FORCÉ par autrui.
      if (action.dir === 'back') {
        moveIndices = moveIndices.filter((idx) => {
          if (idx !== attackerIdx && isAnchored(get().teams[idx])) {
            const am = get().teams[idx];
            get().addLog(tg('log.fx.anchor', { emoji: am.emoji, name: am.name }));
            return false;
          }
          return true;
        });
      }
      // jonction seulement pour un move 'self' vers l'avant
      const allowJunction = action.target === 'self' && action.dir === 'forward';
      const n = resolveAmount(action.n, srcTeam); // un seul tir partagé par toutes les cibles
      const formula = fxFormula(action.n);
      let thornsBack = 0; // cases de recul renvoyées à l'attaquant (bouclier d'épines)
      for (const idx of moveIndices) {
        const res = applyMoveOne(set, get, idx, action.dir, n, allowJunction);
        if (res.suspended) return 'suspend';
        // Épines : un recul infligé à une cible qui en porte renvoie une part à l'attaquant.
        if (action.dir === 'back' && res.moved && idx !== attackerIdx) {
          const tp = thornsPct(get().teams[idx]);
          if (tp > 0) thornsBack += Math.floor(((res.applied ?? n) * tp) / 100);
        }
        // Journalise le déplacement (sinon seul un toast transitoire le montrait).
        if (res.moved) {
          const tm = get().teams[idx];
          const applied = res.applied ?? n;
          if (action.dir === 'back') {
            // Recul : la chaîne de bouclier (applyRecul) fournit déjà le détail.
            const detail = res.detail || (formula ? [{ label: formula, note: cases(n) }] : undefined);
            let text;
            if (applied <= 0) {
              text = res.absorbedBy === 'buff'
                ? tg('log.fx.reculBuff', { emoji: tm.emoji, name: tm.name })
                : res.absorbedBy === 'equip'
                  ? tg('log.fx.reculEquip', { emoji: tm.emoji, name: tm.name })
                  : tg('log.fx.reculFull', { emoji: tm.emoji, name: tm.name });
            } else {
              text = tgPlural('log.fx.back', applied, { emoji: tm.emoji, name: tm.name, n: applied, reduced: res.absorbedBy ? tg('log.fx.reduced') : '' });
            }
            get().addLog({ text, detail });
          } else {
            const detail = formula ? [{ label: formula, note: cases(applied) }] : undefined;
            get().addLog({ text: tgPlural('log.fx.forward', applied, { emoji: tm.emoji, name: tm.name, n: applied }), detail });
          }
        }
        if (res.finalPos && get().board[res.finalPos]?.type === 'arrivee') {
          get().addLog(tg('log.fx.reachFinish', { emoji: get().teams[idx].emoji, name: get().teams[idx].name }));
          set({ finished: true });
        }
      }
      // Riposte du bouclier d'épines : l'attaquant recule des cases accumulées.
      if (thornsBack > 0 && get().teams[attackerIdx]) {
        const rr = applyMoveOne(set, get, attackerIdx, 'back', thornsBack, false);
        if (rr.moved) {
          const am = get().teams[attackerIdx];
          const applied = rr.applied ?? thornsBack;
          get().addLog(tgPlural('log.fx.thornsRecul', applied, { emoji: am.emoji, name: am.name, n: applied }));
          get().emitCurseVfx?.(attackerIdx, { icon: '🌵', color: '#2f9d5a', tone: 'malus' });
          if (rr.finalPos && get().board[rr.finalPos]?.type === 'arrivee') set({ finished: true });
        }
      }
      announce(set, get, action.dir === 'back' ? '⬅️' : '➡️',
        tgPlural('log.fx.move.toast', n, { label: action.dir === 'back' ? tg('log.fx.move.back') : tg('log.fx.move.advance'), n, tag: dieTag(action.n) }),
        action.dir === 'back' ? '#c9472f' : '#5b8c3a');
      clearCtxResolution(set, get, 'targetTeam');
      return 'done';
    }
    case 'money': {
      const t = resolveTargets(get, action.target, ctx);
      if (t.needPicker) { postTargetPicker(set, get, action); return 'suspend'; }
      if (OFFENSIVE(action) && consumeFumigene(set, get, t.indices[0], action)) { clearCtxResolution(set, get, 'targetTeam'); return 'done'; }
      const mn = resolveAmount(action.n, srcTeam);
      // Renvoi : un vol/perte sur une seule cible adverse peut être retourné à la
      // source. Un VOL renvoyé devient une PERTE pour l'attaquant (il ne se vole
      // pas lui-même).
      const moneyRefl = applyReflection(set, get, action, ctx, t.indices);
      const moneyAct = { ...action, n: mn, formula: fxFormula(action.n) };
      if (moneyRefl.reflected && moneyAct.mode === 'steal') moneyAct.mode = 'lose';
      applyMoney(set, get, moneyAct, ctx, moneyRefl.indices);
      if (typeof action.n === 'string' || (action.n && typeof action.n === 'object')) {
        announce(set, get, '🎲', tg('log.fx.money.toast', { formula: diceLabel(action.n), n: mn, unit: action.unit === 'percent' ? tg('log.fx.unit.percent') : tg('log.fx.unit.gold') }), '#e8b117');
      }
      clearCtxResolution(set, get, 'targetTeam');
      return 'done';
    }
    case 'extraTime': {
      const et = resolveAmount(action.n, srcTeam);
      const sq = get().showQuestion;
      if (sq?.question) {
        // Question DÉJÀ ouverte (ex. déclencheur on:questionSubject) : prolonge la
        // question COURANTE — deadline (horloge du store) + itemBonusTime (échelle
        // du gain d'or dans answerQuestion).
        set({ showQuestion: { ...sq, itemBonusTime: (sq.itemBonusTime || 0) + et, ...(sq.deadline ? { deadline: sq.deadline + et * 1000 } : {}) } });
        get().addLog(tg('log.fx.extraTimeThis', { n: et }));
        announce(set, get, '⌛', tg('log.fx.extraTimeThis.toast', { n: et, tag: dieTag(action.n) }), '#3b6cb3');
      } else {
        patchSource(set, get, (t) => ({ itemTimerBonus: (t.itemTimerBonus || 0) + et }));
        get().emitCurseVfx?.(ctx.sourceTeam ?? get().currentTeam, { icon: '⌛', color: '#3b6cb3', tone: 'buff' });
        get().addLog(tg('log.fx.extraTimeNext', { n: et }));
        announce(set, get, '⌛', tg('log.fx.extraTimeNext.toast', { n: et, tag: dieTag(action.n) }), '#3b6cb3');
      }
      return 'done';
    }
    case 'stealTime': {
      // Vol de temps : chaque cible perd N s sur sa PROCHAINE question (via
      // itemTimerBonus négatif, borné par le plancher côté questionDuration) ; la
      // SOURCE gagne le TOTAL volé sur sa prochaine question. Cumulable : cible
      // 'allOthers' ⇒ N × (nb d'adversaires) pour la source. Montant configurable
      // (fixe/dé/échelle) — le dé est retiré INDÉPENDAMMENT pour chaque cible.
      const t = resolveTargets(get, action.target || 'target', ctx);
      if (t.needPicker) { postTargetPicker(set, get, action); return 'suspend'; }
      const thief = ctx.sourceTeam ?? get().currentTeam;
      const nt = [...get().teams];
      let total = 0;
      const victimNames = [];
      for (const idx of t.indices) {
        if (idx === thief) continue; // on ne se vole pas soi-même
        const each = Math.max(0, resolveAmount(action.n, srcTeam) || 0);
        if (each <= 0) continue;
        const v = nt[idx];
        nt[idx] = { ...v, itemTimerBonus: (v.itemTimerBonus || 0) - each };
        total += each;
        victimNames.push(`${v.emoji} ${v.name}`);
        get().emitCurseVfx?.(idx, { icon: '⏳', color: '#8a1f2e', tone: 'malus' });
      }
      if (total > 0) {
        nt[thief] = { ...nt[thief], itemTimerBonus: (nt[thief].itemTimerBonus || 0) + total };
        set({ teams: nt });
        get().emitCurseVfx?.(thief, { icon: '⏳', color: '#2f9d5a', tone: 'buff' });
        get().addLog(tg('log.fx.stealTime', { emoji: nt[thief].emoji, name: nt[thief].name, n: total, victims: victimNames.join(', ') }));
        announce(set, get, '⏳', tg('log.fx.stealTime.toast', { n: total, tag: dieTag(action.n) }), '#3b6cb3');
      } else {
        set({ teams: nt });
        get().addLog(tg('log.fx.stealTimeNone'));
      }
      clearCtxResolution(set, get, 'targetTeam');
      return 'done';
    }
    case 'hideWrong': {
      // Élimine N mauvaise(s) réponse(s) de la question COURANTE (façon Indice).
      // Sans effet s'il n'y a pas de question ouverte (ex. joué hors contexte).
      const sq = get().showQuestion;
      if (!sq?.question) return 'done';
      const q = sq.question;
      const already = get().indiceHidden || [];
      const wrong = q.a.map((_, i) => i).filter((i) => i !== q.c && !already.includes(i));
      if (!wrong.length) return 'done';
      for (let i = wrong.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [wrong[i], wrong[j]] = [wrong[j], wrong[i]];
      }
      const want = Math.max(1, resolveAmount(action.n, srcTeam) || 1);
      const picked = wrong.slice(0, Math.min(want, wrong.length));
      set({ indiceHidden: [...already, ...picked] });
      get().addLog(tgPlural('log.fx.hideWrong', picked.length, { n: picked.length }));
      announce(set, get, '💡', tgPlural('log.fx.hideWrong.toast', picked.length, { n: picked.length, tag: dieTag(action.n) }), '#c8911f');
      return 'done';
    }
    case 'shieldNext': {
      const sn = typeof action.n === 'number' ? (action.n || 1) : (resolveAmount(action.n, srcTeam) || 1);
      patchSource(set, get, (t) => ({ itemShield: (t.itemShield || 0) + sn }));
      get().emitCurseVfx?.(ctx.sourceTeam ?? get().currentTeam, { icon: '🛡️', color: '#3b6cb3', tone: 'buff' });
      get().addLog(tgPlural('log.fx.shieldNext', sn, { n: sn }));
      announce(set, get, '🛡️', tgPlural('log.fx.shieldNext.toast', sn, { n: sn, tag: dieTag(action.n) }), '#3b6cb3');
      return 'done';
    }
    case 'fumigene': {
      // `turns` optionnel : le fumigène expire après X tours (fixe/dé/échelle).
      // Absent ⇒ comportement historique (jusqu'à utilisation).
      const ft = action.turns != null ? resolveAmount(action.turns, srcTeam) : 0;
      patchSource(set, get, () => ({ itemFumigene: true, ...(ft > 0 ? { itemFumigeneTurns: ft } : {}) }));
      get().emitCurseVfx?.(ctx.sourceTeam ?? get().currentTeam, { icon: '💨', color: '#7a8a99', tone: 'buff' });
      get().addLog(ft > 0
        ? tgPlural('log.fx.fumigeneTurns', ft, { n: ft })
        : tg('log.fx.fumigeneUntil'));
      announce(set, get, '💨', tg('log.fx.fumigene.toast', { suffix: ft > 0 ? ` (${ft}T)` : '' }), '#7a8a99');
      return 'done';
    }
    case 'gainCharge': {
      if (ctx.chargeDone) { clearCtxResolution(set, get, 'chargeDone'); return 'done'; }
      // Aucun pouvoir à recharger : on saute (évite un sélecteur vide).
      const ct = get().teams[ctx.sourceTeam ?? get().currentTeam];
      if (!ct?.powers || Object.keys(ct.powers).length === 0) { get().addLog(tg('log.fx.noPowerToCharge')); return 'done'; }
      // Tous les pouvoirs déjà au plafond → aucune recharge possible (feedback).
      if (!Object.values(ct.powers).some((p) => (p?.charges ?? 0) < MAX_CHARGES)) { get().addLog(tg('log.fx.chargeNoEffect')); return 'done'; }
      // `amount` (Recharge de Forge) : 1 / 2 / 'full' charges à appliquer au pouvoir choisi.
      set({ showChargePicker: { source: 'engine', amount: action.n ?? 1 } });
      return 'suspend';
    }
    case 'rerollQuestion': {
      // Couche de probabilité optionnelle : chance% → thème principal, sinon →
      // elseSubject (ex. 50% thème choisi / 50% Hardcore). Le tirage est mémorisé
      // dans ctx (_rerollPick) pour survivre à une suspension SubjectPicker —
      // sinon le thème pourrait changer entre le clic et la reprise.
      // Un thème « aléatoire » (objet {random}) est tiré directement en thème
      // concret (le reroll propose déjà « au choix » pour piocher parmi tous).
      const norm = (s) => (s && typeof s === 'object' && s.random) ? pickRandomSubjects(get, s.pool, 1)[0] : s;
      const action0 = ((action.subject && typeof action.subject === 'object') || (action.elseSubject && typeof action.elseSubject === 'object'))
        ? { ...action, subject: norm(action.subject), elseSubject: norm(action.elseSubject) }
        : action;
      let act = action0;
      if (typeof action0.chance === 'number') {
        let pick = ctx._rerollPick;
        if (pick == null) {
          pick = Math.random() < action0.chance ? (action0.subject || 'same') : (action0.elseSubject || 'hardcore');
          ctx._rerollPick = pick;
          const pa = get().pendingActions;
          if (pa) set({ pendingActions: { ...pa, ctx: { ...pa.ctx, _rerollPick: pick } } });
        }
        act = { ...action0, subject: pick };
      }
      const r = applyReroll(set, get, act, ctx);
      if (r.suspend === 'subjectPicker') { set({ showSubjectPicker: true }); return 'suspend'; }
      clearCtxResolution(set, get, 'subject');
      clearCtxResolution(set, get, '_rerollPick');
      return 'done';
    }
    case 'forceSubject': {
      // Force le THÈME de la prochaine question d'une (ou plusieurs) équipe(s).
      // Stocké par équipe (team.forcedSubject), consommé à leur prochain askQuestion.
      const t = resolveTargets(get, action.target, ctx);
      if (t.needPicker) { postTargetPicker(set, get, action); return 'suspend'; }
      // Thème : fixe, ou aléatoire (sans choix / à N choix via picker limité).
      const rs = resolveSubjectSpec(set, get, ctx, action.subject, 'forceSubject');
      if (rs.suspend) return 'suspend';
      const subj = rs.subject;
      const nt = [...get().teams];
      for (const idx of t.indices) nt[idx] = { ...nt[idx], forcedSubject: subj };
      set({ teams: nt });
      const sname = loc(SUBJECTS[subj], 'name') || subj;
      const whoLabel = action.target === 'self' ? tg('log.fx.who.self') : tg('log.fx.who.target');
      get().addLog(tg('log.fx.forceSubject', { icon: SUBJECTS[subj]?.icon || '', who: whoLabel, subject: sname }));
      announce(set, get, SUBJECTS[subj]?.icon || '🎯', tg('log.fx.forceSubject.toast', { subject: sname }), SUBJECTS[subj]?.color || '#8745d4');
      clearCtxResolution(set, get, 'targetTeam');
      clearCtxResolution(set, get, 'subject');
      clearCtxResolution(set, get, '_subjChoices');
      return 'done';
    }
    case 'askFlag': {
      // « Poser une question sur un drapeau » : force une question du thème
      // « Drapeaux & symboles » (drapeaux à identifier + symboles) sur la ou les
      // cibles. C'est un forceSubject préréglé (consommé au prochain askQuestion).
      // Le thème `drapeaux_symboles` regroupe désormais les 388 questions à IMAGE
      // ET les questions texte de culture G (fusion 2026-07-12).
      const t = resolveTargets(get, action.target, ctx);
      if (t.needPicker) { postTargetPicker(set, get, action); return 'suspend'; }
      const subj = 'drapeaux_symboles';
      const nt = [...get().teams];
      for (const idx of t.indices) nt[idx] = { ...nt[idx], forcedSubject: subj };
      set({ teams: nt });
      const whoLabel = action.target === 'self' ? tg('log.fx.who.self') : tg('log.fx.who.target');
      get().addLog(tg('log.fx.askFlag', { who: whoLabel }));
      announce(set, get, SUBJECTS[subj]?.icon || '🚩', tg('log.fx.askFlag.toast'), SUBJECTS[subj]?.color || '#c0392b');
      clearCtxResolution(set, get, 'targetTeam');
      return 'done';
    }
    case 'randomPathNext': {
      // Rend ALÉATOIRE le prochain choix de voie (carrefour) d'une ou plusieurs
      // équipes. Flag one-shot par équipe (team.randomPathNext), consommé au
      // premier carrefour atteint (gameStore.resolvePostRoll).
      const t = resolveTargets(get, action.target, ctx);
      if (t.needPicker) { postTargetPicker(set, get, action); return 'suspend'; }
      const nt = [...get().teams];
      for (const idx of t.indices) nt[idx] = { ...nt[idx], randomPathNext: true };
      set({ teams: nt });
      const whoLabel = action.target === 'self' ? tg('log.fx.path.self')
        : action.target === 'all' ? tg('log.fx.path.all')
        : tg('log.fx.path.target');
      get().addLog(tg('log.fx.randomPath', { who: whoLabel }));
      announce(set, get, '🎲', tg('log.fx.randomPath.toast', { who: whoLabel }), '#8745d4');
      clearCtxResolution(set, get, 'targetTeam');
      return 'done';
    }
    case 'teleportFurthest': {
      // Téléporte la/les cible(s) sur la case la PLUS AVANCÉE (par x) qu'elles
      // aient déjà atteinte (team.maxPos). Sans effet si déjà au plus loin.
      const t = resolveTargets(get, action.target, ctx);
      if (t.needPicker) { postTargetPicker(set, get, action); return 'suspend'; }
      const { board, teams } = get();
      const nt = [...teams];
      let movePath = null; let moved = false;
      for (const idx of t.indices) {
        const tm = nt[idx];
        const best = tm.maxPos && board[tm.maxPos] ? tm.maxPos : tm.pos;
        if (best !== tm.pos && board[best] && board[best].x > (board[tm.pos]?.x ?? -Infinity)) {
          movePath = [{ teamIndex: idx, waypoints: [{ x: board[tm.pos].x, y: board[tm.pos].y }, { x: board[best].x, y: board[best].y }], type: 'forward' }];
          nt[idx] = { ...tm, pos: best };
          moved = true;
          get().addLog(tg('log.fx.teleport', { emoji: tm.emoji, name: tm.name }));
          if (board[best].type === 'arrivee') { get().addLog(tg('log.fx.reachFinish', { emoji: tm.emoji, name: tm.name })); }
        }
      }
      set({ teams: nt, ...(movePath ? { movePath } : {}) });
      if (moved && nt.some((tm) => board[tm.pos]?.type === 'arrivee')) set({ finished: true });
      announce(set, get, '✨', moved ? tg('log.fx.teleport.done') : tg('log.fx.teleport.already'), '#8745d4');
      clearCtxResolution(set, get, 'targetTeam');
      return 'done';
    }
    case 'swapPositions': {
      // Échange de place : permute la position de la SOURCE avec celle d'une cible.
      const t = resolveTargets(get, action.target || 'target', ctx);
      if (t.needPicker) { postTargetPicker(set, get, action); return 'suspend'; }
      const swSrc = ctx.sourceTeam ?? get().currentTeam;
      const other = t.indices[0];
      const { board, teams } = get();
      if (other == null || other === swSrc || !teams[swSrc] || !teams[other]) { clearCtxResolution(set, get, 'targetTeam'); return 'done'; }
      const a = teams[swSrc], b = teams[other];
      // Ancre : une cible ancrée ne peut être échangée de force.
      if (isAnchored(b)) {
        get().addLog(tg('log.fx.anchor', { emoji: b.emoji, name: b.name }));
        clearCtxResolution(set, get, 'targetTeam');
        return 'done';
      }
      const posA = a.pos, posB = b.pos;
      if (posA === posB || !board[posA] || !board[posB]) { clearCtxResolution(set, get, 'targetTeam'); return 'done'; }
      const nt = [...teams];
      nt[swSrc] = { ...a, pos: posB };
      nt[other] = { ...b, pos: posA };
      const wp = (from, to) => ({ waypoints: [{ x: board[from].x, y: board[from].y }, { x: board[to].x, y: board[to].y }], type: board[to].x >= board[from].x ? 'forward' : 'back' });
      set({ teams: nt, movePath: [{ teamIndex: swSrc, ...wp(posA, posB) }, { teamIndex: other, ...wp(posB, posA) }] });
      get().addLog(tg('log.fx.swap', { aemoji: a.emoji, aname: a.name, bemoji: b.emoji, bname: b.name }));
      announce(set, get, '🔀', tg('log.fx.swap.toast', { aname: a.name, bname: b.name }), '#8745d4');
      // Un pion propulsé sur l'arrivée par l'échange déclenche la victoire.
      if (board[posB]?.type === 'arrivee' || board[posA]?.type === 'arrivee') set({ finished: true });
      clearCtxResolution(set, get, 'targetTeam');
      return 'done';
    }
    case 'challenge': {
      // « Défi » : force MON prochain thème + mise un pari one-shot. La
      // récompense (do) est versée si je réponds juste à cette question, le
      // malus (else) si je rate/laisse filer le temps. Consommé par answerQuestion
      // / timeoutQuestion (team.wager).
      const rsC = resolveSubjectSpec(set, get, ctx, action.subject, 'challenge');
      if (rsC.suspend) return 'suspend';
      const subj = rsC.subject;
      patchSource(set, get, () => ({ forcedSubject: subj, wager: { do: action.do || [], else: action.else || [] } }));
      get().emitCurseVfx?.(ctx.sourceTeam ?? get().currentTeam, { icon: SUBJECTS[subj]?.icon || '🎲', color: SUBJECTS[subj]?.color || '#c8911f', tone: 'buff' });
      const sname = loc(SUBJECTS[subj], 'name') || subj;
      get().addLog(tg('log.fx.challenge', { subject: sname }));
      announce(set, get, SUBJECTS[subj]?.icon || '🎲', tg('log.fx.challenge.toast', { subject: sname }), SUBJECTS[subj]?.color || '#8a1f2e');
      clearCtxResolution(set, get, 'subject');
      clearCtxResolution(set, get, '_subjChoices');
      return 'done';
    }
    case 'startDuel': {
      // « Débute un duel » : l'équipe SOURCE défie une équipe adverse sur un
      // mini-jeu. Le thème suit la même spec que forceSubject/challenge (fixe /
      // aléatoire sans choix / à N choix via picker, pool = tous / partie / liste).
      // Le duel remplace la fin de tour : on le DIFFÈRE via `pendingDuel` et il
      // est lancé par launchPendingDuel() en sortie de file (finishQueue) — ce
      // qui neutralise proprement un éventuel pendingLanding (objet utilisé après
      // le lancer de dé). L'immunité au duel (duelImmune) protège la cible.
      const dt = resolveTargets(get, action.target || 'target', ctx);
      if (dt.needPicker) { postTargetPicker(set, get, action); return 'suspend'; }
      const dsrc = ctx.sourceTeam ?? get().currentTeam;
      const defenderIndex = dt.indices.find((i) => i !== dsrc);
      if (defenderIndex == null) {
        get().addLog(tg('log.fx.startDuel.noTarget'));
        clearCtxResolution(set, get, 'targetTeam');
        return 'done';
      }
      const defender = get().teams[defenderIndex];
      if (isDuelImmune(defender)) {
        get().addLog(tg('log.fx.startDuel.immune', { emoji: defender.emoji, name: defender.name }));
        announce(set, get, '🛡️', tg('log.fx.startDuel.immune.toast', { name: defender.name }), '#3b6cb3');
        clearCtxResolution(set, get, 'targetTeam');
        return 'done';
      }
      const rsD = resolveSubjectSpec(set, get, ctx, action.subject, 'startDuel');
      if (rsD.suspend) return 'suspend';
      const duelSubject = rsD.subject;
      set({ pendingDuel: { attackerIndex: dsrc, defenderIndex, subject: duelSubject } });
      const dname = duelSubject ? (loc(SUBJECTS[duelSubject], 'name') || duelSubject) : tg('log.fx.startDuel.randomSubject');
      const atk = get().teams[dsrc];
      get().addLog(tg('log.fx.startDuel', { emoji: atk.emoji, name: atk.name, target: `${defender.emoji} ${defender.name}`, subject: dname }));
      announce(set, get, '⚔️', tg('log.fx.startDuel.toast', { target: defender.name }), '#8a1f2e');
      clearCtxResolution(set, get, 'targetTeam');
      clearCtxResolution(set, get, 'subject');
      clearCtxResolution(set, get, '_subjChoices');
      return 'done';
    }
    case 'buff': {
      // Pose un effet de durée (X tours de l'équipe) sur la/les cible(s).
      const t = resolveTargets(get, action.target, ctx);
      if (t.needPicker) { postTargetPicker(set, get, action); return 'suspend'; }
      const src = action.buff || {};
      const turns = src.turns ?? 3;
      // Le DoT « saignement d'or » (bleedGold) est NÉGATIF : il peut être renvoyé
      // à l'attaquant s'il vise une seule équipe adverse qui a une chance de renvoi.
      const buffIndices = src.type === 'bleedGold'
        ? applyReflection(set, get, { action: 'buff', __dot: true }, ctx, t.indices).indices
        : t.indices;
      // `from` = source de l'effet (bénéficiaire d'un éventuel vol par tour) ;
      // `mode` ('steal'|'lose') ne sert qu'aux DoT d'or.
      const from = ctx.sourceTeam ?? get().currentTeam;
      const nt = [...get().teams];
      for (const idx of buffIndices) {
        const cur = nt[idx];
        nt[idx] = { ...cur, buffs: [...(cur.buffs || []), { type: src.type, turns, n: src.n, subject: src.subject, mode: src.mode, from }] };
      }
      set({ teams: nt });
      // Aura visuelle : icône/couleur/ton réels du buff (un DoT comme bleedGold
      // ressort en malus rouge, un vrai bonus en vert/sa couleur propre).
      const bi = BUFF_INFO[src.type];
      if (bi) {
        const tone = typeof bi.tone === 'function'
          ? bi.tone({ type: src.type, turns, n: src.n, subject: src.subject, mode: src.mode })
          : bi.tone;
        const color = tone === 'malus' ? '#8a1f2e' : (bi.color || '#2f9d5a');
        for (const idx of buffIndices) get().emitCurseVfx?.(idx, { icon: bi.icon, color, tone });
      }
      get().addLog(tgPlural('log.fx.buff', turns, { n: turns }));
      clearCtxResolution(set, get, 'targetTeam');
      return 'done';
    }
    case 'loot': {
      // Loot immédiat d'un objet (catégorie optionnelle) pour l'équipe source.
      if (get().engineLoot) get().engineLoot(ctx.sourceTeam ?? get().currentTeam, action.category);
      return 'done';
    }
    case 'startMinigame': {
      // Défi Curioscope en SOLO : l'équipe source joue N manches de guessr
      // (CurioChallengeModal), la file est suspendue, puis le total de points
      // est converti par PALIERS bornés `tiers: [{ min, kind, n }]` avec
      // kind ∈ 'money'|'move'|'loot'|'none' — compilés ici en actions moteur
      // injectées en tête de file (elles se journalisent elles-mêmes).
      const src = ctx.sourceTeam ?? get().currentTeam;
      const t = get().teams[src];
      if (!t) return 'done';
      if (ctx._curioPoints != null) {
        // Reprise : la modale a rendu son total de points.
        const pts = ctx._curioPoints;
        clearCtxResolution(set, get, '_curioPoints');
        get().addLog(tg('log.fx.curio.score', { emoji: t.emoji, name: t.name, pts }));
        const tiers = [...(action.tiers || [])].sort((x, y) => (y.min || 0) - (x.min || 0));
        const tier = tiers.find((ti) => pts >= (ti.min || 0));
        if (!tier || !tier.kind || tier.kind === 'none') {
          announce(set, get, '\u{1F52D}', tg('log.fx.curio.noReward'), '#8a6d3b');
          return 'done';
        }
        announce(set, get, '\u{1F52D}', tg('log.fx.curio.toast', { pts }), '#2f9d5a');
        const doActs = tier.kind === 'money' ? [{ action: 'money', mode: 'gain', target: 'self', n: tier.n || 0, unit: 'flat' }]
          : tier.kind === 'move' ? [{ action: 'move', target: 'self', dir: 'forward', n: tier.n || 0 }]
            : tier.kind === 'loot' ? [{ action: 'loot' }] : [];
        if (doActs.length) {
          const pa = get().pendingActions;
          set({ pendingActions: { ...pa, queue: [pa.queue[0], ...doActs, ...pa.queue.slice(1)] } });
        }
        return 'done';
      }
      // Bots et mode en ligne : le défi se joue au TBI local — sauté proprement.
      if (t.isBot || get().connectionMode === 'online') {
        get().addLog(tg('log.fx.curio.skip', { emoji: t.emoji, name: t.name }));
        return 'done';
      }
      set({
        showCurioChallenge: {
          teamIndex: src,
          universes: (Array.isArray(action.universes) && action.universes.length) ? action.universes : ['monde_reel'],
          rounds: Math.max(1, action.rounds || 1),
        },
      });
      return 'suspend';
    }
    // --- Actions Alchimie / Enchantement (événements dédiés) ---
    case 'grantItem': {
      // Donne un OBJET précis (action.key) à la/les cible(s). Révélation pour la source.
      const t = resolveTargets(get, action.target || 'self', ctx);
      if (t.needPicker) { postTargetPicker(set, get, action); return 'suspend'; }
      const src = ctx.sourceTeam ?? get().currentTeam;
      for (const idx of t.indices) get().engineGrantItem?.(idx, action.key, { reveal: idx === src, title: action.title });
      clearCtxResolution(set, get, 'targetTeam');
      return 'done';
    }
    case 'grantIngredient': {
      const t = resolveTargets(get, action.target || 'self', ctx);
      if (t.needPicker) { postTargetPicker(set, get, action); return 'suspend'; }
      for (const idx of t.indices) get().engineGrantIngredient?.(idx, action.n || 1);
      clearCtxResolution(set, get, 'targetTeam');
      return 'done';
    }
    case 'discoverRecipe': {
      const t = resolveTargets(get, action.target || 'self', ctx);
      if (t.needPicker) { postTargetPicker(set, get, action); return 'suspend'; }
      for (const idx of t.indices) get().engineDiscoverRecipe?.(idx, action.recipe);
      clearCtxResolution(set, get, 'targetTeam');
      return 'done';
    }
    case 'enchantEquipped': {
      const t = resolveTargets(get, action.target || 'self', ctx);
      if (t.needPicker) { postTargetPicker(set, get, action); return 'suspend'; }
      for (const idx of t.indices) get().engineEnchantEquipped?.(idx, action.specs, action.slot);
      clearCtxResolution(set, get, 'targetTeam');
      return 'done';
    }
    case 'unenchant': {
      const t = resolveTargets(get, action.target || 'self', ctx);
      if (t.needPicker) { postTargetPicker(set, get, action); return 'suspend'; }
      for (const idx of t.indices) get().engineUnenchant?.(idx);
      clearCtxResolution(set, get, 'targetTeam');
      return 'done';
    }
    // --- Actions Magie (extension « magic ») ---
    case 'gainMagic': {
      const t = resolveTargets(get, action.target || 'self', ctx);
      if (t.needPicker) { postTargetPicker(set, get, action); return 'suspend'; }
      const n = Math.max(1, resolveAmount(action.n, srcTeam) || 10);
      for (const idx of t.indices) get().engineGainMagic?.(idx, n);
      clearCtxResolution(set, get, 'targetTeam');
      return 'done';
    }
    case 'learnRune': {
      // Révèle une rune au codex (précise via action.rune, sinon une inconnue au hasard).
      const t = resolveTargets(get, action.target || 'self', ctx);
      if (t.needPicker) { postTargetPicker(set, get, action); return 'suspend'; }
      for (const idx of t.indices) get().engineLearnRune?.(idx, action.rune);
      clearCtxResolution(set, get, 'targetTeam');
      return 'done';
    }
    case 'learnSpell': {
      // Révèle un sort au codex (précis via action.spell, sinon un inconnu au hasard).
      const t = resolveTargets(get, action.target || 'self', ctx);
      if (t.needPicker) { postTargetPicker(set, get, action); return 'suspend'; }
      for (const idx of t.indices) get().engineLearnSpell?.(idx, action.spell);
      clearCtxResolution(set, get, 'targetTeam');
      return 'done';
    }
    case 'blessFace': {
      // Bénit une face du dé de la cible : +or quand cette face tombe. La face
      // vient de l'action, du contexte (choisie au téléphone avant le cast) ou
      // est tirée au hasard (« magie sauvage » des découvertes expérimentales).
      const t = resolveTargets(get, action.target || 'self', ctx);
      if (t.needPicker) { postTargetPicker(set, get, action); return 'suspend'; }
      const face = action.face ?? ctx.face ?? (1 + Math.floor(Math.random() * 6));
      const gold = Math.max(1, resolveAmount(action.n, srcTeam) || 10);
      for (const idx of t.indices) get().engineMarkFace?.(idx, face, 'bless', gold, ctx.sourceTeam ?? get().currentTeam);
      clearCtxResolution(set, get, 'targetTeam');
      return 'done';
    }
    case 'curseFace': {
      // Maudit une face du dé de la cible : −or quand cette face tombe. Renvoi possible.
      const t = resolveTargets(get, action.target || 'target', ctx);
      if (t.needPicker) { postTargetPicker(set, get, action); return 'suspend'; }
      const face = action.face ?? ctx.face ?? (1 + Math.floor(Math.random() * 6));
      const gold = Math.max(1, resolveAmount(action.n, srcTeam) || 10);
      const curseFaceIdx = applyReflection(set, get, action, ctx, t.indices).indices;
      for (const idx of curseFaceIdx) get().engineMarkFace?.(idx, face, 'curse', gold, ctx.sourceTeam ?? get().currentTeam);
      clearCtxResolution(set, get, 'targetTeam');
      return 'done';
    }
    case 'cleanseFaces': {
      // Dissipe les bénédictions/malédictions du dé (scope 'bless'|'curse'|'all').
      const t = resolveTargets(get, action.target || 'self', ctx);
      if (t.needPicker) { postTargetPicker(set, get, action); return 'suspend'; }
      for (const idx of t.indices) get().engineCleanseFaces?.(idx, action.scope || 'all');
      clearCtxResolution(set, get, 'targetTeam');
      return 'done';
    }
    case 'unstableAnswers': {
      // Réponses instables : à la PROCHAINE question de la cible, les réponses
      // changent de place toutes les `interval` s (réutilise le Modeleur du
      // Sablier : flag modeleurInterval consommé par askQuestion). Si la météo
      // « sablier » a déjà posé un intervalle, on garde le plus AGRESSIF (min).
      const t = resolveTargets(get, action.target || 'target', ctx);
      if (t.needPicker) { postTargetPicker(set, get, action); return 'suspend'; }
      const interval = Math.max(1, action.interval || 3);
      const unstableIdx = applyReflection(set, get, action, ctx, t.indices).indices;
      const nt = [...get().teams];
      for (const idx of unstableIdx) nt[idx] = { ...nt[idx], modeleurInterval: Math.min(nt[idx].modeleurInterval || 99, interval) };
      set({ teams: nt });
      for (const idx of unstableIdx) get().emitCurseVfx?.(idx, { icon: '🌫️', color: '#8745d4', tone: 'malus' });
      get().addLog(tg('log.fx.unstable', { n: interval }));
      announce(set, get, '🌫️', tg('log.fx.unstable.toast'), '#8745d4');
      clearCtxResolution(set, get, 'targetTeam');
      return 'done';
    }
    case 'loseItem': {
      // Retire un objet (catégorie optionnelle) à la/les cible(s) ; repli sur l'or.
      const t = resolveTargets(get, action.target, ctx);
      if (t.needPicker) { postTargetPicker(set, get, action); return 'suspend'; }
      const loseIdx = applyReflection(set, get, action, ctx, t.indices).indices;
      for (const idx of loseIdx) get().engineLoseItem?.(idx, action.category, action.fallbackGold, action.family);
      clearCtxResolution(set, get, 'targetTeam');
      return 'done';
    }
    case 'stealItem': {
      // Vol d'objet ciblé : la SOURCE prend un objet au hasard à la/les cible(s).
      const t = resolveTargets(get, action.target || 'target', ctx);
      if (t.needPicker) { postTargetPicker(set, get, action); return 'suspend'; }
      const thief = ctx.sourceTeam ?? get().currentTeam;
      for (const idx of t.indices) if (idx !== thief) get().engineStealItem?.(thief, idx, action.category, action.family, action.fallbackGold);
      clearCtxResolution(set, get, 'targetTeam');
      return 'done';
    }
    case 'stealCharge': {
      // Vol de charge : prend 1 charge de pouvoir à une cible (au hasard parmi ses
      // pouvoirs chargés) et l'ajoute à un pouvoir du voleur sous le plafond.
      const t = resolveTargets(get, action.target || 'target', ctx);
      if (t.needPicker) { postTargetPicker(set, get, action); return 'suspend'; }
      const thief = ctx.sourceTeam ?? get().currentTeam;
      const victimIdx = t.indices[0];
      if (victimIdx == null || victimIdx === thief) { clearCtxResolution(set, get, 'targetTeam'); return 'done'; }
      const nt = [...get().teams];
      const victim = nt[victimIdx];
      const vPowers = Object.entries(victim.powers || {}).filter(([, p]) => (p?.charges ?? 0) > 0);
      if (!vPowers.length) {
        get().addLog(tg('log.fx.stealChargeNone', { emoji: victim.emoji, name: victim.name }));
        clearCtxResolution(set, get, 'targetTeam'); return 'done';
      }
      const [vKey, vPow] = vPowers[Math.floor(Math.random() * vPowers.length)];
      nt[victimIdx] = { ...victim, powers: { ...victim.powers, [vKey]: { ...vPow, charges: vPow.charges - 1 } } };
      const thiefT = nt[thief];
      const cand = (thiefT.powers?.[vKey] && (thiefT.powers[vKey].charges ?? 0) < MAX_CHARGES) ? vKey
        : Object.keys(thiefT.powers || {}).find((k) => (thiefT.powers[k].charges ?? 0) < MAX_CHARGES);
      if (cand) {
        nt[thief] = { ...thiefT, powers: { ...thiefT.powers, [cand]: { ...thiefT.powers[cand], charges: (thiefT.powers[cand].charges ?? 0) + 1 } } };
        get().addLog(tg('log.fx.stealCharge', { aemoji: thiefT.emoji, aname: thiefT.name, vemoji: victim.emoji, vname: victim.name }));
      } else {
        get().addLog(tg('log.fx.stealChargeDrain', { aemoji: thiefT.emoji, aname: thiefT.name, vemoji: victim.emoji, vname: victim.name }));
      }
      set({ teams: nt });
      get().emitCurseVfx?.(victimIdx, { icon: '⚡', color: '#8a1f2e', tone: 'malus' });
      clearCtxResolution(set, get, 'targetTeam');
      return 'done';
    }
    case 'bounty': {
      // Prime : pose une prime sur une cible ; sa prochaine mauvaise réponse /
      // temps écoulé rapporte `n` or à la SOURCE (bountyBy/bountyGold sur la cible).
      const t = resolveTargets(get, action.target || 'target', ctx);
      if (t.needPicker) { postTargetPicker(set, get, action); return 'suspend'; }
      const src = ctx.sourceTeam ?? get().currentTeam;
      const gold = Math.max(1, resolveAmount(action.n, srcTeam) || 10);
      const nt = [...get().teams];
      for (const idx of t.indices) if (idx !== src) nt[idx] = { ...nt[idx], bountyBy: src, bountyGold: gold };
      set({ teams: nt });
      get().addLog(tg('log.fx.bounty', { n: gold }));
      announce(set, get, '🎯', tg('log.fx.bounty.toast', { n: gold }), '#c8911f');
      clearCtxResolution(set, get, 'targetTeam');
      return 'done';
    }
    case 'invest': {
      // Investissement : l'équipe CHOISIT sa mise (1 → tout son or) via une modale
      // « bourse spatiale » ; remboursée à `rate` % à la prochaine bonne réponse
      // (perdue si erreur/temps écoulé). Le taux est en POURCENTS (200 % = ×2,
      // 150 % = +50 %…). Rétrocompat : ancien `mult` → rate = mult×100.
      const src = ctx.sourceTeam ?? get().currentTeam;
      const rate = investRate(action);
      const tm = get().teams[src];
      // Reprise après la modale : `_investAmount` = mise choisie (0 = refusé).
      if (ctx._investAmount != null) {
        const amount = ctx._investAmount;
        clearCtxResolution(set, get, '_investAmount');
        const pay = Math.max(0, Math.min(Math.round(amount), tm.money || 0));
        if (pay > 0) {
          const nt = [...get().teams];
          nt[src] = { ...tm, money: (tm.money || 0) - pay, investment: { stake: pay, rate } };
          set({ teams: nt });
          get().addLog(tg('log.fx.invest', { emoji: tm.emoji, name: tm.name, stake: pay, rate }));
          announce(set, get, '📈', tg('log.fx.invest.toast', { stake: pay, rate }), '#2f9d5a');
        }
        return 'done';
      }
      const gold = tm.money || 0;
      if (gold <= 0) { get().addLog(tg('log.fx.investNoGold', { emoji: tm.emoji, name: tm.name })); return 'done'; }
      set({ showInvestPicker: { teamIndex: src, gold, rate } });
      return 'suspend';
    }
    case 'setCheckpoint': {
      // Point de contrôle : mémorise la case courante ; à la prochaine chute, on
      // n'y tombe pas EN DESSOUS (clamp dans applyRecul), puis chance de le consommer.
      const src = ctx.sourceTeam ?? get().currentTeam;
      const nt = [...get().teams];
      const tm = nt[src];
      const chance = action.consumeChance != null ? Math.max(0, Math.min(100, action.consumeChance)) : 100;
      nt[src] = { ...tm, checkpoint: tm.pos, checkpointConsumeChance: chance };
      set({ teams: nt });
      get().addLog(tg('log.fx.checkpoint', { emoji: tm.emoji, name: tm.name }));
      announce(set, get, '🚩', tg('log.fx.checkpoint.toast'), '#3b6cb3');
      return 'done';
    }
    case 'curseTimer': {
      // Malédiction : timer divisé au prochain tour (réutilise le Sablier).
      const t = resolveTargets(get, action.target, ctx);
      if (t.needPicker) { postTargetPicker(set, get, action); return 'suspend'; }
      const div = action.divisor || 2;
      const curseIdx = applyReflection(set, get, action, ctx, t.indices).indices;
      const nt = [...get().teams];
      for (const idx of curseIdx) nt[idx] = { ...nt[idx], sablierActif: true, sablierDivisor: div };
      set({ teams: nt });
      for (const idx of curseIdx) get().emitCurseVfx?.(idx, { icon: '⏱️', color: '#8745d4', tone: 'malus' });
      get().addLog(tg('log.fx.curseTimer', { n: div }));
      announce(set, get, '⏱️', tg('log.fx.curseTimer.toast', { n: div }), '#8745d4');
      clearCtxResolution(set, get, 'targetTeam');
      return 'done';
    }
    case 'curseExtraQuestion': {
      // Malédiction : question(s) en plus au prochain tour (réutilise le Double).
      const t = resolveTargets(get, action.target, ctx);
      if (t.needPicker) { postTargetPicker(set, get, action); return 'suspend'; }
      const add = Math.max(1, resolveAmount(action.n, srcTeam) || 1);
      const curseQIdx = applyReflection(set, get, action, ctx, t.indices).indices;
      const nt = [...get().teams];
      for (const idx of curseQIdx) {
        const tm = nt[idx];
        nt[idx] = { ...tm, doubleActive: true, doubleExtra: Math.min((tm.doubleExtra || 0) + add, 4) };
      }
      set({ teams: nt });
      for (const idx of curseQIdx) get().emitCurseVfx?.(idx, { icon: '❓', color: '#8745d4', tone: 'malus' });
      get().addLog(tgPlural('log.fx.curseExtra', add, { n: add }));
      announce(set, get, '❓', tgPlural('log.fx.curseExtra.toast', add, { n: add }), '#8745d4');
      clearCtxResolution(set, get, 'targetTeam');
      return 'done';
    }
    case 'blockPowers': {
      // Empêche la/les cible(s) d'utiliser leurs POUVOIRS pendant X tours.
      const t = resolveTargets(get, action.target, ctx);
      if (t.needPicker) { postTargetPicker(set, get, action); return 'suspend'; }
      const turns = Math.max(1, resolveAmount(action.turns ?? action.n, srcTeam) || 1);
      const idxs = applyReflection(set, get, action, ctx, t.indices).indices;
      const nt = [...get().teams];
      for (const idx of idxs) nt[idx] = { ...nt[idx], powersBlockedTurns: Math.max(nt[idx].powersBlockedTurns || 0, turns) };
      set({ teams: nt });
      for (const idx of idxs) get().emitCurseVfx?.(idx, { icon: '🚫', color: '#8a1f2e', tone: 'malus' });
      get().addLog(tgPlural('log.fx.blockPowers', turns, { n: turns }));
      announce(set, get, '🚫', tgPlural('log.fx.blockPowers.toast', turns, { n: turns }), '#8a1f2e');
      clearCtxResolution(set, get, 'targetTeam');
      return 'done';
    }
    case 'blockConsumables': {
      // Empêche la/les cible(s) d'utiliser leurs CONSOMMABLES pendant X tours.
      const t = resolveTargets(get, action.target, ctx);
      if (t.needPicker) { postTargetPicker(set, get, action); return 'suspend'; }
      const turns = Math.max(1, resolveAmount(action.turns ?? action.n, srcTeam) || 1);
      const idxs = applyReflection(set, get, action, ctx, t.indices).indices;
      const nt = [...get().teams];
      for (const idx of idxs) nt[idx] = { ...nt[idx], consumablesBlockedTurns: Math.max(nt[idx].consumablesBlockedTurns || 0, turns) };
      set({ teams: nt });
      for (const idx of idxs) get().emitCurseVfx?.(idx, { icon: '🚫', color: '#8a1f2e', tone: 'malus' });
      get().addLog(tgPlural('log.fx.blockConsumables', turns, { n: turns }));
      announce(set, get, '🚫', tgPlural('log.fx.blockConsumables.toast', turns, { n: turns }), '#8a1f2e');
      clearCtxResolution(set, get, 'targetTeam');
      return 'done';
    }
    case 'placeTrap': {
      if (ctx.tile == null) { set({ showTilePicker: { label: loc(action.trap, 'label'), icon: action.trap?.icon } }); return 'suspend'; }
      placeTrapAt(set, get, ctx.tile, action.trap, ctx.sourceTeam);
      clearCtxResolution(set, get, 'tile');
      return 'done';
    }
    case 'hackApp': {
      // « Hacking » (mode téléphone) : la/les cible(s) voient leur PROCHAIN tour
      // PERDU — une cinématique « application piratée » couvre l'écran et bloque
      // tout jusqu'à la fin de ce tour (déclenchée par nextTurn quand l'équipe
      // regagne la main). On stocke un compteur de tours piratés.
      const t = resolveTargets(get, action.target || 'self', ctx);
      if (t.needPicker) { postTargetPicker(set, get, action); return 'suspend'; }
      const turns = Math.max(1, resolveAmount(action.turns ?? action.n, srcTeam) || 1);
      const idxs = applyReflection(set, get, action, ctx, t.indices).indices;
      // Attribution affichée sur la cinématique : un hack issu d'un ÉVÉNEMENT est
      // « piraté par le boss » ; un hack lancé par une équipe (objet/consommable)
      // est « piraté par {équipe lanceuse} ». `by` est porté par chaque victime.
      const by = (action.by === 'boss' || ctx.source === 'event')
        ? { boss: true }
        : { name: srcTeam?.name, emoji: srcTeam?.emoji, color: srcTeam?.color };
      const nt = [...get().teams];
      for (const idx of idxs) nt[idx] = { ...nt[idx], hackedTurns: Math.max(nt[idx].hackedTurns || 0, turns), hackedBy: by };
      set({ teams: nt });
      get().addLog(tgPlural('log.fx.hackApp', turns, { n: turns }));
      announce(set, get, '💀', tg('log.fx.hackApp.toast'), '#19ff7a');
      clearCtxResolution(set, get, 'targetTeam');
      return 'done';
    }
    case '__rollD6': {
      if (ctx.rollResult == null) { rollEngineDice(set, get); return 'suspend'; }
      const v = ctx.rollResult;
      const branch = d6Branch(action.table, v);
      get().addLog(tg('log.fx.objectRolls', { n: v }));
      // injecte la branche en tête (après avoir dépilé __rollD6 par runQueue)
      const pa = get().pendingActions;
      set({ pendingActions: { ...pa, queue: [pa.queue[0], ...branch, ...pa.queue.slice(1)] } });
      clearCtxResolution(set, get, 'rollResult');
      return 'done';
    }
    default:
      return 'done';
  }
}

// --- Interrupts & resume -----------------------------------------------

function postTargetPicker(set, get, action) {
  set({ showTargetPicker: { source: 'engine', action } });
}

function clearCtxResolution(set, get, field) {
  const pa = get().pendingActions;
  if (!pa) return;
  if (pa.ctx[field] == null) return;
  const ctx = { ...pa.ctx }; delete ctx[field];
  set({ pendingActions: { ...pa, ctx } });
}

// Taux d'un investissement, en POURCENTS du remboursement (200 % = ×2). Lit
// `action.rate` en priorité, retombe sur l'ancien `mult` (×N → N×100 %), défaut 200 %.
export function investRate(spec) {
  if (spec?.rate != null) return Math.max(0, Math.round(spec.rate));
  if (spec?.mult != null) return Math.max(0, Math.round(spec.mult * 100));
  return 200;
}

// Mémorise une valeur dans le ctx de la file en cours (survit à une suspension).
function stashCtx(set, get, patch) {
  const pa = get().pendingActions;
  if (pa) set({ pendingActions: { ...pa, ctx: { ...pa.ctx, ...patch } } });
}

// Tire `n` thèmes distincts au hasard, mélangés. Vivier = TOUS les thèmes ayant
// des questions chargées (pas seulement ceux de la partie) — un thème imposé hors
// périmètre est ensuite servi par askQuestion via le STORE global. On ne pioche
// QUE des thèmes réellement disponibles (sinon la question « fizzle »).
// Ordre de repli : pool fourni → tous les thèmes chargés → thèmes en jeu → base.
function pickRandomSubjects(get, pool, n) {
  const withContent = new Set(allSubjectsWithContent());
  // pool : 'game' = thèmes de la partie (plateau) · liste = thèmes choisis dans
  // l'éditeur · sinon (undefined/'all') = tous les thèmes chargés. On ne garde que
  // les thèmes réellement jouables (sinon la question/duel « fizzle »).
  let src;
  if (pool === 'game') src = (get().boardSubjects || []).filter((k) => withContent.has(k));
  else if (Array.isArray(pool) && pool.length) src = pool.filter((k) => withContent.has(k));
  else src = [];
  if (!src.length) src = [...withContent];
  if (!src.length) src = (get().boardSubjects || []);
  if (!src.length) src = SUBJECT_KEYS;
  const base = src.slice();
  for (let i = base.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [base[i], base[j]] = [base[j], base[i]]; }
  return base.slice(0, Math.max(1, Math.min(n || 1, base.length)));
}

// Résout une SPEC de thème d'effet vers un thème concret.
//  - chaîne : renvoyée telle quelle (thème fixe, ou 'same'/'choose' gérés à part).
//  - objet { random:true, choices, pool } : thème aléatoire — SANS choix
//    (choices < 2, tiré immédiatement) ou À N CHOIX (choices ≥ 2, via un
//    SubjectPicker LIMITÉ ⇒ suspension, repris par selectSubject).
// Renvoie { subject } (résolu) ou { suspend:true } (picker ouvert).
function resolveSubjectSpec(set, get, ctx, spec, source) {
  if (!spec || typeof spec !== 'object' || !spec.random) return { subject: spec };
  if ((spec.choices || 0) >= 2) {
    if (ctx.subject != null) return { subject: ctx.subject };
    const choices = ctx._subjChoices || pickRandomSubjects(get, spec.pool, spec.choices);
    if (!ctx._subjChoices) stashCtx(set, get, { _subjChoices: choices });
    set({ showSubjectPicker: { choices, source } });
    return { suspend: true };
  }
  return { subject: pickRandomSubjects(get, spec.pool, 1)[0] };
}

function patchSource(set, get, patchFn) {
  const pa = get().pendingActions;
  const idx = pa?.ctx.sourceTeam ?? get().currentTeam;
  const nt = [...get().teams];
  nt[idx] = { ...nt[idx], ...patchFn(nt[idx]) };
  set({ teams: nt });
}

function consumeFumigene(set, get, targetIdx, action) {
  const t = get().teams[targetIdx];
  if (!t?.itemFumigene) return false;
  const nt = [...get().teams];
  nt[targetIdx] = { ...t, itemFumigene: false, itemFumigeneTurns: undefined };
  set({ teams: nt });
  get().addLog(tg('log.fx.fumigeneDodge', { emoji: t.emoji, name: t.name }));
  announce(set, get, '💨', tg('log.fx.fumigeneDodge.toast', { emoji: t.emoji }), '#7a8a99');
  return true;
}

function placeTrapAt(set, get, nodeId, trap, ownerTeam) {
  const { board, addLog, teams } = get();
  const node = board[nodeId];
  if (!node) return;
  if (node.trap) { addLog(tg('log.fx.trapAlready')); return; }
  const trapLabel = loc(trap, 'label') || tg('log.fx.trapDefault');
  const newBoard = { ...board, [nodeId]: { ...node, trap: { label: trapLabel, icon: trap?.icon || '🪤', do: trap?.do || [], ownerTeam } } };
  set({ board: newBoard });
  addLog(tg('log.fx.trapPlaced', { emoji: teams[ownerTeam]?.emoji ?? '', label: trapLabel }));
  announce(set, get, trap?.icon || '🪤', tg('log.fx.trapPlaced.toast', { label: trapLabel }), '#c9472f');
}

// Lance un d6 « d'objet » avec animation, puis reprend la file.
function rollEngineDice(set, get) {
  const finalValue = Math.floor(Math.random() * 6) + 1;
  set({ showActionDice: { value: finalValue, rolling: true } });
  let count = 0;
  const interval = setInterval(() => {
    if (!get().pendingActions) { clearInterval(interval); set({ showActionDice: null }); return; }
    set({ showActionDice: { value: Math.floor(Math.random() * 6) + 1, rolling: true } });
    if (++count >= 10) {
      clearInterval(interval);
      set({ showActionDice: { value: finalValue, rolling: false } });
      setTimeout(() => {
        set({ showActionDice: null });
        resumeQueue(set, get, { rollResult: finalValue });
      }, 700);
    }
  }, 80);
}

// Injecte la résolution d'une interruption dans le ctx puis relance la file.
export function resumeQueue(set, get, resolution = {}) {
  const pa = get().pendingActions;
  if (!pa) return;
  set({ pendingActions: { ...pa, ctx: { ...pa.ctx, ...resolution } } });
  runQueue(set, get);
}

// Fin de file : nettoyage + reprise du flux normal selon la source.
// Exporté pour que l'ANNULATION d'un sélecteur (cancelTargetPicker) puisse
// abandonner une séquence suspendue et reprendre le flux (event/trap/roll).
export function finishQueue(set, get) {
  const pa = get().pendingActions;
  const ctx = pa?.ctx || {};
  set({ pendingActions: null });

  if (get().finished) return;

  // Duel différé (action startDuel) : il REMPLACE la fin de tour. On le lance en
  // priorité — launchPendingDuel neutralise pendingLanding/deferredTurnEnd pour
  // qu'un seul nextTurn (celui de closeFight) clôture le tour, même si l'objet a
  // été utilisé après le lancer de dé.
  if (get().pendingDuel) { get().launchPendingDuel?.(); return; }

  // Suite de tour différée (déclencheur on:correct/on:wrong qui a ouvert un
  // sélecteur) : on la reprend une fois la file vidée, AVANT tout le reste.
  const deferred = get().deferredTurnEnd;
  if (deferred) { set({ deferredTurnEnd: null }); deferred(); return; }

  if (ctx.source === 'roll') {
    // Reprend la résolution post-lancer (jonction / atterrissage).
    if (ctx.postRoll && get().resolvePostRoll) {
      get().resolvePostRoll(ctx.diceValue, ctx.postRoll);
    } else {
      set({ pendingLanding: true });
    }
  } else if (ctx.source === 'trap') {
    // Le piège a pu déplacer la victime : ré-évalue la case (borné)
    if ((ctx.trapDepth || 0) < 3) get().handleLanding();
  } else if (ctx.source === 'event') {
    // Événement « scripté » (actions du moteur) : file vidée → question + fin de tour.
    get().finishEventTurn();
  }
  if (get().phase === 'game') saveGame(get());
}
