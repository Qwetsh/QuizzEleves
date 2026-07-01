// ============================================================
//  Moteur d'effets composable
//  Exécute une liste d'ACTIONS atomiques issues d'objets (consommables,
//  équipement, pièges). Gère les étapes INTERACTIVES au milieu d'une
//  séquence via une FILE suspendable dans le store (`pendingActions`)
//  + des « interrupts » (choix de cible/case/thème, lancer de d6, recharge,
//  jonction). Voir plan : objets ultra-custom.
// ============================================================
import { moveForward } from '../logic/pathfinding.js';
import { reducedSteal, applyStealProtection, resolveAmount, diceLabel, passesChance, activeSetEffects, mergedItem, isGoldStealImmune, rollsReflect } from '../logic/itemEffects.js';
import { applyRecul } from '../logic/turnHelpers.js';
import { extOn } from '../extensions/registry.js';
import { soundShield } from '../logic/sounds.js';
import { SUBJECTS } from '../data/subjects.js';
import { BUFF_INFO } from '../logic/teamStatus.js';
import { pickQuestion } from '../logic/questionPicker.js';
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
      const raw = Math.min(amountFor(victim), victim.money ?? 0);
      const stolen = applyStealProtection(victim, raw);
      nt[i] = { ...victim, money: Math.max(0, (victim.money ?? 0) - stolen) };
      nt[stealRecipient] = { ...nt[stealRecipient], money: (nt[stealRecipient].money ?? 0) + stolen };
      // Détail : montant visé, protection éventuelle de la victime, butin réel.
      const detail = [];
      if (baseLabel) detail.push({ label: tg('log.fx.detail.stealPlanned'), note: baseLabel });
      if (stolen < raw) detail.push({ label: tg('log.fx.detail.protectionOf', { name: victim.name }), note: `−${raw - stolen} 🪙` });
      if (detail.length) detail.push({ label: tg('log.fx.detail.coinsStolen'), amount: stolen });
      addLog({
        text: tgPlural('log.fx.steal', stolen, { emoji: nt[stealRecipient].emoji, n: stolen, vemoji: victim.emoji, vname: victim.name }),
        detail: detail.length ? detail : undefined,
      });
    }
  } else if (action.mode === 'lose') {
    for (const i of indices) {
      const t = nt[i];
      // Une perte SUBIE (pas une dépense de soi) est bloquée par l'immunité au vol d'or.
      if (i !== src && isGoldStealImmune(t)) {
        addLog(tg('log.fx.goldImmune', { emoji: t.emoji, name: t.name }));
        continue;
      }
      const raw = amountFor(t);
      const loss = i === src ? raw : reducedSteal(t, raw);
      nt[i] = { ...t, money: Math.max(0, (t.money ?? 0) - loss) };
      if (loss > 0) {
        const detail = [];
        if (baseLabel) detail.push({ label: tg('log.fx.detail.lossPlanned'), note: baseLabel });
        if (loss < raw) detail.push({ label: tg('log.fx.detail.protection'), note: `−${raw - loss} 🪙` });
        if (detail.length) detail.push({ label: tg('log.fx.detail.coinsLost'), amount: -loss });
        addLog({
          text: tgPlural('log.fx.lose', loss, { emoji: t.emoji, name: t.name, n: loss }),
          detail: detail.length ? detail : undefined,
        });
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
  set({
    showQuestion: { ...showQuestion, question: result.question, subject, index: result.index },
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
      // Renvoi possible (recul vers une seule cible adverse → redirigé sur la source).
      const moveIndices = action.dir === 'back' ? applyReflection(set, get, action, ctx, t.indices).indices : t.indices;
      // jonction seulement pour un move 'self' vers l'avant
      const allowJunction = action.target === 'self' && action.dir === 'forward';
      const n = resolveAmount(action.n, srcTeam); // un seul tir partagé par toutes les cibles
      const formula = fxFormula(action.n);
      for (const idx of moveIndices) {
        const res = applyMoveOne(set, get, idx, action.dir, n, allowJunction);
        if (res.suspended) return 'suspend';
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
        // question COURANTE — la modale relit itemBonusTime et réajuste le timer.
        set({ showQuestion: { ...sq, itemBonusTime: (sq.itemBonusTime || 0) + et } });
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
      let act = action;
      if (typeof action.chance === 'number') {
        let pick = ctx._rerollPick;
        if (pick == null) {
          pick = Math.random() < action.chance ? (action.subject || 'same') : (action.elseSubject || 'hardcore');
          ctx._rerollPick = pick;
          const pa = get().pendingActions;
          if (pa) set({ pendingActions: { ...pa, ctx: { ...pa.ctx, _rerollPick: pick } } });
        }
        act = { ...action, subject: pick };
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
      const subj = action.subject;
      const nt = [...get().teams];
      for (const idx of t.indices) nt[idx] = { ...nt[idx], forcedSubject: subj };
      set({ teams: nt });
      const sname = loc(SUBJECTS[subj], 'name') || subj;
      const whoLabel = action.target === 'self' ? tg('log.fx.who.self') : tg('log.fx.who.target');
      get().addLog(tg('log.fx.forceSubject', { icon: SUBJECTS[subj]?.icon || '', who: whoLabel, subject: sname }));
      announce(set, get, SUBJECTS[subj]?.icon || '🎯', tg('log.fx.forceSubject.toast', { subject: sname }), SUBJECTS[subj]?.color || '#8745d4');
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
    case 'challenge': {
      // « Défi » : force MON prochain thème + mise un pari one-shot. La
      // récompense (do) est versée si je réponds juste à cette question, le
      // malus (else) si je rate/laisse filer le temps. Consommé par answerQuestion
      // / timeoutQuestion (team.wager).
      const subj = action.subject;
      patchSource(set, get, () => ({ forcedSubject: subj, wager: { do: action.do || [], else: action.else || [] } }));
      get().emitCurseVfx?.(ctx.sourceTeam ?? get().currentTeam, { icon: SUBJECTS[subj]?.icon || '🎲', color: SUBJECTS[subj]?.color || '#c8911f', tone: 'buff' });
      const sname = loc(SUBJECTS[subj], 'name') || subj;
      get().addLog(tg('log.fx.challenge', { subject: sname }));
      announce(set, get, SUBJECTS[subj]?.icon || '🎲', tg('log.fx.challenge.toast', { subject: sname }), SUBJECTS[subj]?.color || '#8a1f2e');
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
    case 'loseItem': {
      // Retire un objet (catégorie optionnelle) à la/les cible(s) ; repli sur l'or.
      const t = resolveTargets(get, action.target, ctx);
      if (t.needPicker) { postTargetPicker(set, get, action); return 'suspend'; }
      const loseIdx = applyReflection(set, get, action, ctx, t.indices).indices;
      for (const idx of loseIdx) get().engineLoseItem?.(idx, action.category, action.fallbackGold, action.family);
      clearCtxResolution(set, get, 'targetTeam');
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
