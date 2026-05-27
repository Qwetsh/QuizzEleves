import { create } from 'zustand';
import { TEAM_COLORS, TEAM_DEFAULTS, TEAM_DEFAULT_EMOJIS, TEAM_BLAZON_GLYPHS } from '../data/teamPresets.js';
import { EVENTS } from '../data/events.js';
import { SUBJECTS, SUBJECT_KEYS } from '../data/subjects.js';
import { POWERS } from '../data/powers.js';
import { generateBoard } from '../logic/boardGenerator.js';
import { moveForward, moveBack, findNextJunction, findPrevJunction, buildPredecessors } from '../logic/pathfinding.js';
import { pickQuestion } from '../logic/questionPicker.js';
import { pickRandomEvent } from '../logic/eventPicker.js';
import { getQuestions } from '../data/questions/index.js';
import { calculateMoneyGain } from '../logic/moneyCalculator.js';
import { saveGame, loadGame, clearSave } from './persistence.js';

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

export const useGameStore = create((set, get) => ({
  // --- Phase ---
  phase: 'setup', // 'setup' | 'powerSelect' | 'game'
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
    casesParVoie: 4,
    nbVoies: 3,
    nbSections: 3,
    voieFinale: 'court-long',
    couloirsMix: 2,
    eventsPerCouloir: 1,
  },
  setBoardParam: (key, value) => {
    set({ boardParams: { ...get().boardParams, [key]: value } });
  },

  enabledEvents: Object.keys(EVENTS),
  toggleEvent: (key) => {
    const { enabledEvents } = get();
    if (enabledEvents.includes(key)) {
      set({ enabledEvents: enabledEvents.filter((k) => k !== key) });
    } else {
      set({ enabledEvents: [...enabledEvents, key] });
    }
  },
  setAllEvents: (enabled) => {
    set({ enabledEvents: enabled ? Object.keys(EVENTS) : [] });
  },

  // --- Game state ---
  teams: [],
  currentTeam: 0,
  board: null,
  viewBox: { w: 2400, h: 620 },
  finished: false,
  askedQuestions: {},
  questions: {},       // loaded questions for current level
  log: [],             // game log entries

  // UI state
  rolling: false,
  diceValue: null,
  pendingMove: null,    // { remaining }
  awaitingChoice: false, // junction choice
  showQuestion: null,    // { question, subject, index } or null
  showEvent: null,       // { key, event } or null
  eventApplied: false,   // guard against double applyEventEffect calls
  showTargetPicker: null, // { powerKey } - for offensive powers needing a target
  indiceUsed: false,      // true if indice was used on current question
  indiceHidden: [],       // indices of answers hidden by indice power

  // --- Power selection ---
  powerSetupIndex: 0,
  powerSetupCategory: 'def',

  // --- Log ---
  addLog: (msg) => {
    set({ log: [...get().log, msg] });
  },

  // --- Start game ---
  startGame: () => {
    const { setupTeams, boardParams, level } = get();
    const { nodes, viewBox } = generateBoard(boardParams);
    const teams = setupTeams.map((t) => {
      const powers = {};
      if (t.powerDef) powers[t.powerDef] = { charges: INITIAL_CHARGES };
      if (t.powerOff) powers[t.powerOff] = { charges: INITIAL_CHARGES };
      return { ...t, pos: 'depart', powers };
    });
    const questions = getQuestions(level);
    set({
      phase: 'powerSelect',
      teams,
      board: nodes,
      viewBox,
      questions,
      currentTeam: 0,
      finished: false,
      askedQuestions: {},
      log: [],
      rolling: false,
      diceValue: null,
      pendingMove: null,
      awaitingChoice: false,
      showQuestion: null,
      showEvent: null,
      eventApplied: false,
      powerSetupIndex: 0,
      powerSetupCategory: 'def',
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
        addLog(`\u{1F3B2} D\u00e9but de la partie ! ${teams.length} \u00e9quipes en lice.`);
        set({ phase: 'game' });
      }
    } else {
      set({ powerSetupIndex: nextIndex });
    }
  },

  // --- Dice ---
  rollDice: () => {
    const { finished, rolling } = get();
    if (finished || rolling) return;
    set({ rolling: true, diceValue: null });

    // Animation: rapid random values then final
    const finalValue = Math.floor(Math.random() * 6) + 1;
    let count = 0;
    const interval = setInterval(() => {
      set({ diceValue: Math.floor(Math.random() * 6) + 1 });
      count++;
      if (count >= 10) {
        clearInterval(interval);
        set({ diceValue: finalValue, rolling: false });
        get().handleDiceResult(finalValue);
      }
    }, 80);
  },

  handleDiceResult: (value) => {
    const { teams, currentTeam, board, addLog } = get();
    const team = teams[currentTeam];
    set({ preRollPos: team.pos }); // save for relance
    addLog(`${team.emoji} ${team.name} lance le d\u00e9 : ${value}`);

    const result = moveForward(board, team.pos, value);
    const newTeams = [...teams];
    newTeams[currentTeam] = { ...team, pos: result.finalPos };
    set({ teams: newTeams });

    if (result.stoppedAtJunction) {
      set({ awaitingChoice: true, pendingMove: { remaining: result.remaining } });
      addLog(`\u2194\uFE0F Choisis une voie !`);
      return;
    }

    get().handleLanding();
  },

  // --- Junction choice ---
  chooseJunction: (nextNodeId) => {
    const { teams, currentTeam, board, pendingMove } = get();
    const team = teams[currentTeam];

    // Move to chosen path
    const newTeams = [...teams];
    newTeams[currentTeam] = { ...team, pos: nextNodeId };
    set({ teams: newTeams, awaitingChoice: false });

    // Continue moving remaining steps
    if (pendingMove && pendingMove.remaining > 1) {
      const result = moveForward(board, nextNodeId, pendingMove.remaining - 1);
      const updatedTeams = [...get().teams];
      updatedTeams[currentTeam] = { ...updatedTeams[currentTeam], pos: result.finalPos };
      set({ teams: updatedTeams, pendingMove: null });

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

    // Arrival
    if (node.type === 'arrivee') {
      addLog(`\u{1F3C6} ${team.emoji} ${team.name} atteint l'arriv\u00e9e !`);
      set({ finished: true });
      saveGame(get());
      return;
    }

    // Event square (events are now placed on subject nodes)
    if (node.type === 'event') {
      const picked = pickRandomEvent(enabledEvents);
      if (picked) {
        addLog(`\u{1F381} ${team.emoji} ${team.name} tombe sur : ${picked.event.icon} ${picked.event.name}`);
        get().triggerEvent(picked);
        return;
      }
      // Fallback: treat as subject question
      const fallbackSubject = node.subject || SUBJECT_KEYS[Math.floor(Math.random() * SUBJECT_KEYS.length)];
      get().askQuestion(fallbackSubject);
      return;
    }

    // Subject square → question
    if (node.type === 'subject') {
      get().askQuestion(node.subject);
      return;
    }

    // Jonction or depart — just next turn
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

    // Check sablier flag
    const timerHalved = team.sablierActif || false;
    if (timerHalved) {
      const nt = [...get().teams];
      nt[currentTeam] = { ...nt[currentTeam], sablierActif: false };
      set({ teams: nt });
      addLog(`\u23F1\uFE0F Sablier actif ! Timer r\u00e9duit \u00e0 15 secondes.`);
    }

    set({
      showQuestion: { question: q, subject, index: result.index, timerHalved },
      askedQuestions: { ...askedQuestions, [subject]: newAsked },
      indiceUsed: false,
      indiceHidden: [],
    });
  },

  answerQuestion: (chosenIndex, timeLeft = 0) => {
    const { showQuestion, teams, currentTeam, board, addLog } = get();
    if (!showQuestion) return;

    const { question, subject, timerHalved } = showQuestion;
    const correct = chosenIndex === question.c;
    const team = teams[currentTeam];
    const newTeams = [...teams];
    const maxTime = timerHalved ? 15 : 30;

    if (correct) {
      const gain = calculateMoneyGain(timeLeft, maxTime);
      newTeams[currentTeam] = { ...team, correct: team.correct + 1, money: team.money + gain };
      addLog(`\u2705 Bonne r\u00e9ponse ! +${gain} \u{1F4B0}`);
    } else {
      // Check bouclier
      const bouclierCharges = team.powers?.bouclier?.charges ?? 0;
      if (bouclierCharges > 0) {
        const newPowers = { ...team.powers, bouclier: { charges: bouclierCharges - 1 } };
        newTeams[currentTeam] = { ...team, wrong: team.wrong + 1, powers: newPowers };
        addLog(`\u274C Mauvaise r\u00e9ponse ! \u{1F6E1}\uFE0F Bouclier activ\u00e9 : pas de recul !`);
      } else {
        const newPos = moveBack(board, team.pos, 2);
        newTeams[currentTeam] = { ...team, wrong: team.wrong + 1, pos: newPos };
        addLog(`\u274C Mauvaise r\u00e9ponse ! Recul de 2 cases.`);
      }
    }

    set({ teams: newTeams, showQuestion: null, indiceUsed: false, indiceHidden: [] });

    // Handle double question: if still active, ask another question instead of next turn
    const updatedTeam = get().teams[currentTeam];
    if (updatedTeam.doubleActive) {
      const nt = [...get().teams];
      nt[currentTeam] = { ...updatedTeam, doubleActive: false };
      set({ teams: nt });
      addLog(`\u2753 Double question ! Deuxi\u00e8me question...`);
      // Ask another question of random subject
      const randomSubject = SUBJECT_KEYS[Math.floor(Math.random() * SUBJECT_KEYS.length)];
      get().askQuestion(randomSubject);
      if (get().phase === 'game') saveGame(get());
      return;
    }

    get().nextTurn();
  },

  timeoutQuestion: () => {
    const { teams, currentTeam, board, addLog } = get();
    const team = teams[currentTeam];
    const newTeams = [...teams];

    const bouclierCharges = team.powers?.bouclier?.charges ?? 0;
    if (bouclierCharges > 0) {
      const newPowers = { ...team.powers, bouclier: { charges: bouclierCharges - 1 } };
      newTeams[currentTeam] = { ...team, wrong: team.wrong + 1, powers: newPowers };
      addLog(`\u23F0 Temps \u00e9coul\u00e9 ! \u{1F6E1}\uFE0F Bouclier activ\u00e9 : pas de recul !`);
    } else {
      const newPos = moveBack(board, team.pos, 2);
      newTeams[currentTeam] = { ...team, wrong: team.wrong + 1, pos: newPos };
      addLog(`\u23F0 Temps \u00e9coul\u00e9 ! ${team.emoji} ${team.name} recule de 2 cases.`);
    }

    set({ teams: newTeams, showQuestion: null, indiceUsed: false, indiceHidden: [] });

    // Handle double question
    const updatedTeam = get().teams[currentTeam];
    if (updatedTeam.doubleActive) {
      const nt = [...get().teams];
      nt[currentTeam] = { ...updatedTeam, doubleActive: false };
      set({ teams: nt });
      addLog(`\u2753 Double question ! Deuxi\u00e8me question...`);
      const randomSubject = SUBJECT_KEYS[Math.floor(Math.random() * SUBJECT_KEYS.length)];
      get().askQuestion(randomSubject);
      if (get().phase === 'game') saveGame(get());
      return;
    }

    get().nextTurn();
  },

  // --- Events ---
  // showEvent: { key, event, phase, data }
  // phase: 'intro' | 'target' | 'dice' | 'question' | 'choice' | 'result'
  // data: { targetIndex, diceResult, questionResult, message }

  // Called when an event is picked — sets up the intro phase
  triggerEvent: (picked) => {
    set({ showEvent: { ...picked, phase: 'intro', data: {} }, eventApplied: false });
  },

  // Player accepts an optional event (or clicks OK on mandatory)
  acceptEvent: () => {
    const { showEvent, teams, currentTeam, board, addLog } = get();
    if (!showEvent) return;
    const { key, event } = showEvent;
    const team = teams[currentTeam];

    // Events that need a target
    const needsTarget = ['foudreFree', 'sacrifice', 'duel', 'don', 'vol', 'echange'];
    if (needsTarget.includes(key)) {
      set({ showEvent: { ...showEvent, phase: 'target' } });
      return;
    }

    // Events that need a dice roll
    if (key === 'rejouer' || key === 'quitteDouble') {
      get().eventRollDice();
      return;
    }

    // Events that need a question
    if (key === 'pari' || key === 'bonus') {
      get().eventAskQuestion();
      return;
    }

    // Recharge: choice
    if (key === 'recharge') {
      set({ showEvent: { ...showEvent, phase: 'choice' } });
      return;
    }

    // Simple auto-apply events
    get().applyEventEffect();
  },

  // Player declines an optional event
  declineEvent: () => {
    const { addLog, teams, currentTeam } = get();
    const team = teams[currentTeam];
    addLog(`${team.emoji} ${team.name} d\u00e9cline l'\u00e9v\u00e9nement.`);
    set({ showEvent: null });
    get().nextTurn();
  },

  // Target selected for event
  eventSelectTarget: (targetIndex) => {
    const { showEvent } = get();
    if (!showEvent) return;
    const { key } = showEvent;

    // Duel needs a question after target selection
    if (key === 'duel') {
      set({ showEvent: { ...showEvent, phase: 'question', data: { ...showEvent.data, targetIndex } } });
      // Ask question for the duel (target answers)
      get().eventAskQuestion();
      return;
    }

    // Others: apply immediately
    set({ showEvent: { ...showEvent, data: { ...showEvent.data, targetIndex } } });
    get().applyEventEffect();
  },

  // Roll dice for event
  eventRollDice: () => {
    const { showEvent } = get();
    if (!showEvent) return;
    set({ showEvent: { ...showEvent, phase: 'dice', data: { ...showEvent.data, diceRolling: true, diceValue: null } } });

    const finalValue = Math.floor(Math.random() * 6) + 1;
    let count = 0;
    const interval = setInterval(() => {
      const current = get().showEvent;
      if (!current) { clearInterval(interval); return; }
      set({ showEvent: { ...current, data: { ...current.data, diceValue: Math.floor(Math.random() * 6) + 1 } } });
      count++;
      if (count >= 10) {
        clearInterval(interval);
        const ev = get().showEvent;
        set({ showEvent: { ...ev, data: { ...ev.data, diceValue: finalValue, diceRolling: false } } });
        // Auto-apply after short delay
        setTimeout(() => get().applyEventEffect(), 1000);
      }
    }, 80);
  },

  // Ask a question for event (pari, bonus, duel)
  eventAskQuestion: () => {
    const { showEvent, questions, askedQuestions, addLog } = get();
    if (!showEvent) return;

    const subject = SUBJECT_KEYS[Math.floor(Math.random() * SUBJECT_KEYS.length)];
    const pool = questions[subject] || [];
    const asked = askedQuestions[subject] || new Set();
    const result = pickQuestion(pool, asked);

    if (!result) {
      addLog(`\u26A0\uFE0F Pas de question disponible.`);
      set({ showEvent: null });
      get().nextTurn();
      return;
    }

    const { question: q, newAsked } = result;

    set({
      showEvent: { ...showEvent, phase: 'question', data: { ...showEvent.data, eventQuestion: q, eventSubject: subject } },
      askedQuestions: { ...askedQuestions, [subject]: newAsked },
    });
  },

  // Answer event question
  eventAnswerQuestion: (chosenIndex) => {
    const { showEvent } = get();
    if (!showEvent?.data?.eventQuestion) return;
    const correct = chosenIndex === showEvent.data.eventQuestion.c;
    set({ showEvent: { ...showEvent, data: { ...showEvent.data, questionResult: correct, questionRevealed: true, questionSelected: chosenIndex } } });
    setTimeout(() => get().applyEventEffect(), 2000);
  },

  // Recharge choice
  eventRechargeChoice: (powerKey) => {
    const { teams, currentTeam, addLog } = get();
    const team = teams[currentTeam];
    const newTeams = [...teams];
    const currentCharges = team.powers?.[powerKey]?.charges ?? 0;
    const newPowers = { ...team.powers, [powerKey]: { charges: currentCharges + 1 } };
    newTeams[currentTeam] = { ...team, powers: newPowers };
    const pName = POWERS[powerKey]?.name || powerKey;
    addLog(`\u{1F50B} ${team.emoji} ${team.name} recharge ${pName} ! (+1 charge)`);
    set({ teams: newTeams, showEvent: null });
    get().nextTurn();
  },

  // Apply the actual event effect
  applyEventEffect: () => {
    if (get().eventApplied) return;
    set({ eventApplied: true });
    const { showEvent, teams, currentTeam, board, addLog } = get();
    if (!showEvent) return;
    const { key, data } = showEvent;
    const team = teams[currentTeam];
    const newTeams = [...teams];
    let message = '';

    switch (key) {
      case 'recul': {
        const newPos = moveBack(board, team.pos, 2);
        newTeams[currentTeam] = { ...team, pos: newPos };
        message = `${team.emoji} ${team.name} recule de 2 cases !`;
        break;
      }

      case 'coupDePouce': {
        const result = moveForward(board, team.pos, 3);
        newTeams[currentTeam] = { ...team, pos: result.finalPos };
        message = `${team.emoji} ${team.name} avance de 3 cases !`;
        break;
      }

      case 'teleport': {
        const junctionId = findNextJunction(board, team.pos);
        if (junctionId) {
          newTeams[currentTeam] = { ...team, pos: junctionId };
          message = `${team.emoji} ${team.name} se t\u00e9l\u00e9porte \u00e0 la prochaine jonction !`;
        } else {
          message = `Pas de jonction devant \u2014 rien ne se passe.`;
        }
        break;
      }

      case 'oubli': {
        newTeams[currentTeam] = { ...team, pos: 'depart' };
        message = `\u{1F573}\uFE0F ${team.emoji} ${team.name} retourne au D\u00c9PART !`;
        break;
      }

      case 'embuscade': {
        const prevJ = findPrevJunction(board, team.pos);
        if (prevJ) {
          newTeams[currentTeam] = { ...team, pos: prevJ };
          message = `${team.emoji} ${team.name} recule \u00e0 la derni\u00e8re jonction !`;
        } else {
          message = `Pas de jonction derri\u00e8re \u2014 rien ne se passe.`;
        }
        break;
      }

      case 'tempete': {
        for (let i = 0; i < teams.length; i++) {
          if (i === currentTeam) continue;
          const t = newTeams[i];
          const newPos = moveBack(board, t.pos, 1);
          newTeams[i] = { ...t, pos: newPos };
        }
        message = `\u{1F32A}\uFE0F Temp\u00eate ! Toutes les autres \u00e9quipes reculent de 1 case.`;
        break;
      }

      case 'rejouer': {
        const dv = data?.diceValue || 1;
        const result = moveForward(board, team.pos, dv);
        newTeams[currentTeam] = { ...team, pos: result.finalPos };
        message = `${team.emoji} ${team.name} rejoue et avance de ${dv} !`;
        break;
      }

      case 'quitteDouble': {
        const dv = data?.diceValue || 1;
        if (dv >= 4) {
          const result = moveForward(board, team.pos, dv * 2);
          newTeams[currentTeam] = { ...team, pos: result.finalPos };
          message = `\u{1F3B0} ${dv} ! Avance de ${dv * 2} cases (double) !`;
        } else {
          const newPos = moveBack(board, team.pos, dv);
          newTeams[currentTeam] = { ...team, pos: newPos };
          message = `\u{1F3B0} ${dv}... Recule de ${dv} cases !`;
        }
        break;
      }

      case 'foudreFree': {
        const ti = data?.targetIndex;
        if (ti != null) {
          const target = newTeams[ti];
          const newPos = moveBack(board, target.pos, 3);
          newTeams[ti] = { ...target, pos: newPos };
          message = `\u26A1 ${target.emoji} ${target.name} recule de 3 cases !`;
        }
        break;
      }

      case 'sacrifice': {
        const ti = data?.targetIndex;
        if (ti != null) {
          const target = newTeams[ti];
          const myNewPos = moveBack(board, team.pos, 2);
          const targetNewPos = moveBack(board, target.pos, 4);
          newTeams[currentTeam] = { ...team, pos: myNewPos };
          newTeams[ti] = { ...target, pos: targetNewPos };
          message = `\u{1F91D} ${team.emoji} recule de 2, ${target.emoji} recule de 4 !`;
        }
        break;
      }

      case 'don': {
        const ti = data?.targetIndex;
        if (ti != null) {
          const target = newTeams[ti];
          const result = moveForward(board, target.pos, 3);
          newTeams[ti] = { ...target, pos: result.finalPos };
          message = `\u{1F381} ${target.emoji} ${target.name} avance de 3 cases !`;
        }
        break;
      }

      case 'echange': {
        const ti = data?.targetIndex;
        if (ti != null) {
          const target = newTeams[ti];
          newTeams[currentTeam] = { ...team, pos: target.pos };
          newTeams[ti] = { ...target, pos: team.pos };
          message = `\u{1F500} ${team.emoji} et ${target.emoji} \u00e9changent leurs positions !`;
        }
        break;
      }

      case 'vol': {
        const ti = data?.targetIndex;
        if (ti != null) {
          const target = newTeams[ti];
          // Try to steal a charge (bouclier or indice)
          let stolen = null;
          for (const pk of ['bouclier', 'indice']) {
            if (target.powers?.[pk]?.charges > 0) {
              stolen = pk;
              break;
            }
          }
          if (stolen) {
            const stolenCharges = target.powers?.[stolen]?.charges ?? 0;
            const targetPowers = { ...target.powers, [stolen]: { charges: stolenCharges - 1 } };
            const myCharges = team.powers?.[stolen]?.charges ?? 0;
            const myPowers = { ...team.powers, [stolen]: { charges: myCharges + 1 } };
            newTeams[ti] = { ...target, powers: targetPowers };
            newTeams[currentTeam] = { ...team, powers: myPowers };
            message = `\u{1FA99} ${team.emoji} vole 1 charge de ${POWERS[stolen].name} \u00e0 ${target.emoji} !`;
          } else {
            message = `\u{1FA99} ${target.emoji} n'a rien \u00e0 voler !`;
          }
        }
        break;
      }

      case 'duel': {
        const ti = data?.targetIndex;
        const correct = data?.questionResult;
        if (ti != null) {
          const target = newTeams[ti];
          if (correct) {
            // Target succeeded → current team moves back 2
            const myNewPos = moveBack(board, team.pos, 2);
            newTeams[currentTeam] = { ...team, pos: myNewPos };
            message = `\u2694\uFE0F ${target.emoji} r\u00e9ussit le duel ! ${team.emoji} recule de 2.`;
          } else {
            // Target failed → target moves back 2
            const targetNewPos = moveBack(board, target.pos, 2);
            newTeams[ti] = { ...target, pos: targetNewPos };
            message = `\u2694\uFE0F ${target.emoji} \u00e9choue ! ${target.emoji} recule de 2.`;
          }
        }
        break;
      }

      case 'pari': {
        const correct = data?.questionResult;
        if (correct) {
          const result = moveForward(board, team.pos, 3);
          newTeams[currentTeam] = { ...team, pos: result.finalPos };
          message = `\u{1F4B0} Pari gagn\u00e9 ! ${team.emoji} avance de 3 cases !`;
        } else {
          const newPos = moveBack(board, team.pos, 3);
          newTeams[currentTeam] = { ...team, pos: newPos };
          message = `\u{1F4B0} Pari perdu ! ${team.emoji} recule de 3 cases.`;
        }
        break;
      }

      case 'bonus': {
        const correct = data?.questionResult;
        if (correct) {
          const result = moveForward(board, team.pos, 3);
          newTeams[currentTeam] = { ...team, pos: result.finalPos };
          message = `\u{1F3AF} Question bonus r\u00e9ussie ! ${team.emoji} avance de 3 !`;
        } else {
          message = `\u{1F3AF} Rat\u00e9... Pas de p\u00e9nalit\u00e9.`;
        }
        break;
      }

      default:
        message = `\u00c9v\u00e9nement appliqu\u00e9.`;
    }

    addLog(message);
    set({ teams: newTeams, showEvent: { ...showEvent, phase: 'result', data: { ...data, message } } });
  },

  closeEvent: () => {
    set({ showEvent: null, eventApplied: false });
    get().nextTurn();
    if (get().phase === 'game') saveGame(get());
  },

  // --- Powers ---
  usePower: (powerKey) => {
    const { teams, currentTeam, rolling, finished, showQuestion, showEvent, awaitingChoice, diceValue } = get();
    if (finished || rolling || showEvent || awaitingChoice) return;
    const team = teams[currentTeam];
    const charges = team.powers?.[powerKey]?.charges ?? 0;
    if (charges <= 0) return;

    const power = POWERS[powerKey];
    if (!power) return;

    // Indice: only during question
    if (powerKey === 'indice') {
      if (!showQuestion || get().indiceUsed) return;
      get().useIndice();
      return;
    }

    // Relance: only after dice result, before landing processed
    if (powerKey === 'relance') {
      if (!diceValue || showQuestion) return;
      get().useRelance();
      return;
    }

    // Offensive powers: need target picker
    if (power.category === 'off') {
      if (diceValue || showQuestion) return; // only before rolling
      set({ showTargetPicker: { powerKey } });
      return;
    }
  },

  useIndice: () => {
    const { teams, currentTeam, showQuestion, addLog } = get();
    const team = teams[currentTeam];
    const question = showQuestion?.question;
    if (!question) return;

    // Find 2 wrong answers to hide
    const wrongIndices = question.a
      .map((_, i) => i)
      .filter((i) => i !== question.c);
    // Shuffle and pick 2
    for (let i = wrongIndices.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [wrongIndices[i], wrongIndices[j]] = [wrongIndices[j], wrongIndices[i]];
    }
    const hidden = wrongIndices.slice(0, 2);

    // Consume charge
    const newTeams = [...teams];
    const currentChargesIndice = team.powers?.indice?.charges ?? 0;
    const newPowers = { ...team.powers, indice: { charges: currentChargesIndice - 1 } };
    newTeams[currentTeam] = { ...team, powers: newPowers };

    addLog(`\u{1F4A1} ${team.emoji} ${team.name} utilise Indice ! 2 r\u00e9ponses \u00e9limin\u00e9es.`);
    set({ teams: newTeams, indiceUsed: true, indiceHidden: hidden });
  },

  useRelance: () => {
    const { teams, currentTeam, board, addLog, preRollPos } = get();
    const team = teams[currentTeam];

    // Consume charge
    const newTeams = [...teams];
    const currentChargesRelance = team.powers?.relance?.charges ?? 0;
    const newPowers = { ...team.powers, relance: { charges: currentChargesRelance - 1 } };
    // Restore position to before the roll
    newTeams[currentTeam] = { ...team, powers: newPowers, pos: preRollPos || team.pos };

    addLog(`\u{1F3B2} ${team.emoji} ${team.name} utilise Relance !`);
    set({ teams: newTeams, diceValue: null, rolling: true });

    const finalValue = Math.floor(Math.random() * 6) + 1;
    let count = 0;
    const interval = setInterval(() => {
      set({ diceValue: Math.floor(Math.random() * 6) + 1 });
      count++;
      if (count >= 10) {
        clearInterval(interval);
        set({ diceValue: finalValue, rolling: false });
        // If re-rolled 1, advance 1 without power
        addLog(`\u{1F3B2} Relance : ${finalValue} !`);
        get().handleDiceResult(finalValue);
      }
    }, 80);
  },

  // Offensive power: target selected
  applyOffensivePower: (targetTeamIndex) => {
    const { teams, currentTeam, board, showTargetPicker, addLog } = get();
    if (!showTargetPicker) return;
    const { powerKey } = showTargetPicker;
    const team = teams[currentTeam];
    const target = teams[targetTeamIndex];
    const newTeams = [...teams];

    // Consume charge
    const currentChargesPower = team.powers?.[powerKey]?.charges ?? 0;
    const newPowers = { ...team.powers, [powerKey]: { charges: currentChargesPower - 1 } };
    newTeams[currentTeam] = { ...team, powers: newPowers };

    if (powerKey === 'foudre') {
      const newPos = moveBack(board, target.pos, 3);
      newTeams[targetTeamIndex] = { ...target, pos: newPos };
      addLog(`\u26A1 ${team.emoji} ${team.name} utilise Foudre sur ${target.emoji} ${target.name} ! Recul de 3 cases.`);
    } else if (powerKey === 'sablier') {
      newTeams[targetTeamIndex] = { ...target, sablierActif: true };
      addLog(`\u23F1\uFE0F ${team.emoji} ${team.name} utilise Sablier sur ${target.emoji} ${target.name} ! Timer /2 au prochain tour.`);
    } else if (powerKey === 'double') {
      newTeams[targetTeamIndex] = { ...target, doubleActive: true };
      addLog(`\u2753 ${team.emoji} ${team.name} utilise Double sur ${target.emoji} ${target.name} ! Double question au prochain tour.`);
    }

    set({ teams: newTeams, showTargetPicker: null });
  },

  cancelTargetPicker: () => set({ showTargetPicker: null }),

  // --- Shop ---
  showShop: false,
  openShop: () => {
    const { finished, rolling, showQuestion, showEvent, awaitingChoice } = get();
    if (finished || rolling || showQuestion || showEvent || awaitingChoice) return;
    set({ showShop: true });
  },
  closeShop: () => set({ showShop: false }),

  buyPowerCharge: (powerKey) => {
    const { teams, currentTeam, addLog } = get();
    const team = teams[currentTeam];
    const price = POWERS[powerKey]?.price || 15;
    if (team.money < price) return;

    const newTeams = [...teams];
    const currentCharges = team.powers?.[powerKey]?.charges ?? 0;
    const newPowers = { ...team.powers, [powerKey]: { charges: currentCharges + 1 } };
    newTeams[currentTeam] = { ...team, money: team.money - price, powers: newPowers };

    const pName = POWERS[powerKey]?.name || powerKey;
    addLog(`\u{1F6D2} ${team.emoji} ${team.name} ach\u00e8te 1 charge de ${pName} (${price} \u{1F4B0})`);
    set({ teams: newTeams });
  },

  // --- Turn management ---
  nextTurn: () => {
    const { teams, currentTeam, finished } = get();
    if (finished) return;
    set({
      currentTeam: (currentTeam + 1) % teams.length,
      diceValue: null,
      pendingMove: null,
      awaitingChoice: false,
      preRollPos: null,
      showTargetPicker: null,
      showShop: false,
      indiceUsed: false,
      indiceHidden: [],
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
      diceValue: null,
      pendingMove: null,
      awaitingChoice: false,
      showQuestion: null,
      showEvent: null,
      eventApplied: false,
      showTargetPicker: null,
      showShop: false,
      indiceUsed: false,
      indiceHidden: [],
      preRollPos: null,
    });
  },

  // --- Reset ---
  reset: () => {
    clearSave();
    set({
    phase: 'setup',
    teams: [],
    currentTeam: 0,
    board: null,
    finished: false,
    askedQuestions: {},
    questions: {},
    log: [],
    rolling: false,
    diceValue: null,
    pendingMove: null,
    awaitingChoice: false,
    showQuestion: null,
    showEvent: null,
    eventApplied: false,
    showTargetPicker: null,
    showShop: false,
    indiceUsed: false,
    indiceHidden: [],
    preRollPos: null,
    nbTeams: 3,
    setupTeams: createDefaultTeams(3),
    enabledEvents: Object.keys(EVENTS),
    boardParams: {
      casesParVoie: 4,
      nbVoies: 3,
      nbSections: 3,
      voieFinale: 'court-long',
      couloirsMix: 2,
      eventsPerCouloir: 1,
    },
  });
  },
}));
