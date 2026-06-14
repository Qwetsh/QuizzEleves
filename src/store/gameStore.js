import { create } from 'zustand';
import { TEAM_COLORS, TEAM_DEFAULTS, TEAM_DEFAULT_EMOJIS, TEAM_BLAZON_GLYPHS } from '../data/teamPresets.js';
import { EVENTS } from '../data/events.js';
import { SUBJECTS, SUBJECT_KEYS } from '../data/subjects.js';
import { POWERS } from '../data/powers.js';
import { generateBoard } from '../logic/boardGenerator.js';
import { generateDecor } from '../logic/decorGenerator.js';
import { moveForward, moveBack } from '../logic/pathfinding.js';
import { pickQuestion } from '../logic/questionPicker.js';
import { pickRandomEvent } from '../logic/eventPicker.js';
import { getQuestions } from '../data/questions/index.js';
import { calculateMoneyGain } from '../logic/moneyCalculator.js';
import { saveGame, loadGame, clearSave } from './persistence.js';
import { randomSubject, resolveWrongAnswer, resolveDoubleQuestion, BURST_RESET } from '../logic/turnHelpers.js';
import { soundShield, soundTrap } from '../logic/sounds.js';
import * as eventH from './eventHandlers.js';
import * as powerH from './powerHandlers.js';
import * as fightH from './fightHandlers.js';
import * as itemH from './itemHandlers.js';
import * as effectH from './effectEngine.js';
import { ITEMS } from '../data/items.js';
import { LOOT } from '../logic/balanceConfig.js';
import { getEffectValue } from '../logic/itemEffects.js';

const INITIAL_CHARGES = 2;

function createDefaultTeams(n) {
  return Array.from({ length: n }, (_, i) => ({
    name: TEAM_DEFAULTS[i] || `\u00c9quipe ${i + 1}`,
    color: TEAM_COLORS[i],
    emoji: TEAM_DEFAULT_EMOJIS[i] || '\u{1F3B2}',
    blazonGlyph: TEAM_BLAZON_GLYPHS[i] || 'lion',
    pos: 'depart',
    correct: 0,
    wrong: 0,
    streak: 0,
    money: 0,
    powerDef: null,
    powerOff: null,
    sablierActif: false,
    doubleActive: false,
  }));
}

// Compteur monotone d'id de VFX (foudre/bouclier) — un seul, partagé par tous
// les overlays, pour qu'un id ne se répète jamais d'affilée sur le champ `vfx`.
let vfxSeq = 0;

// Vrai si le Bouclier (pouvoir) ou un Bouclier de bois (consommable) a absorbe
// le recul entre l'etat avant/apres resolveWrongAnswer (declenche le son).
function bouclierAbsorbed(before, after) {
  return (
    (before.powers?.bouclier?.charges ?? 0) > (after.powers?.bouclier?.charges ?? 0) ||
    (before.itemShield ?? 0) > (after.itemShield ?? 0)
  );
}

// UI state reset shared by nextTurn, resumeGame, reset.
// NB: movePath n'est PAS reset ici — les animations de deplacement doivent
// survivre au changement de tour (ex: recul apres mauvaise reponse) et sont
// nettoyees par clearTeamMove quand chaque pion finit son trajet.
const TURN_RESET = {
  diceValue: null,
  pendingMove: null,
  pendingLanding: false,
  awaitingChoice: false,
  preRollPos: null,
  preRollValue: null,
  showTargetPicker: null,
  showShop: false,
  showInventory: false,
  indiceUsed: false,
  indiceHidden: [],
  freeActivation: false,
  showChargePicker: false,
  // Moteur d'effets composable (objets) : file + interrupts transitoires
  pendingActions: null,
  showTilePicker: null,
  showActionDice: null,
  showSubjectPicker: false,
  rerollUsed: false,
  trapDepth: 0,
  forcedSubject: null,
  deferredTurnEnd: null,
};

