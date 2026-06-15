// ============================================================
//  Moteur d'effets composable
//  Exécute une liste d'ACTIONS atomiques issues d'objets (consommables,
//  équipement, pièges). Gère les étapes INTERACTIVES au milieu d'une
//  séquence via une FILE suspendable dans le store (`pendingActions`)
//  + des « interrupts » (choix de cible/case/thème, lancer de d6, recharge,
//  jonction). Voir plan : objets ultra-custom.
// ============================================================
import { moveForward, moveBack } from '../logic/pathfinding.js';
import { reducedSteal, reducedRecul, resolveAmount, diceLabel, passesChance, activeSetEffects } from '../logic/itemEffects.js';
import { SUBJECTS } from '../data/subjects.js';
import { pickQuestion } from '../logic/questionPicker.js';
import { ITEMS } from '../data/items.js';
import { saveGame } from './persistence.js';

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
    const it = ITEMS[team?.equipment?.[slot]];
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
    if (t.subject && t.subject !== subject) return; // condition de thème non remplie
    if (passesChance(t.chance)) out.push(...(t.do || [])); // chance optionnelle
  };
  for (const slot of SLOTS_EQUIP) {
    const it = ITEMS[team?.equipment?.[slot]];
    for (const t of triggersOf(it, on)) consider(t);
  }
  for (const t of setTriggersOf(team, on)) consider(t); // bonus de set
  return out;
}

