import { create } from 'zustand';
import { TEAM_COLORS, TEAM_DEFAULTS, TEAM_DEFAULT_EMOJIS, TEAM_BLAZON_GLYPHS } from '../data/teamPresets.js';
import { EVENTS } from '../data/events.js';
import { SUBJECTS, SUBJECT_KEYS } from '../data/subjects.js';
import { POWERS } from '../data/powers.js';
import { generateBoard } from '../logic/boardGenerator.js';
import { moveForward, moveBack } from '../logic/pathfinding.js';
import { pickQuestion } from '../logic/questionPicker.js';
import { pickRandomEvent } from '../logic/eventPicker.js';
import { getQuestions } from '../data/questions/index.js';
import { calculateMoneyGain } from '../logic/moneyCalculator.js';
import { saveGame, loadGame, clearSave } from './persistence.js';
import { randomSubject, resolveWrongAnswer, resolveDoubleQuestion } from '../logic/turnHelpers.js';
import * as eventH from './eventHandlers.js';
import * as powerH from './powerHandlers.js';

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

// UI state reset shared by nextTurn, resumeGame, reset
const TURN_RESET = {
  diceValue: null,
  pendingMove: null,
  pendingLanding: false,
  awaitingChoice: false,
  preRollPos: null,
  preRollValue: null,
  showTargetPicker: null,
  showShop: false,
  indiceUsed: false,
  indiceHidden: [],
  freeActivation: false,
  showChargePicker: false,
  movePath: null,
};

