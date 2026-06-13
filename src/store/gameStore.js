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
import * as eventH from './eventHandlers.js';
import * as powerH from './powerHandlers.js';
import * as fightH from './fightHandlers.js';
import * as itemH from './itemHandlers.js';
import { ITEMS } from '../data/items.js';
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
    money: 0,
    powerDef: null,
    powerOff: null,
    sablierActif: false,
    doubleActive: false,
  }));
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

  // --- Log ---
  addLog: (msg) => set({ log: [...get().log, msg] }),

  // --- Révélation d'objet (visuel C) ---
  showLoot: (itemKey, opts = {}) => set({ lootReveal: { itemKey, ...opts } }),
  dismissLoot: () => {
    const lr = get().lootReveal;
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
    const { finished, rolling, showDiceModal, showFight } = get();
    if (finished || rolling || showDiceModal || showFight) return;
    const finalValue = Math.floor(Math.random() * 6) + 1;
    set({ rolling: true, diceValue: finalValue, showDiceModal: true });
  },

  completeDiceRoll: () => {
    const { diceValue } = get();
    set({ showDiceModal: false, rolling: false });
    if (diceValue) get().handleDiceResult(diceValue);
  },

  handleDiceResult: (value) => {
    const { teams, currentTeam, board, addLog } = get();
    const team = teams[currentTeam];
    set({ preRollPos: team.pos, preRollValue: value, freeActivation: false });
    addLog(`${team.emoji} ${team.name} lance le d\u00e9 : ${value}`);

    const result = moveForward(board, team.pos, value);
    const newTeams = [...teams];
    newTeams[currentTeam] = { ...team, pos: result.finalPos };
    // Build animation waypoints from path
    const waypoints = result.path.map((id) => ({ x: board[id].x, y: board[id].y }));
    set({ teams: newTeams, movePath: [{ teamIndex: currentTeam, waypoints, type: 'forward' }] });

    if (result.stoppedAtJunction) {
      set({ awaitingChoice: true, pendingMove: { remaining: result.remaining } });
      addLog(`\u2194\uFE0F Choisis une voie !`);
      return;
    }

    // Rolling a 1: open charge picker
    if (value === 1) {
      addLog(`\u2728 ${team.emoji} A fait 1 ! Choisis un pouvoir \u00e0 recharger gratuitement !`);
      set({ showChargePicker: { source: 'dice' }, freeActivation: true, pendingLanding: true });
      return;
    }

    // Wait for player to use powers or click "Continuer"
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
        set({ awaitingChoice: true, pendingMove: { remaining: result.remaining, noLanding } });
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

    set({
      showQuestion: { question: q, subject, index: result.index, timerHalved, timerDivisor, itemBonusTime },
      askedQuestions: { ...askedQuestions, [subject]: newAsked },
      indiceUsed: false, indiceHidden: [],
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

    if (correct) {
      // Double/triple: money only on last question (or never if doubleNoBonus)
      const noBonus = team.doubleActive && (team.doubleNoBonus || (team.doubleCount || 0) > 1);
      // L'equipement (moneyPerCorrect) s'applique a chaque bonne reponse, meme sans bonus
      const equipBonus = getEffectValue(team, 'moneyPerCorrect');
      const gain = (noBonus ? 0 : calculateMoneyGain(timeLeft, maxTime)) + equipBonus;
      newTeams[currentTeam] = { ...team, correct: team.correct + 1, money: team.money + gain };
      addLog(`\u2705 Bonne r\u00e9ponse !${gain > 0 ? ` +${gain} \u{1F4B0}` : (noBonus ? ' (pas de bonus)' : '')}`);
    } else {
      const { updatedTeam, logMessage, path } = resolveWrongAnswer(team, get().board, 'Mauvaise r\u00e9ponse');
      newTeams[currentTeam] = updatedTeam;
      addLog(logMessage);

      // Double/triple: wrong answer stops immediately, clear double state
      if (team.doubleActive) {
        newTeams[currentTeam] = { ...newTeams[currentTeam], ...BURST_RESET };
        addLog(`\u2753 Double question \u00e9chou\u00e9e ! Fin du tour.`);
      }

      const backPath = path ? [{ teamIndex: currentTeam, waypoints: path.map((id) => ({ x: get().board[id].x, y: get().board[id].y })), type: 'back' }] : null;
      set({ teams: newTeams, showQuestion: null, indiceUsed: false, indiceHidden: [], movePath: backPath });
      get().nextTurn();
      return;
    }

    set({ teams: newTeams, showQuestion: null, indiceUsed: false, indiceHidden: [] });

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

    // Loot de bonne réponse : on n'atteint ce point qu'à la DERNIÈRE bonne
    // réponse du tour (une rafale Double y revient une seule fois), donc le
    // tirage a lieu au plus une fois par tour. Chance = 10 % × (temps restant
    // / temps max) — récompense la rapidité, plafonnée à 10 %.
    const lootChance = 0.10 * Math.max(0, Math.min(1, timeLeft / maxTime));
    let lootKey = null;
    if (Math.random() < lootChance) {
      const key = itemH.pickLootItem(0.1, get().enabledItems || Object.keys(ITEMS));
      if (key) {
        const nt = [...get().teams];
        const r = itemH.placeItem(nt[currentTeam], key);
        nt[currentTeam] = r.team;
        set({ teams: nt });
        if (r.outcome === 'refunded') {
          addLog(`✨ ${team.emoji} ${team.name} trouve ${ITEMS[key].icon} ${ITEMS[key].name}... sac plein, revendu +${r.refund} \u{1F4B0} !`);
        } else {
          lootKey = key;
          addLog(`✨ ${team.emoji} ${team.name} trouve un objet : ${ITEMS[key].icon} ${ITEMS[key].name} !`);
        }
      }
    }

    get().nextTurn();
    if (lootKey) get().showLoot(lootKey, { title: '✨ Bien joué !', subtitle: 'Récompense de bonne réponse' });
  },

  timeoutQuestion: () => {
    const { teams, currentTeam, addLog } = get();
    const team = teams[currentTeam];
    const newTeams = [...teams];

    const { updatedTeam, logMessage, path } = resolveWrongAnswer(team, get().board, 'Temps \u00e9coul\u00e9');
    newTeams[currentTeam] = updatedTeam;
    addLog(logMessage);

    if (team.doubleActive) {
      newTeams[currentTeam] = { ...newTeams[currentTeam], ...BURST_RESET };
      addLog(`\u2753 Double question \u00e9chou\u00e9e ! Fin du tour.`);
    }

    const backPath = path ? [{ teamIndex: currentTeam, waypoints: path.map((id) => ({ x: get().board[id].x, y: get().board[id].y })), type: 'back' }] : null;
    set({ teams: newTeams, showQuestion: null, indiceUsed: false, indiceHidden: [], movePath: backPath });
    get().nextTurn();
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
  closeShop: () => set({ showShop: false }),
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

    set({
      currentTeam: (currentTeam + 1) % teams.length,
      ...TURN_RESET,
    });
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
    // Sauvegardes sans decor OU a l'ancien format (clairieres/vegetation) :
    // regenerer avec le placement actuel (props thematiques sur l'herbe)
    const dec = get().boardDecor;
    const oldFormat = !dec?.length || dec.some((d) => d.layer === 'ground' || !d.img?.startsWith('prop-'));
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
}