// Options de « changer la question » disponibles pour une équipe (équipement + sac).
// L'équipement est plafonné à un reroll par question (rerollUsed).
export function questionRerollOptions(team, rerollUsed) {
  const opts = [];
  for (const slot of SLOTS_EQUIP) {
    const it = ITEMS[team?.equipment?.[slot]];
    const trig = triggersOf(it, 'question');
    if (trig.length && !rerollUsed) {
      opts.push({ itemName: it.name, icon: it.icon, fromBag: false, actions: trig.flatMap((t) => t.do || []) });
    }
  }
  (team?.bag || []).forEach((k, i) => {
    const it = ITEMS[k];
    const trig = triggersOf(it, 'question');
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

// --- Application des actions atomiques ---------------------------------

function applyMoveOne(set, get, idx, dir, n, allowJunction) {
  const { board, teams } = get();
  const team = teams[idx];
  let res;
  if (dir === 'back') {
    const amt = reducedRecul(team, n); // l'équipement (reculReduction) atténue
    if (amt <= 0) return { moved: false };
    res = moveBack(board, team.pos, amt);
  } else {
    res = moveForward(board, team.pos, n, { throughJunctions: !allowJunction });
  }
  const nt = [...teams];
  nt[idx] = { ...team, pos: res.finalPos };
  const movePath = res.path.length > 1
    ? [{ teamIndex: idx, waypoints: res.path.map((id) => ({ x: board[id].x, y: board[id].y })), type: dir === 'back' ? 'back' : 'forward' }]
    : null;
  set({ teams: nt, ...(movePath ? { movePath } : {}) });
  if (allowJunction && res.stoppedAtJunction) {
    set({ awaitingChoice: true, pendingMove: { remaining: res.remaining, noLanding: true, resumeEngine: true, teamIndex: idx } });
    return { suspended: true };
  }
  return { moved: true, finalPos: res.finalPos };
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
  const amountFor = (team) => {
    if (action.unit === 'percent') return Math.floor((team.money ?? 0) * (action.n / 100));
    return action.n;
  };
  if (action.mode === 'steal') {
    for (const i of indices) {
      if (i === stealRecipient) continue;
      const victim = nt[i];
      const raw = Math.min(amountFor(victim), victim.money ?? 0);
      const stolen = reducedSteal(victim, raw);
      nt[i] = { ...victim, money: Math.max(0, (victim.money ?? 0) - stolen) };
      nt[stealRecipient] = { ...nt[stealRecipient], money: (nt[stealRecipient].money ?? 0) + stolen };
      addLog(`💰 ${nt[stealRecipient].emoji} vole ${stolen} pièce${stolen > 1 ? 's' : ''} à ${victim.emoji} ${victim.name} !`);
    }
  } else if (action.mode === 'lose') {
    for (const i of indices) {
      const t = nt[i];
      const raw = amountFor(t);
      const loss = i === src ? raw : reducedSteal(t, raw);
      nt[i] = { ...t, money: Math.max(0, (t.money ?? 0) - loss) };
      if (loss > 0) addLog(`💸 ${t.emoji} ${t.name} perd ${loss} pièce${loss > 1 ? 's' : ''}.`);
    }
  } else { // gain
    for (const i of indices) {
      const t = nt[i];
      nt[i] = { ...t, money: (t.money ?? 0) + amountFor(t) };
    }
    addLog(`💰 ${action.target === 'all' ? 'Toutes les équipes gagnent' : nt[indices[0]]?.emoji + ' gagne'} des pièces !`);
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
    addLog(`🔄 Prochaine question forcée en ${SUBJECTS[subject]?.name || subject} !`);
    announce(set, get, SUBJECTS[subject]?.icon || '🔄', `Prochaine question → ${SUBJECTS[subject]?.name || subject}`, '#8745d4');
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
  if (!result) { addLog(`⚠️ Pas de question en ${SUBJECTS[subject]?.name || subject}.`); return { done: true }; }
  set({
    showQuestion: { ...showQuestion, question: result.question, subject, index: result.index },
    askedQuestions: { ...askedQuestions, [subject]: result.newAsked },
    indiceUsed: false, indiceHidden: [], rerollUsed: true,
  });
  addLog(`🔄 ${SUBJECTS[subject]?.icon || ''} Nouvelle question (${SUBJECTS[subject]?.name || subject}) !`);
  announce(set, get, SUBJECTS[subject]?.icon || '🔄', `Nouvelle question (${SUBJECTS[subject]?.name || subject})`, '#8745d4');
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
      // jonction seulement pour un move 'self' vers l'avant
      const allowJunction = action.target === 'self' && action.dir === 'forward';
      const n = resolveAmount(action.n, srcTeam); // un seul tir partagé par toutes les cibles
      for (const idx of t.indices) {
        const res = applyMoveOne(set, get, idx, action.dir, n, allowJunction);
        if (res.suspended) return 'suspend';
        // Journalise le déplacement (sinon seul un toast transitoire le montrait).
        if (res.moved) {
          const tm = get().teams[idx];
          get().addLog(`${action.dir === 'back' ? '⬅️' : '➡️'} ${tm.emoji} ${tm.name} ${action.dir === 'back' ? 'recule' : 'avance'} de ${n} case${n > 1 ? 's' : ''}.`);
        }
        if (res.finalPos && get().board[res.finalPos]?.type === 'arrivee') {
          get().addLog(`🏆 ${get().teams[idx].emoji} ${get().teams[idx].name} atteint l'arrivée !`);
          set({ finished: true });
        }
      }
      announce(set, get, action.dir === 'back' ? '⬅️' : '➡️',
        `${action.dir === 'back' ? 'Recul' : 'Avance'} de ${n} case${n > 1 ? 's' : ''}${dieTag(action.n)}`,
        action.dir === 'back' ? '#c9472f' : '#5b8c3a');
      clearCtxResolution(set, get, 'targetTeam');
      return 'done';
    }
    case 'money': {
      const t = resolveTargets(get, action.target, ctx);
      if (t.needPicker) { postTargetPicker(set, get, action); return 'suspend'; }
      if (OFFENSIVE(action) && consumeFumigene(set, get, t.indices[0], action)) { clearCtxResolution(set, get, 'targetTeam'); return 'done'; }
      const mn = resolveAmount(action.n, srcTeam);
      applyMoney(set, get, { ...action, n: mn }, ctx, t.indices);
      if (typeof action.n === 'string' || (action.n && typeof action.n === 'object')) {
        announce(set, get, '🎲', `${diceLabel(action.n)} → ${mn}${action.unit === 'percent' ? '%' : ' or'}`, '#e8b117');
      }
      clearCtxResolution(set, get, 'targetTeam');
      return 'done';
    }
    case 'extraTime': {
      const et = resolveAmount(action.n, srcTeam);
      patchSource(set, get, (t) => ({ itemTimerBonus: (t.itemTimerBonus || 0) + et }));
      get().addLog(`⌛ +${et}s à la prochaine question.`);
      announce(set, get, '⌛', `+${et}s à la prochaine question${dieTag(action.n)}`, '#3b6cb3');
      return 'done';
    }
    case 'shieldNext': {
      const sn = typeof action.n === 'number' ? (action.n || 1) : (resolveAmount(action.n, srcTeam) || 1);
      patchSource(set, get, (t) => ({ itemShield: (t.itemShield || 0) + sn }));
      get().addLog(`🪵 ${sn > 1 ? `Les ${sn} prochains reculs seront annulés` : 'Le prochain recul sera annulé'}.`);
      announce(set, get, '🛡️', `Bouclier armé${sn > 1 ? ` ×${sn}` : ''}${dieTag(action.n)}`, '#3b6cb3');
      return 'done';
    }
    case 'fumigene': {
      // `turns` optionnel : le fumigène expire après X tours (fixe/dé/échelle).
      // Absent ⇒ comportement historique (jusqu'à utilisation).
      const ft = action.turns != null ? resolveAmount(action.turns, srcTeam) : 0;
      patchSource(set, get, () => ({ itemFumigene: true, ...(ft > 0 ? { itemFumigeneTurns: ft } : {}) }));
      get().addLog(ft > 0
        ? `💨 Fumigène actif pendant ${ft} tour${ft > 1 ? 's' : ''}.`
        : `💨 Le prochain pouvoir offensif subi sera annulé.`);
      announce(set, get, '💨', `Fumigène armé${ft > 0 ? ` (${ft}T)` : ''}`, '#7a8a99');
      return 'done';
    }
    case 'gainCharge': {
      if (ctx.chargeDone) { clearCtxResolution(set, get, 'chargeDone'); return 'done'; }
      // Aucun pouvoir à recharger : on saute (évite un sélecteur vide).
      const ct = get().teams[ctx.sourceTeam ?? get().currentTeam];
      if (!ct?.powers || Object.keys(ct.powers).length === 0) { get().addLog(`✨ Aucun pouvoir à recharger.`); return 'done'; }
      set({ showChargePicker: { source: 'engine' } });
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
      const sname = SUBJECTS[subj]?.name || subj;
      const whoLabel = action.target === 'self' ? 'ta prochaine question' : 'la prochaine question de la cible';
      get().addLog(`🎯 ${SUBJECTS[subj]?.icon || ''} ${whoLabel} forcée en ${sname} !`);
      announce(set, get, SUBJECTS[subj]?.icon || '🎯', `Question forcée → ${sname}`, SUBJECTS[subj]?.color || '#8745d4');
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
      const whoLabel = action.target === 'self' ? 'Ta prochaine voie'
        : action.target === 'all' ? 'La prochaine voie de chaque équipe'
        : 'La prochaine voie de la cible';
      get().addLog(`🎲 ${whoLabel} sera choisie au hasard !`);
      announce(set, get, '🎲', `${whoLabel} → au hasard`, '#8745d4');
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
      const sname = SUBJECTS[subj]?.name || subj;
      get().addLog(`🎲 Défi lancé ! Ta prochaine question sera en ${sname}.`);
      announce(set, get, SUBJECTS[subj]?.icon || '🎲', `Défi → ${sname}`, SUBJECTS[subj]?.color || '#8a1f2e');
      return 'done';
    }
    case 'buff': {
      // Pose un effet de durée (X tours de l'équipe) sur la/les cible(s).
      const t = resolveTargets(get, action.target, ctx);
      if (t.needPicker) { postTargetPicker(set, get, action); return 'suspend'; }
      const src = action.buff || {};
      const turns = src.turns ?? 3;
      const nt = [...get().teams];
      for (const idx of t.indices) {
        const cur = nt[idx];
        nt[idx] = { ...cur, buffs: [...(cur.buffs || []), { type: src.type, turns, n: src.n, subject: src.subject }] };
      }
      set({ teams: nt });
      get().addLog(`✨ Effet de durée posé pour ${turns} tour${turns > 1 ? 's' : ''}.`);
      clearCtxResolution(set, get, 'targetTeam');
      return 'done';
    }
    case 'loot': {
      // Loot immédiat d'un objet (catégorie optionnelle) pour l'équipe source.
      if (get().engineLoot) get().engineLoot(ctx.sourceTeam ?? get().currentTeam, action.category);
      return 'done';
    }
    case 'placeTrap': {
      if (ctx.tile == null) { set({ showTilePicker: { label: action.trap?.label, icon: action.trap?.icon } }); return 'suspend'; }
      placeTrapAt(set, get, ctx.tile, action.trap, ctx.sourceTeam);
      clearCtxResolution(set, get, 'tile');
      return 'done';
    }
    case '__rollD6': {
      if (ctx.rollResult == null) { rollEngineDice(set, get); return 'suspend'; }
      const v = ctx.rollResult;
      const branch = d6Branch(action.table, v);
      get().addLog(`🎲 L'objet fait ${v} !`);
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
  get().addLog(`💨 ${t.emoji} ${t.name} esquive l'effet (bombe fumigène) !`);
  announce(set, get, '💨', `${t.emoji} Contré par le fumigène !`, '#7a8a99');
  return true;
}

function placeTrapAt(set, get, nodeId, trap, ownerTeam) {
  const { board, addLog, teams } = get();
  const node = board[nodeId];
  if (!node) return;
  if (node.trap) { addLog(`🪤 Cette case a déjà un piège.`); return; }
  const newBoard = { ...board, [nodeId]: { ...node, trap: { label: trap?.label, icon: trap?.icon || '🪤', do: trap?.do || [], ownerTeam } } };
  set({ board: newBoard });
  addLog(`🪤 ${teams[ownerTeam]?.emoji ?? ''} pose un piège (${trap?.label || 'piège'}) !`);
  announce(set, get, trap?.icon || '🪤', `Piège posé : ${trap?.label || 'piège'}`, '#c9472f');
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
function finishQueue(set, get) {
  const pa = get().pendingActions;
  const ctx = pa?.ctx || {};
  set({ pendingActions: null });

  if (get().finished) return;

  // Suite de tour différée (déclencheur on:correct/on:wrong qui a ouvert un
  // sélecteur) : on la reprend une fois la file vidée, AVANT tout le reste.
  const deferred = get().deferredTurnEnd;
  if (deferred) { set({ deferredTurnEnd: null }); deferred(); return; }

  if (ctx.source === 'roll') {
    // Reprend la résolution post-lancer (jonction / dé de 1 / atterrissage).
    if (ctx.postRoll && get().resolvePostRoll) {
      get().resolvePostRoll(ctx.diceValue, ctx.postRoll);
    } else if (ctx.diceValue === 1) {
      const t = get().teams[get().currentTeam];
      get().addLog(`✨ ${t.emoji} A fait 1 ! Choisis un pouvoir à recharger gratuitement !`);
      set({ showChargePicker: { source: 'dice' }, freeActivation: true, pendingLanding: true });
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