export const useGameStore = create((set, get) => ({
  // --- Phase ---
  phase: 'setup',
  setPhase: (phase) => set({ phase }),

  // --- Setup state ---
  level: 'cycle4',
  setLevel: (level) => set({ level }),

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

  // --- Game state ---
  teams: [],
  currentTeam: 0,
  board: null,
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
  showQuestion: null,
  showEvent: null,
  eventApplied: false,
  showTargetPicker: null,
  indiceUsed: false,
  indiceHidden: [],
  showDiceModal: false,
  showShop: false,
  preRollPos: null,
  preRollValue: null,
  // Animation: { teamIndex, waypoints: [{x,y},...], type: 'forward'|'back' }
  movePath: null,

  // --- Power selection ---
  powerSetupIndex: 0,
  powerSetupCategory: 'def',

  // --- Log ---
  addLog: (msg) => set({ log: [...get().log, msg] }),

  // --- Start game ---
  startGame: () => {
    const { setupTeams, boardParams, level } = get();
    const { nodes, viewBox } = generateBoard(boardParams);
    const teams = setupTeams.map((t) => ({ ...t, pos: 'depart', powers: {} }));
    const questions = getQuestions(level);
    set({
      phase: 'powerSelect', teams, board: nodes, viewBox, questions,
      currentTeam: 0, finished: false, askedQuestions: {}, log: [],
      ...TURN_RESET,
      showQuestion: null, showEvent: null, showDiceModal: false, eventApplied: false,
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
    const { finished, rolling, showDiceModal } = get();
    if (finished || rolling || showDiceModal) return;
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
    set({ teams: newTeams, movePath: { teamIndex: currentTeam, waypoints, type: 'forward' } });

    if (result.stoppedAtJunction) {
      set({ awaitingChoice: true, pendingMove: { remaining: result.remaining } });
      addLog(`\u2194\uFE0F Choisis une voie !`);
      return;
    }

    // Rolling a 1: open charge picker
    if (value === 1) {
      addLog(`\u2728 ${team.emoji} A fait 1 ! Choisis un pouvoir \u00e0 recharger gratuitement !`);
      set({ showChargePicker: true, freeActivation: true, pendingLanding: true });
      return;
    }

    // Wait for player to use powers or click "Continuer"
    set({ pendingLanding: true });
  },

  // --- Junction choice ---
  chooseJunction: (nextNodeId) => {
    const { teams, currentTeam, board, pendingMove } = get();
    const team = teams[currentTeam];
    set({ pendingLanding: false });

    const newTeams = [...teams];
    newTeams[currentTeam] = { ...team, pos: nextNodeId };
    set({ teams: newTeams, awaitingChoice: false });

    if (pendingMove && pendingMove.remaining > 1) {
      const result = moveForward(board, nextNodeId, pendingMove.remaining - 1);
      const updatedTeams = [...get().teams];
      updatedTeams[currentTeam] = { ...updatedTeams[currentTeam], pos: result.finalPos };
      const waypoints = result.path.map((id) => ({ x: board[id].x, y: board[id].y }));
      set({ teams: updatedTeams, pendingMove: null, movePath: { teamIndex: currentTeam, waypoints, type: 'forward' } });

      if (result.stoppedAtJunction) {
        set({ awaitingChoice: true, pendingMove: { remaining: result.remaining } });
        return;
      }
    } else {
      set({ pendingMove: null });
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

    const timerDivisor = team.sablierActif ? (team.sablierDivisor || 2) : 1;
    const timerHalved = team.sablierActif || false;
    if (timerHalved) {
      const nt = [...get().teams];
      nt[currentTeam] = { ...nt[currentTeam], sablierActif: false, sablierDivisor: undefined };
      set({ teams: nt });
      addLog(`\u23F1\uFE0F Sablier actif ! Timer divis\u00e9 par ${timerDivisor}.`);
    }

    set({
      showQuestion: { question: q, subject, index: result.index, timerHalved, timerDivisor },
      askedQuestions: { ...askedQuestions, [subject]: newAsked },
      indiceUsed: false, indiceHidden: [],
    });
  },

  answerQuestion: (chosenIndex, timeLeft = 0) => {
    const { showQuestion, teams, currentTeam, addLog } = get();
    if (!showQuestion) return;

    const { question, timerHalved, timerDivisor } = showQuestion;
    const correct = chosenIndex === question.c;
    const team = teams[currentTeam];
    const newTeams = [...teams];
    const effectiveDivisor = timerDivisor || (timerHalved ? 2 : 1);
    const maxTime = Math.floor(30 / effectiveDivisor);

    if (correct) {
      // Double/triple: money only on last question (or never if doubleNoBonus)
      const noBonus = team.doubleActive && (team.doubleNoBonus || (team.doubleCount || 0) > 1);
      const gain = noBonus ? 0 : calculateMoneyGain(timeLeft, maxTime);
      newTeams[currentTeam] = { ...team, correct: team.correct + 1, money: team.money + gain };
      addLog(`\u2705 Bonne r\u00e9ponse !${gain > 0 ? ` +${gain} \u{1F4B0}` : (noBonus ? ' (pas de bonus)' : '')}`);
    } else {
      const { updatedTeam, logMessage, path } = resolveWrongAnswer(team, get().board, 'Mauvaise r\u00e9ponse');
      newTeams[currentTeam] = updatedTeam;
      addLog(logMessage);

      // Double/triple: wrong answer stops immediately, clear double state
      if (team.doubleActive) {
        newTeams[currentTeam] = { ...newTeams[currentTeam], doubleActive: false, doubleCount: 0, doubleNoBonus: false };
        addLog(`\u2753 Double question \u00e9chou\u00e9e ! Fin du tour.`);
      }

      const backPath = path ? { teamIndex: currentTeam, waypoints: path.map((id) => ({ x: get().board[id].x, y: get().board[id].y })), type: 'back' } : null;
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

    get().nextTurn();
  },

  timeoutQuestion: () => {
    const { teams, currentTeam, addLog } = get();
    const team = teams[currentTeam];
    const newTeams = [...teams];

    const { updatedTeam, logMessage, path } = resolveWrongAnswer(team, get().board, 'Temps \u00e9coul\u00e9');
    newTeams[currentTeam] = updatedTeam;
    addLog(logMessage);

    if (team.doubleActive) {
      newTeams[currentTeam] = { ...newTeams[currentTeam], doubleActive: false, doubleCount: 0, doubleNoBonus: false };
      addLog(`\u2753 Double question \u00e9chou\u00e9e ! Fin du tour.`);
    }

    const backPath = path ? { teamIndex: currentTeam, waypoints: path.map((id) => ({ x: get().board[id].x, y: get().board[id].y })), type: 'back' } : null;
    set({ teams: newTeams, showQuestion: null, indiceUsed: false, indiceHidden: [], movePath: backPath });
    get().nextTurn();
  },

  // --- Events (delegated) ---
  triggerEvent: (picked) => eventH.triggerEvent(set, get, picked),
  acceptEvent: () => eventH.acceptEvent(set, get),
  declineEvent: () => eventH.declineEvent(set, get),
  eventSelectTarget: (ti) => eventH.eventSelectTarget(set, get, ti),
  eventRollDice: () => eventH.eventRollDice(set, get),
  eventAskQuestion: () => eventH.eventAskQuestion(set, get),
  eventAnswerQuestion: (ci) => eventH.eventAnswerQuestion(set, get, ci),
  eventRechargeChoice: (pk) => eventH.eventRechargeChoice(set, get, pk),
  applyEventEffect: () => eventH.applyEventEffect(set, get),
  closeEvent: () => {
    set({ showEvent: null, eventApplied: false });
    get().nextTurn();
    if (get().phase === 'game') saveGame(get());
  },

  // --- Animation ---
  clearMovePath: () => set({ movePath: null }),

  // --- Confirm landing (player done using powers) ---
  confirmLanding: () => {
    if (!get().pendingLanding) return;
    set({ pendingLanding: false, freeActivation: false });
    get().handleLanding();
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
    const { finished, rolling, showQuestion, showEvent, awaitingChoice } = get();
    if (finished || rolling || showQuestion || showEvent || awaitingChoice) return;
    set({ showShop: true });
  },
  closeShop: () => set({ showShop: false }),
  buyNewPower: (pk) => powerH.buyNewPower(set, get, pk),
  buyPowerCharge: (pk) => powerH.buyPowerCharge(set, get, pk),
  upgradePowerLevel: (pk) => powerH.upgradePowerLevel(set, get, pk),

  // --- Turn management ---
  nextTurn: () => {
    const { teams, currentTeam, finished } = get();
    if (finished) return;
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
      rolling: false,
      ...TURN_RESET,
      showQuestion: null, showEvent: null, showDiceModal: false, eventApplied: false,
    });
  },

  // --- Reset ---
  reset: () => {
    clearSave();
    set({
      phase: 'setup', teams: [], currentTeam: 0, board: null, finished: false,
      askedQuestions: {}, questions: {}, log: [],
      rolling: false, ...TURN_RESET,
      showQuestion: null, showEvent: null, showDiceModal: false, eventApplied: false,
      nbTeams: 3, setupTeams: createDefaultTeams(3),
      enabledEvents: Object.keys(EVENTS),
      boardParams: {
        casesParVoie: 4, nbVoies: 3, nbSections: 3,
        voieFinale: 'court-long', couloirsMix: 2, eventEveryX: 3,
      },
    });
  },
}));