export const useGameStore = create((set, get) => ({
  // --- Phase ---
  phase: 'setup',
  setPhase: (phase) => set({ phase }),

  // Bac a sable dev : partie simulee qui ne touche pas a la sauvegarde
  devSandbox: false,

  // --- Setup state ---
  level: 'cycle4',
  setLevel: (level) => set({ level }),

  // Pool de questions « spécial Brevet » (DNB) ajouté par-dessus le niveau choisi
  useBrevet: false,
  setUseBrevet: (v) => set({ useBrevet: v }),

  nbTeams: 3,
  setNbTeams: (n) => set({ nbTeams: n, setupTeams: createDefaultTeams(n) }),

  setupTeams: createDefaultTeams(3),
  updateSetupTeam: (index, updates) => {
    const teams = [...get().setupTeams];
    teams[index] = { ...teams[index], ...updates };
    set({ setupTeams: teams });
  },

  boardParams: {
    casesParVoie: 4, nbVoies: 3, nbSections: 3,
    voieFinale: 'court-long', couloirsMix: 2, eventEveryX: 3,
  },
  setBoardParam: (key, value) => {
    set({ boardParams: { ...get().boardParams, [key]: value } });
  },

  enabledEvents: Object.keys(EVENTS),
  toggleEvent: (key) => {
    const { enabledEvents } = get();
    set({ enabledEvents: enabledEvents.includes(key) ? enabledEvents.filter((k) => k !== key) : [...enabledEvents, key] });
  },
  setAllEvents: (enabled) => set({ enabledEvents: enabled ? Object.keys(EVENTS) : [] }),

  // Objets actives (boutique, coffres, marchand, butin) — meme principe que les evenements
  enabledItems: Object.keys(ITEMS),
  toggleItem: (key) => {
    const { enabledItems } = get();
    set({ enabledItems: enabledItems.includes(key) ? enabledItems.filter((k) => k !== key) : [...enabledItems, key] });
  },
  setAllItems: (enabled) => set({ enabledItems: enabled ? Object.keys(ITEMS) : [] }),
  // Resynchronise la liste des objets activés sur le catalogue courant (après
  // (re)chargement depuis Supabase). PRÉSERVE les choix manuels : retire les
  // clés disparues, ajoute seulement les objets RÉELLEMENT nouveaux (jamais vus,
  // suivis par knownItemKeys) — un objet décoché n'est donc pas re-coché. N'agit
  // sur enabledItems qu'au setup, pour ne pas perturber une partie en cours.
  itemsVersion: 0,
  knownItemKeys: Object.keys(ITEMS),
  syncEnabledItems: () => {
    const all = Object.keys(ITEMS);
    set((s) => {
      if (s.phase !== 'setup') return { knownItemKeys: all, itemsVersion: s.itemsVersion + 1 };
      const known = s.knownItemKeys || [];
      const fresh = all.filter((k) => !known.includes(k)); // jamais vus → activés par défaut
      const enabled = [...s.enabledItems.filter((k) => ITEMS[k]), ...fresh];
      return { enabledItems: [...new Set(enabled)], knownItemKeys: all, itemsVersion: s.itemsVersion + 1 };
    });
  },

  // --- Game state ---
  teams: [],
  currentTeam: 0,
  board: null,
  boardDecor: null,
  viewBox: { w: 2400, h: 620 },
  finished: false,
  askedQuestions: {},
  questions: {},
  log: [],

  // --- UI state ---
  rolling: false,
  diceValue: null,
  pendingMove: null,
  pendingLanding: false,
  _landingSeq: 0,
  _landingId: 0,
  freeActivation: false,
  showChargePicker: false,
  awaitingChoice: false,
  // Révélation d'objet (visuel C) : { itemKey, title?, subtitle? } | null
  lootReveal: null,
  showQuestion: null,
  showEvent: null,
  showFight: null,
  eventApplied: false,
  showTargetPicker: null,
  indiceUsed: false,
  indiceHidden: [],
  showDiceModal: false,
  showShop: false,
  showInventory: false,
  // Stock rotatif de la boutique d'objets : renouvelé tous les N tours
  shopStock: [],
  shopStockTurns: 0,
  preRollPos: null,
  preRollValue: null,
  // Animations: [{ teamIndex, waypoints: [{x,y},...], type: 'forward'|'back' }, ...]
  // Tableau pour supporter plusieurs pions en mouvement (tempete, echange...).
  movePath: null,

  // --- Power selection ---
  powerSetupIndex: 0,
  powerSetupCategory: 'def',

  // Incrémenté quand les questions sont (re)chargées depuis Supabase : permet au
  // Setup de rafraîchir ses compteurs sans bloquer le boot. Voir questionsConfig.
  questionsVersion: 0,
  bumpQuestionsVersion: () => set((s) => ({ questionsVersion: s.questionsVersion + 1 })),

  // --- Log ---
  addLog: (msg) => set({ log: [...get().log, msg] }),

  // --- Révélation d'objet (visuel C) ---
  showLoot: (itemKey, opts = {}) => set({ lootReveal: { itemKey, ...opts } }),
  dismissLoot: () => {
    const lr = get().lootReveal;
    // File de révélations (ex. consommable + équipement lootés au même tour) :
    // on enchaîne sur l'objet suivant au lieu de fermer.
    if (lr?.rest?.length) {
      const [next, ...rest] = lr.rest;
      set({ lootReveal: { ...next, rest, thenClose: lr.thenClose } });
      return;
    }
    set({ lootReveal: null });
    // Loot d'événement (coffre) : la révélation remplace le ResultPhase, donc
    // sa fermeture enchaîne sur le tour suivant (comme closeEvent).
    if (lr?.thenClose) {
      set({ showEvent: null, eventApplied: false });
      get().nextTurn();
      if (get().phase === 'game') saveGame(get());
    }
  },

  // --- Start game ---
  startGame: () => {
    const { setupTeams, boardParams, level, useBrevet } = get();
    const { nodes, viewBox } = generateBoard(boardParams);
    const teams = setupTeams.map((t) => ({
      ...t, pos: 'depart', powers: {},
      equipment: { head: null, body: null, feet: null },
      bag: Array(itemH.BAG_SIZE).fill(null),
    }));
    const questions = getQuestions(level, { brevet: useBrevet });
    set({
      devSandbox: false,
      phase: 'powerSelect', teams, board: nodes, viewBox, questions,
      boardDecor: generateDecor(nodes),
      currentTeam: 0, finished: false, askedQuestions: {}, log: [],
      shopStock: itemH.generateShopStock(itemH.SHOP_STOCK_SIZE, get().enabledItems),
      shopStockTurns: setupTeams.length * 2,
      ...TURN_RESET, movePath: null,
      showQuestion: null, showEvent: null, showFight: null, showDiceModal: false, eventApplied: false, lootReveal: null,
      powerSetupIndex: 0, powerSetupCategory: 'def',
    });
  },

  // --- Power selection flow ---
  selectPower: (teamIndex, category, powerKey) => {
    const teams = [...get().teams];
    if (category === 'def') {
      teams[teamIndex] = { ...teams[teamIndex], powerDef: powerKey };
    } else {
      teams[teamIndex] = { ...teams[teamIndex], powerOff: powerKey };
    }
    set({ teams });
  },

  advancePowerSetup: () => {
    const { powerSetupIndex, powerSetupCategory, teams, addLog } = get();
    // Idempotent : un double-tap sur la dernière carte (TBI) relançait la
    // transition et dupliquait le « Début de la partie ! » dans le journal
    if (get().phase !== 'powerSelect') return;
    const nextIndex = powerSetupIndex + 1;
    if (nextIndex >= teams.length) {
      if (powerSetupCategory === 'def') {
        set({ powerSetupCategory: 'off', powerSetupIndex: 0 });
      } else {
        const finalTeams = teams.map((t) => {
          const powers = { ...t.powers };
          if (t.powerDef && !powers[t.powerDef]) powers[t.powerDef] = { charges: INITIAL_CHARGES, level: 1 };
          if (t.powerOff && !powers[t.powerOff]) powers[t.powerOff] = { charges: INITIAL_CHARGES, level: 1 };
          return { ...t, powers };
        });
        addLog(`\u{1F3B2} D\u00e9but de la partie ! ${finalTeams.length} \u00e9quipes en lice.`);
        set({ teams: finalTeams, phase: 'game' });
      }
    } else {
      set({ powerSetupIndex: nextIndex });
    }
  },

  // --- Dice ---
  rollDice: () => {
    const { finished, rolling, showDiceModal, showFight, pendingActions, pendingLanding, awaitingChoice, showQuestion, showEvent } = get();
    if (finished || rolling || showDiceModal || showFight) return;
    // Bloque le dé pendant une séquence d'effet (choix de case/cible/d6...) ou
    // tant que le tour n'est pas résolu (atterrissage, jonction, question).
    if (pendingActions || pendingLanding || awaitingChoice || showQuestion || showEvent) return;
    const finalValue = Math.floor(Math.random() * 6) + 1;
    set({ rolling: true, diceValue: finalValue, showDiceModal: true });
  },

  completeDiceRoll: () => {
    const { diceValue } = get();
    set({ showDiceModal: false, rolling: false });
    if (diceValue) get().handleDiceResult(diceValue);
  },

  handleDiceResult: (value, opts = {}) => {
    const { teams, currentTeam, board, addLog } = get();
    const team = teams[currentTeam];
    set({ preRollPos: team.pos, preRollValue: value, freeActivation: false });
    addLog(`${team.emoji} ${team.name} lance le d\u00E9 : ${value}`);

    const result = moveForward(board, team.pos, value);
    const newTeams = [...teams];
    newTeams[currentTeam] = { ...team, pos: result.finalPos };
    // Build animation waypoints from path
    const waypoints = result.path.map((id) => ({ x: board[id].x, y: board[id].y }));
    set({ teams: newTeams, movePath: [{ teamIndex: currentTeam, waypoints, type: 'forward' }] });

    // D\u00E9clencheurs on:roll de l'\u00E9quipement : ils d\u00E9pendent de la VALEUR du d\u00E9,
    // PAS de l'endroit o\u00F9 l'on s'arr\u00EAte. On les d\u00E9clenche donc AVANT de g\u00E9rer la
    // jonction/atterrissage ; finishQueue encha\u00EEne ensuite resolvePostRoll.
    // opts.skipOnRoll : une Relance ne re-d\u00E9clenche pas le bonus on:roll (d\u00E9j\u00E0
    // accord\u00E9 au 1er lancer) \u2192 \u00E9vite un double bonus.
    const postRoll = { stoppedAtJunction: result.stoppedAtJunction, remaining: result.remaining, junctionPos: result.finalPos };
    const onRoll = opts.skipOnRoll ? [] : effectH.equipOnRollActions(team, value);
    if (onRoll.length) {
      effectH.runEffects(set, get, onRoll, { source: 'roll', diceValue: value, postRoll });
      return;
    }
    get().resolvePostRoll(value, postRoll);
  },

  // R\u00E9solution apr\u00E8s le lancer (jonction / d\u00E9 de 1 / atterrissage), ex\u00E9cut\u00E9e
  // APR\u00C8S les \u00E9ventuels effets on:roll de l'\u00E9quipement.
  resolvePostRoll: (value, postRoll) => {
    const { teams, currentTeam, addLog } = get();
    const team = teams[currentTeam];
    // Un effet on:roll a pu d\u00E9placer l'\u00E9quipe HORS de la jonction o\u00F9 le d\u00E9 s'\u00E9tait
    // arr\u00EAt\u00E9 : on ne propose le choix de voie que si elle s'y trouve toujours.
    if (postRoll?.stoppedAtJunction && team.pos === postRoll.junctionPos) {
      set({ awaitingChoice: true, pendingMove: { remaining: postRoll.remaining } });
      addLog(`\u2194\uFE0F Choisis une voie !`);
      return;
    }
    if (value === 1) {
      addLog(`\u2728 ${team.emoji} A fait 1 ! Choisis un pouvoir \u00e0 recharger gratuitement !`);
      set({ showChargePicker: { source: 'dice' }, freeActivation: true, pendingLanding: true });
      return;
    }
    set({ pendingLanding: true });
  },

  // --- Junction choice ---
  chooseJunction: (nextNodeId) => {
    const { teams, currentTeam, board, pendingMove } = get();
    const team = teams[currentTeam];
    const junctionPos = team.pos;
    // Deplacement d'objet (potion) : pas d'action de case a l'atterrissage,
    // et on ne touche pas au pendingLanding du tour en cours
    const noLanding = !!pendingMove?.noLanding;
    const resumeEngine = !!pendingMove?.resumeEngine; // move issu du moteur d'effets
    if (!noLanding) set({ pendingLanding: false });

    const newTeams = [...teams];
    newTeams[currentTeam] = { ...team, pos: nextNodeId };
    set({ teams: newTeams, awaitingChoice: false });

    if (pendingMove && pendingMove.remaining > 1) {
      const result = moveForward(board, nextNodeId, pendingMove.remaining - 1);
      const updatedTeams = [...get().teams];
      updatedTeams[currentTeam] = { ...updatedTeams[currentTeam], pos: result.finalPos };
      // Animation depuis la jonction, en passant par la branche choisie
      const waypoints = [junctionPos, ...result.path].map((id) => ({ x: board[id].x, y: board[id].y }));
      set({ teams: updatedTeams, pendingMove: null, movePath: [{ teamIndex: currentTeam, waypoints, type: 'forward' }] });

      if (result.stoppedAtJunction) {
        set({ awaitingChoice: true, pendingMove: { remaining: result.remaining, noLanding, resumeEngine } });
        return;
      }
    } else {
      const waypoints = [junctionPos, nextNodeId].map((id) => ({ x: board[id].x, y: board[id].y }));
      set({ pendingMove: null, movePath: [{ teamIndex: currentTeam, waypoints, type: 'forward' }] });
    }

    if (noLanding) {
      // Seule l'arrivee compte pour un deplacement d'objet
      const pos = get().teams[currentTeam].pos;
      if (board[pos]?.type === 'arrivee') {
        get().addLog(`\u{1F3C6} ${get().teams[currentTeam].emoji} ${get().teams[currentTeam].name} atteint l'arrivée !`);
        set({ finished: true });
      }
      // Move issu du moteur d'effets : reprendre la file (l'action move est terminee)
      if (resumeEngine && get().pendingActions) {
        effectH.resumeQueue(set, get, { junctionDone: true });
        return;
      }
      saveGame(get());
      return;
    }

    get().handleLanding();
  },

  // --- Landing ---
  handleLanding: () => {
    const { teams, currentTeam, board, addLog, enabledEvents } = get();
    const team = teams[currentTeam];
    const node = board[team.pos];

    if (!node) { get().nextTurn(); return; }

    if (node.type === 'arrivee') {
      addLog(`\u{1F3C6} ${team.emoji} ${team.name} atteint l'arriv\u00e9e !`);
      set({ finished: true });
      saveGame(get());
      return;
    }

    // Piege sur la case : declenche pour TOUTE equipe (poseur compris), one-shot.
    // Resolu AVANT le combat (un recul peut sortir la victime de la case adverse).
    if (node.trap) {
      const depth = get().trapDepth || 0;
      const trap = node.trap;
      const nb = { ...board };
      nb[team.pos] = { ...node }; delete nb[team.pos].trap; // nettoyage avant execution (idempotence)
      set({ board: nb, trapDepth: depth + 1 });
      soundTrap();
      addLog(`\u{1FAA4} ${team.emoji} ${team.name} declenche un piege${trap.label ? ` : ${trap.label}` : ''} !`);
      if (depth < 3) {
        effectH.runEffects(set, get, trap.do, { source: 'trap' });
        return;
      }
    }

    // Combat : la case (hors depart) est occupee par une autre equipe.
    // Le duel remplace l'action normale de la case.
    if (node.type !== 'depart') {
      const defenderIndex = teams.findIndex((t, i) => i !== currentTeam && t.pos === team.pos);
      if (defenderIndex !== -1) {
        const subj = node.type === 'subject' && node.subject !== 'multi' ? node.subject : randomSubject();
        fightH.startFight(set, get, defenderIndex, subj);
        return;
      }
    }

    if (node.type === 'event') {
      const picked = pickRandomEvent(enabledEvents);
      if (picked) {
        addLog(`\u{1F381} ${team.emoji} ${team.name} tombe sur : ${picked.event.icon} ${picked.event.name}`);
        eventH.triggerEvent(set, get, picked);
        return;
      }
      get().askQuestion(node.subject || randomSubject());
      return;
    }

    if (node.type === 'subject') {
      const subj = node.subject === 'multi' ? randomSubject() : node.subject;
      get().askQuestion(subj);
      return;
    }

    if (node.type === 'depart') { get().nextTurn(); return; }

    if (node.type === 'jonction') {
      get().askQuestion(randomSubject());
      return;
    }

    get().nextTurn();
  },

  // --- Questions ---
  askQuestion: (subject) => {
    // Thème forcé par un effet d'objet (ex. déclencheur « Selon le dé » →
    // changer la question) : s'applique à la PROCHAINE question, puis se consomme.
    const forced = get().forcedSubject;
    if (forced) { subject = forced; set({ forcedSubject: null }); }
    const { questions, askedQuestions, teams, currentTeam, addLog } = get();
    const team = teams[currentTeam];
    const pool = questions[subject] || [];
    const asked = askedQuestions[subject] || new Set();
    const result = pickQuestion(pool, asked);

    if (!result) {
      addLog(`\u26A0\uFE0F Pas de question disponible en ${SUBJECTS[subject]?.name || subject}.`);
      get().nextTurn();
      return;
    }

    const { question: q, newAsked } = result;
    const subjectInfo = SUBJECTS[subject];
    addLog(`${subjectInfo?.icon || ''} Question en ${subjectInfo?.name || subject}`);

    // Sablier (one-shot : consomme a la 1re question) et Double niv.3
    // (doubleTimerDivisor : persiste sur la rafale, nettoye avec BURST_RESET)
    const sablierDiv = team.sablierActif ? (team.sablierDivisor || 2) : 1;
    const doubleDiv = (team.doubleActive && team.doubleTimerDivisor) || 1;
    const timerDivisor = Math.max(sablierDiv, doubleDiv);
    const timerHalved = timerDivisor > 1;
    if (team.sablierActif) {
      const nt = [...get().teams];
      nt[currentTeam] = { ...nt[currentTeam], sablierActif: false, sablierDivisor: undefined };
      set({ teams: nt });
    }
    if (timerHalved) {
      addLog(`\u23F1\uFE0F Sablier actif ! Timer divis\u00e9 par ${timerDivisor}.`);
    }

    // Bonus de temps : equipement (permanent) + consommable Sablier de poche (one-shot)
    const itemBonusTime = getEffectValue(team, 'timerBonus') + (team.itemTimerBonus || 0);
    if (team.itemTimerBonus) {
      const nt = [...get().teams];
      nt[currentTeam] = { ...nt[currentTeam], itemTimerBonus: 0 };
      set({ teams: nt });
    }

    // Suivi de rafale Double (cumulable) : on lit l'equipe A JOUR (apres les set
    // partiels ci-dessus). doubleTotal est fige au demarrage de la rafale, doubleAsked
    // s'incremente a chaque question. Exposes a la modale pour l'affichage « X / N ».
    let multiIndex = null, multiTotal = null;
    const curTeam = get().teams[currentTeam];
    if (curTeam.doubleActive) {
      const started = (curTeam.doubleAsked || 0) > 0;
      multiTotal = started ? curTeam.doubleTotal : 1 + (curTeam.doubleExtra || 0);
      multiIndex = started ? curTeam.doubleAsked + 1 : 1;
      const nt = [...get().teams];
      nt[currentTeam] = { ...curTeam, doubleTotal: multiTotal, doubleAsked: multiIndex };
      set({ teams: nt });
    }

    // Equipement (indiceBoost) : elimine passivement des mauvaises reponses a
    // CHAQUE question. getEffectValue resout le de et la probabilite a chaque
    // appel (ex. 'd3' a 100% => 1 a 3 reponses retirees ; un 3 les retire toutes).
    const indiceBoost = getEffectValue(team, 'indiceBoost');
    let indiceHidden = [];
    if (indiceBoost > 0) {
      const wrong = q.a.map((_, i) => i).filter((i) => i !== q.c);
      for (let i = wrong.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [wrong[i], wrong[j]] = [wrong[j], wrong[i]];
      }
      indiceHidden = wrong.slice(0, Math.min(indiceBoost, wrong.length));
      if (indiceHidden.length) {
        const n = indiceHidden.length;
        addLog(`\u{1F4A1} Équipement : ${n} mauvaise${n > 1 ? 's' : ''} réponse${n > 1 ? 's' : ''} éliminée${n > 1 ? 's' : ''} d'office !`);
      }
    }

    set({
      showQuestion: { question: q, subject, index: result.index, timerHalved, timerDivisor, itemBonusTime, multiIndex, multiTotal },
      askedQuestions: { ...askedQuestions, [subject]: newAsked },
      indiceUsed: false, indiceHidden, rerollUsed: false,
    });
  },

  answerQuestion: (chosenIndex, timeLeft = 0) => {
    const { showQuestion, teams, currentTeam, addLog } = get();
    if (!showQuestion) return;

    const { question, timerHalved, timerDivisor, itemBonusTime } = showQuestion;
    const correct = chosenIndex === question.c;
    const team = teams[currentTeam];
    const newTeams = [...teams];
    const effectiveDivisor = timerDivisor || (timerHalved ? 2 : 1);
    // Meme echelle que le timer reellement affiche (QuestionModal) : le bonus
    // de temps d'equipement compte, sinon le ratio depasse 1 et gonfle le gain
    const maxTime = Math.floor(30 / effectiveDivisor) + (itemBonusTime || 0);
    // Ratio de temps restant (0..100) fig\u00e9 pour cette r\u00e9ponse : alimente la
    // m\u00e9trique d'\u00e9chelle 'timeleft' (ex. gain = 1\u00d7% temps restant). On l'attache
    // \u00e0 l'\u00e9quipe pour que getEffectValue / les d\u00e9clencheurs puissent la lire.
    const answerTimeRatio = Math.round(Math.max(0, Math.min(1, maxTime > 0 ? timeLeft / maxTime : 0)) * 100);
    const tTeam = { ...team, answerTimeRatio };

    if (correct) {
      // Double/triple: money only on last question (or never if doubleNoBonus)
      const noBonus = team.doubleActive && (team.doubleNoBonus || (team.doubleExtra || 0) > 0);
      // L'equipement (moneyPerCorrect) s'applique a chaque bonne reponse, meme sans bonus
      const equipBonus = getEffectValue(tTeam, 'moneyPerCorrect');
      const gain = (noBonus ? 0 : calculateMoneyGain(timeLeft, maxTime)) + equipBonus;
      // s\u00e9rie = +1 par TOUR r\u00e9ussi : pendant une rafale Double, on n'incr\u00e9mente
      // qu'\u00e0 la derni\u00e8re question (doubleExtra \u00e9puis\u00e9) ; cass\u00e9e sur erreur/timeout.
      const turnComplete = !team.doubleActive || (team.doubleExtra || 0) === 0;
      newTeams[currentTeam] = { ...team, answerTimeRatio, correct: team.correct + 1, streak: (team.streak || 0) + (turnComplete ? 1 : 0), money: team.money + gain };
      addLog(`\u2705 Bonne r\u00e9ponse !${gain > 0 ? ` +${gain} \u{1F4B0}` : (noBonus ? ' (pas de bonus)' : '')}`);
    } else {
      const { updatedTeam, logMessage, path } = resolveWrongAnswer(team, get().board, 'Mauvaise r\u00e9ponse');
      // erreur : la s\u00e9rie de bonnes r\u00e9ponses repart de 0
      newTeams[currentTeam] = { ...updatedTeam, answerTimeRatio, streak: 0 };
      addLog(logMessage);
      if (bouclierAbsorbed(team, updatedTeam)) { soundShield(); get().emitVfx('shield', currentTeam); }

      // Double/triple: wrong answer stops immediately, clear double state
      if (team.doubleActive) {
        newTeams[currentTeam] = { ...newTeams[currentTeam], ...BURST_RESET };
        addLog(`\u2753 Double question \u00e9chou\u00e9e ! Fin du tour.`);
      }

      const backPath = path ? [{ teamIndex: currentTeam, waypoints: path.map((id) => ({ x: get().board[id].x, y: get().board[id].y })), type: 'back' }] : null;
      set({ teams: newTeams, showQuestion: null, indiceUsed: false, indiceHidden: [], movePath: backPath });
      // D\u00e9clencheurs d'\u00e9quipement \u00ab \u00e0 la mauvaise r\u00e9ponse \u00bb (ex. perdre 5 PO).
      // Si l'effet ouvre un s\u00e9lecteur (interactif), on DIFF\u00c8RE nextTurn jusqu'\u00e0 la
      // fin de la file (sinon TURN_RESET \u00e9craserait la file + le picker).
      const finishWrong = () => { if (!get().finished) get().nextTurn(); };
      const onWrong = effectH.equipTriggerActions(get().teams[currentTeam], 'wrong');
      if (onWrong.length) {
        effectH.runEffects(set, get, onWrong, { source: 'item' });
        if (get().pendingActions) { set({ deferredTurnEnd: finishWrong }); return; }
      }
      finishWrong();
      return;
    }

    set({ teams: newTeams, showQuestion: null, indiceUsed: false, indiceHidden: [] });

    // Suite du tour (rafale Double / loot / nextTurn) encapsulée : peut être
    // DIFFÉRÉE si un déclencheur on:correct ouvre un sélecteur interactif (sinon
    // nextTurn/TURN_RESET écraserait la file d'effets en cours).
    const finishCorrect = () => {
      if (get().finished) return; // victoire déclenchée par un effet on:correct

      // Double/triple question: continue only on correct answer
      const updatedTeam = get().teams[currentTeam];
      const doubleResult = resolveDoubleQuestion(updatedTeam);
      if (doubleResult.shouldContinue) {
        const nt = [...get().teams];
        nt[currentTeam] = doubleResult.updatedTeam;
        set({ teams: nt });
        addLog(doubleResult.logMessage);
        get().askQuestion(randomSubject());
        if (get().phase === 'game') saveGame(get());
        return;
      } else if (doubleResult.updatedTeam !== updatedTeam) {
        const nt = [...get().teams];
        nt[currentTeam] = doubleResult.updatedTeam;
        set({ teams: nt });
      }

      // Loot de bonne réponse : au plus une fois par tour (la rafale Double y
      // revient une seule fois). Taux par canal = BASE × temps restant + BONUS
      // d'objet FLAT (un « +100% » garantit le loot). Canaux INDÉPENDANTS.
      const timeRatio = Math.max(0, Math.min(1, timeLeft / maxTime));
      const enabledForLoot = get().enabledItems || Object.keys(ITEMS);
      const lootTeam = get().teams[currentTeam];
      const consumRate = (LOOT.answerConsumableRate || 0) * timeRatio + getEffectValue(lootTeam, 'lootBonusConsumable') / 100;
      const equipRate = LOOT.answerLootRate * timeRatio + getEffectValue(lootTeam, 'lootBonusEquipment') / 100;
      const drops = [];
      if (Math.random() < consumRate) {
        const k = itemH.pickLootItem(0, enabledForLoot, { category: 'consumable' });
        if (k) drops.push(k);
      }
      if (Math.random() < equipRate) {
        const k = itemH.pickLootItem(LOOT.answerLegendaryChance, enabledForLoot, { category: 'equipment' });
        if (k) drops.push(k);
      }
      const revealQueue = [];
      if (drops.length) {
        const nt = [...get().teams];
        for (const k of drops) {
          const r = itemH.placeItem(nt[currentTeam], k);
          nt[currentTeam] = r.team;
          if (r.outcome === 'refunded') {
            addLog(`✨ ${team.emoji} ${team.name} trouve ${ITEMS[k].icon} ${ITEMS[k].name}... sac plein, revendu +${r.refund} \u{1F4B0} !`);
          } else {
            addLog(`✨ ${team.emoji} ${team.name} trouve un objet : ${ITEMS[k].icon} ${ITEMS[k].name} !`);
            revealQueue.push(k);
          }
        }
        set({ teams: nt });
      }

      get().nextTurn();
      if (revealQueue.length) {
        const [first, ...rest] = revealQueue;
        get().showLoot(first, {
          title: '✨ Bien joué !',
          subtitle: rest.length ? 'Double butin ! (1/2)' : 'Récompense de bonne réponse',
          rest: rest.map((k) => ({ itemKey: k, title: '✨ Et en plus…', subtitle: 'Double butin ! (2/2)' })),
        });
      }
    };

    // Déclencheurs d'équipement « à la bonne réponse » (perte/gain/charge…)
    const onCorrect = effectH.equipTriggerActions(get().teams[currentTeam], 'correct');
    if (onCorrect.length) {
      effectH.runEffects(set, get, onCorrect, { source: 'item' });
      if (get().pendingActions) { set({ deferredTurnEnd: finishCorrect }); return; }
    }
    finishCorrect();
  },

  timeoutQuestion: () => {
    const { teams, currentTeam, addLog } = get();
    const team = teams[currentTeam];
    const newTeams = [...teams];

    const { updatedTeam, logMessage, path } = resolveWrongAnswer(team, get().board, 'Temps \u00e9coul\u00e9');
    // temps \u00e9coul\u00e9 = erreur : s\u00e9rie remise \u00e0 0, et 0% de temps restant
    newTeams[currentTeam] = { ...updatedTeam, streak: 0, answerTimeRatio: 0 };
    addLog(logMessage);
    if (bouclierAbsorbed(team, updatedTeam)) { soundShield(); get().emitVfx('shield', currentTeam); }

    if (team.doubleActive) {
      newTeams[currentTeam] = { ...newTeams[currentTeam], ...BURST_RESET };
      addLog(`\u2753 Double question \u00e9chou\u00e9e ! Fin du tour.`);
    }

    const backPath = path ? [{ teamIndex: currentTeam, waypoints: path.map((id) => ({ x: get().board[id].x, y: get().board[id].y })), type: 'back' }] : null;
    set({ teams: newTeams, showQuestion: null, indiceUsed: false, indiceHidden: [], movePath: backPath });
    // D\u00e9clencheurs d'\u00e9quipement \u00ab \u00e0 la mauvaise r\u00e9ponse \u00bb (timeout compris).
    // nextTurn diff\u00e9r\u00e9 si l'effet ouvre un s\u00e9lecteur (cf. answerQuestion).
    const finishWrong = () => { if (!get().finished) get().nextTurn(); };
    const onWrong = effectH.equipTriggerActions(get().teams[currentTeam], 'wrong');
    if (onWrong.length) {
      effectH.runEffects(set, get, onWrong, { source: 'item' });
      if (get().pendingActions) { set({ deferredTurnEnd: finishWrong }); return; }
    }
    finishWrong();
  },

  // --- Events (delegated) ---
  triggerEvent: (picked) => eventH.triggerEvent(set, get, picked),
  revealEvent: () => eventH.revealEvent(set, get),
  acceptEvent: () => eventH.acceptEvent(set, get),
  declineEvent: () => eventH.declineEvent(set, get),
  eventSelectTarget: (ti) => eventH.eventSelectTarget(set, get, ti),
  eventRollDice: () => eventH.eventRollDice(set, get),
  eventAskQuestion: () => eventH.eventAskQuestion(set, get),
  eventAnswerQuestion: (ci) => eventH.eventAnswerQuestion(set, get, ci),
  eventRechargeChoice: (pk) => eventH.eventRechargeChoice(set, get, pk),
  eventMarcheNoirBuy: (pk) => eventH.eventMarcheNoirBuy(set, get, pk),
  eventVolApply: (stealKey, giveKey) => eventH.eventVolApply(set, get, stealKey, giveKey),
  eventMerchantBuy: (itemKey) => eventH.eventMerchantBuy(set, get, itemKey),
  eventPillageApply: (pick) => eventH.eventPillageApply(set, get, pick),
  applyEventEffect: () => eventH.applyEventEffect(set, get),
  closeEvent: () => {
    set({ showEvent: null, eventApplied: false });
    get().nextTurn();
    if (get().phase === 'game') saveGame(get());
  },

  // --- Animation ---
  // Retire l'animation d'un pion qui a fini son trajet ; null quand plus aucune.
  clearTeamMove: (teamIndex) => {
    const mp = get().movePath;
    if (!mp) return;
    const rest = mp.filter((m) => m.teamIndex !== teamIndex);
    set({ movePath: rest.length ? rest : null });
  },

  // Effet visuel transitoire (foudre/bouclier...) consomme par les overlays.
  // id monotone via un compteur unique → jamais deux fois le meme id d'affilee.
  emitVfx: (type, teamIndex) => set({ vfx: { type, teamIndex, id: ++vfxSeq } }),
  clearVfx: () => set({ vfx: null }),

  // Toasts d'effet animes (moteur d'effets composable) — auto-retires par l'overlay.
  effectToasts: [],
  dismissFx: (id) => set({ effectToasts: (get().effectToasts || []).filter((t) => t.id !== id) }),

  // --- Confirm landing (player done using powers) ---
  confirmLanding: () => {
    if (!get().pendingLanding) return;
    set({ pendingLanding: false, freeActivation: false });
    get().handleLanding();
  },

  // --- Dev : ajoute des pieces a l'equipe active (localhost uniquement) ---
  devAddMoney: (amount = 10) => {
    const { teams, currentTeam, addLog } = get();
    if (!teams.length) return;
    const team = teams[currentTeam];
    const newTeams = [...teams];
    newTeams[currentTeam] = { ...team, money: (team.money ?? 0) + amount };
    addLog(`\u{1F6E0}️ [dev] ${team.emoji} ${team.name} reçoit ${amount} pièces.`);
    set({ teams: newTeams });
  },

  // --- Dev : simulateur de combat (localhost uniquement, voir Setup) ---
  devStartFight: (subject, forceDefault = false) => {
    const { setupTeams, boardParams, level, useBrevet } = get();
    const { nodes, viewBox } = generateBoard(boardParams);
    // Deux equipes de test, equipees pour rendre la recompense interessante
    const teams = setupTeams.slice(0, 2).map((t) => ({
      ...t,
      pos: 'depart',
      money: 25,
      powerDef: 'bouclier',
      powerOff: 'foudre',
      powers: { bouclier: { charges: 2, level: 1 }, foudre: { charges: 2, level: 1 } },
      equipment: { head: null, body: null, feet: null },
      bag: Array(itemH.BAG_SIZE).fill(null),
    }));
    const questions = getQuestions(level, { brevet: useBrevet });
    set({
      devSandbox: true,
      phase: 'game', teams, board: nodes, viewBox, questions,
      boardDecor: generateDecor(nodes),
      currentTeam: 0, finished: false, askedQuestions: {}, log: [],
      ...TURN_RESET, movePath: null,
      showQuestion: null, showEvent: null, showFight: null, showDiceModal: false, eventApplied: false, lootReveal: null,
    });
    fightH.startFight(set, get, 1, subject);
    if (forceDefault) set({ showFight: { ...get().showFight, forceDefault: true } });
  },

  // --- Fight (delegated) ---
  fightBegin: () => fightH.fightBegin(set, get),
  fightStart: () => fightH.fightStart(set, get),
  fightRoundWin: (side) => fightH.fightRoundWin(set, get, side),
  fightMatchWin: (side) => fightH.fightMatchWin(set, get, side),
  fightChooseReward: (choice) => fightH.fightChooseReward(set, get, choice),
  closeFight: () => fightH.closeFight(set, get),
  // Tire une question pour un mini-jeu de combat (marquee comme posee)
  fightPickQuestion: (subject) => {
    const { questions, askedQuestions } = get();
    const pool = questions[subject] || [];
    const asked = askedQuestions[subject] || new Set();
    const result = pickQuestion(pool, asked);
    if (!result) return null;
    set({ askedQuestions: { ...askedQuestions, [subject]: result.newAsked } });
    return result.question;
  },

  // --- Powers (delegated) ---
  usePower: (pk) => powerH.usePower(set, get, pk),
  useIndice: () => powerH.useIndice(set, get),
  useRelance: () => powerH.useRelance(set, get),
  applyOffensivePower: (ti) => powerH.applyOffensivePower(set, get, ti),
  cancelTargetPicker: () => powerH.cancelTargetPicker(set, get),

  // --- Charge picker (delegated) ---
  chargePickerChoice: (pk) => powerH.chargePickerChoice(set, get, pk),
  chargePickerSkip: () => powerH.chargePickerSkip(set, get),

  // --- Shop (delegated) ---
  openShop: () => {
    const { finished, rolling, showQuestion, showEvent, showFight, awaitingChoice } = get();
    if (finished || rolling || showQuestion || showEvent || showFight || awaitingChoice) return;
    set({ showShop: true });
  },
  closeShop: () => {
    // Marché Noir : la boutique a été ouverte par un événement → fermer = fin du tour.
    const mn = typeof get().showShop === 'object' && get().showShop?.marcheNoir;
    set({ showShop: false });
    if (mn) get().nextTurn(); // nextTurn sauvegarde déjà
  },
  buyNewPower: (pk) => powerH.buyNewPower(set, get, pk),
  buyPowerCharge: (pk) => powerH.buyPowerCharge(set, get, pk),
  upgradePowerLevel: (pk) => powerH.upgradePowerLevel(set, get, pk),

  // --- Items / inventaire (delegated) ---
  openInventory: () => {
    const { finished, rolling, showQuestion, showEvent, showFight, awaitingChoice } = get();
    if (finished || rolling || showQuestion || showEvent || showFight || awaitingChoice) return;
    set({ showInventory: true });
  },
  closeInventory: () => set({ showInventory: false }),
  buyItem: (key) => itemH.buyItem(set, get, key),
  sellEquipment: (slot) => itemH.sellEquipment(set, get, slot),
  sellBagItem: (i) => itemH.sellBagItem(set, get, i),
  useConsumable: (i) => itemH.useConsumable(set, get, i),
  moveInventoryItem: (fromKey, toKey) => itemH.moveInventoryItem(set, get, fromKey, toKey),

  // --- Moteur d'effets composable (objets) : routeurs des interruptions ---
  // Sélecteur de cible générique : route vers le pouvoir (legacy) ou le moteur.
  selectTarget: (i) => {
    const stp = get().showTargetPicker;
    if (stp?.source === 'engine') {
      set({ showTargetPicker: null });
      effectH.resumeQueue(set, get, { targetTeam: i });
      return;
    }
    powerH.applyOffensivePower(set, get, i);
  },
  cancelTargetPicker: () => {
    const stp = get().showTargetPicker;
    if (stp?.source === 'engine') {
      // Annuler = sauter l'action ciblée et continuer le reste de la file
      set({ showTargetPicker: null });
      const pa = get().pendingActions;
      if (pa) {
        set({ pendingActions: { ...pa, queue: pa.queue.slice(1) } });
        effectH.runQueue(set, get);
      }
      return;
    }
    powerH.cancelTargetPicker(set, get);
  },
  // Sélecteur de case (pose de piège)
  selectTile: (nodeId) => {
    if (!get().showTilePicker) return;
    set({ showTilePicker: null });
    effectH.resumeQueue(set, get, { tile: nodeId });
  },
  cancelTilePicker: () => {
    if (!get().showTilePicker) return;
    set({ showTilePicker: null });
    const pa = get().pendingActions;
    if (pa) { set({ pendingActions: { ...pa, queue: pa.queue.slice(1) } }); effectH.runQueue(set, get); }
  },
  // Sélecteur de thème (reroll de question « au choix »)
  selectSubject: (key) => {
    if (!get().showSubjectPicker) return;
    set({ showSubjectPicker: false });
    effectH.resumeQueue(set, get, { subject: key });
  },
  // Bouton « changer la question » : exécute le reroll fourni par un objet
  useQuestionReroll: (opt) => {
    const { showQuestion, pendingActions, rerollUsed, teams, currentTeam } = get();
    if (!showQuestion || pendingActions || !opt) return;
    if (opt.fromBag) {
      const bag = itemH.normalizeBag(teams[currentTeam].bag);
      bag[opt.bagIndex] = null;
      const nt = [...teams];
      nt[currentTeam] = { ...nt[currentTeam], bag };
      set({ teams: nt });
    } else if (rerollUsed) {
      return; // équipement : un seul reroll par question
    }
    effectH.runEffects(set, get, opt.actions, { source: 'question' });
  },

  // --- Turn management ---
  nextTurn: () => {
    const { teams, currentTeam, finished, shopStockTurns, addLog } = get();
    if (finished) return;

    // Stock rotatif de la boutique : renouvele apres N tours
    const turnsLeft = (shopStockTurns ?? 0) - 1;
    if (turnsLeft <= 0) {
      set({ shopStock: itemH.generateShopStock(itemH.SHOP_STOCK_SIZE, get().enabledItems), shopStockTurns: teams.length * 2 });
      addLog(`🛒 La boutique renouvelle son stock d'objets !`);
    } else {
      set({ shopStockTurns: turnsLeft });
    }

    const newCurrent = (currentTeam + 1) % teams.length;
    // Buffs à durée (tours) : on décrémente quand l'équipe REGAGNE la main ;
    // expiration à 0. (Fumigène posé avec une durée X ; autres buffs à venir.)
    let nt = get().teams;
    const ct = nt[newCurrent];
    if (ct?.itemFumigeneTurns > 0) {
      const left = ct.itemFumigeneTurns - 1;
      nt = [...nt];
      nt[newCurrent] = left > 0
        ? { ...ct, itemFumigeneTurns: left }
        : { ...ct, itemFumigene: false, itemFumigeneTurns: undefined };
      if (left <= 0) addLog(`💨 Le fumigène de ${ct.emoji} ${ct.name} s'est dissipé.`);
    }

    set({ currentTeam: newCurrent, teams: nt, ...TURN_RESET });
    if (get().phase === 'game') saveGame(get());
  },

  // --- Resume saved game ---
  resumeGame: () => {
    const saved = loadGame();
    if (!saved) return;
    set({
      ...saved,
      devSandbox: false,
      rolling: false,
      ...TURN_RESET,
      movePath: null,
      showQuestion: null, showEvent: null, showFight: null, showDiceModal: false, eventApplied: false, lootReveal: null,
    });
    // Sauvegardes anterieures au systeme d'objets : le CHAMP est absent.
    // Un tableau vide est un etat legitime (tout decoche au setup / etal vide)
    // et doit etre respecte — d'ou le test sur la presence, pas sur la longueur.
    if (!Array.isArray(saved.enabledItems)) set({ enabledItems: Object.keys(ITEMS) });
    // knownItemKeys : sans lui, des objets décochés réapparaîtraient cochés (la
    // garde "objet jamais vu" se baserait sur le catalogue courant). Anciennes
    // sauvegardes sans ce champ : on retombe sur le catalogue connu actuel.
    if (!Array.isArray(saved.knownItemKeys)) set({ knownItemKeys: Object.keys(ITEMS) });
    // Le catalogue ITEMS est dynamique (édité via l'éditeur) : purger des équipes
    // les clés d'objets qui n'existent plus, sinon un slot reste occupé par un
    // « fantôme » (objet invisible, effet perdu, slot bloqué). Le sac est filtré
    // par normalizeBag ; on protège de même l'équipement.
    const resumedTeams = get().teams;
    if (Array.isArray(resumedTeams) && resumedTeams.length) {
      set({
        teams: resumedTeams.map((t) => {
          const eq = t.equipment || { head: null, body: null, feet: null };
          const cleaned = {};
          for (const slot of ['head', 'body', 'feet']) cleaned[slot] = (eq[slot] && ITEMS[eq[slot]]) ? eq[slot] : null;
          return { ...t, equipment: cleaned, bag: itemH.normalizeBag(t.bag) };
        }),
      });
    }
    // Sauvegardes sans decor OU a un ANCIEN format : regenerer. Le format
    // actuel (phase 3) n'a plus de champ `layer` et peut contenir des
    // bannieres/palmiers/buissons/rochers/fanions — on detecte donc l'ancien
    // format par la presence du champ `layer` ou d'assets retires (pont/plage/
    // clairiere/disc), PAS par "ne commence pas par prop-".
    const dec = get().boardDecor;
    const oldFormat = !dec?.length
      || dec.some((d) => ('layer' in d) || /^(pont|plage|bridge|clairiere|disc)-/.test(d.img || ''));
    if (get().board && oldFormat) {
      set({ boardDecor: generateDecor(get().board) });
    }
    if (!Array.isArray(saved.shopStock)) {
      set({ shopStock: itemH.generateShopStock(itemH.SHOP_STOCK_SIZE, get().enabledItems), shopStockTurns: get().teams.length * 2 });
    }
  },

  // --- Reset ---
  reset: () => {
    // En bac a sable dev, ne pas effacer la sauvegarde de la vraie partie
    if (!get().devSandbox) clearSave();
    set({
      devSandbox: false,
      phase: 'setup', teams: [], currentTeam: 0, board: null, boardDecor: null, finished: false,
      askedQuestions: {}, questions: {}, log: [],
      shopStock: [], shopStockTurns: 0,
      rolling: false, ...TURN_RESET, movePath: null,
      showQuestion: null, showEvent: null, showFight: null, showDiceModal: false, eventApplied: false, lootReveal: null,
      nbTeams: 3, setupTeams: createDefaultTeams(3),
      enabledEvents: Object.keys(EVENTS),
      enabledItems: Object.keys(ITEMS),
      boardParams: {
        casesParVoie: 4, nbVoies: 3, nbSections: 3,
        voieFinale: 'court-long', couloirsMix: 2, eventEveryX: 3,
      },
    });
  },
}));

// Accès au store depuis la console en développement (debug / tests manuels)
if (import.meta.env.DEV && typeof window !== 'undefined') {
  window.__store = useGameStore;
  window.__ITEMS = ITEMS;
  window.__effectH = effectH;
}
