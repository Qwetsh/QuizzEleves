// Duel de SORCIERS (« Priori Incantatem ») multi-surface, PILOTÉ PAR LE STORE.
// Comme les échecs / le hacking, il tourne AUSSI en ligne : les DEUX camps
// répondent à la MÊME question (course au rai partagé) via l'intent
// turnWizardAnswer (wizardAnswer). L'hôte est l'autorité : moteur pur
// logic/wizardDuel, minuteries de verrou / coup au but, victoire UNIQUE
// (fightMatchWin). Le SECRET (bonne réponse q.c) reste sur l'hôte → jamais publié.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { useGameStore } from '../store/gameStore.js';
import { buildTurnPayload } from '../logic/sessionConfig.js';
import { serializeSnapshot } from '../logic/onlineSnapshot.js';
import { WIZARD_WRONG_HOLD_MS, WIZARD_HIT_MS } from '../store/wizardFightHandlers.js';
import { WIZARD_PUSH } from '../logic/wizardDuel.js';

const S = () => useGameStore.getState();

// Pool de questions injecté pour `harrypotter` (le vrai pool vit dans Supabase,
// non bundlé) : 10 questions à 4 réponses, bonne réponse index 0 avant mélange.
function fakePool() {
  return Array.from({ length: 10 }, (_, i) => ({
    q: `Question ${i} ?`,
    a: [`bonne-${i}`, `faux-${i}-1`, `faux-${i}-2`, `faux-${i}-3`],
    c: 0,
    e: `explication ${i}`,
  }));
}

// Le thème `harrypotter` résout le moteur `wizard` (cf. THEME_MINIGAMES). On
// injecte le pool APRÈS devStartFight (qui réécrit `questions`) et AVANT fightBegin.
function startWizardDuel(surface = 'phone') {
  useGameStore.setState({
    phase: 'setup', devSandbox: false, _devRestore: null,
    connectionMode: 'board', phoneController: false, sessionCode: null,
    showFight: null, finished: false, log: [], askedQuestions: {},
  });
  S().devStartFight('harrypotter', false, surface);
  useGameStore.setState({ questions: { harrypotter: fakePool() }, askedQuestions: {} });
  S().fightBegin();
}

// Répond CORRECTEMENT pour un camp (lit q.c dans le store — présent côté hôte,
// strippé seulement à la publication).
function answerCorrect(side) {
  const w = S().showFight.wizard;
  S().wizardAnswer(side, w.q.c);
}
// Répond FAUX pour un camp (un index ≠ q.c parmi 0..3).
function answerWrong(side) {
  const w = S().showFight.wizard;
  S().wizardAnswer(side, (w.q.c + 1) % 4);
}

describe('duel de sorciers multi-surface (showFight.wizard)', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('surface téléphone : fightBegin distribue un duel piloté par le store, rai au centre', () => {
    startWizardDuel('phone');
    const f = S().showFight;
    expect(f.phase).toBe('minigame');
    expect(f.wizard).toBeTruthy();
    expect(f.wizard.pos).toBe(50);
    expect(f.wizard.q).toBeTruthy();
    expect(Array.isArray(f.wizard.q.a)).toBe(true);
    expect(f.wizard.winner).toBeNull();
    expect(f.wizard.locked).toEqual({ attacker: false, defender: false });
    expect(f.race).toBeFalsy(); // PAS le duel éclair de repli
  });

  it('surface en ligne : le duel de sorciers démarre AUSSI (pas de repli éclair)', () => {
    startWizardDuel('online');
    const f = S().showFight;
    expect(f.phase).toBe('minigame');
    expect(f.wizard).toBeTruthy();
    expect(f.race).toBeFalsy();
  });

  it('réponse correcte de l\'attaquant : le rai monte vers 100, push posé, nouvelle question', () => {
    startWizardDuel('phone');
    const q0 = S().showFight.wizard.q;
    answerCorrect('attacker');
    const w = S().showFight.wizard;
    expect(w.pos).toBe(50 + WIZARD_PUSH);     // poussée vers le défenseur (100)
    expect(w.push).toBeTruthy();
    expect(w.push.side).toBe('attacker');
    expect(w.winner).toBeNull();
    expect(w.q).not.toBe(q0);                 // nouvelle question servie
    expect(w.locked).toEqual({ attacker: false, defender: false });
  });

  it('réponse fausse : le camp est verrouillé puis relevé après la minuterie', () => {
    startWizardDuel('phone');
    const pos0 = S().showFight.wizard.pos;
    answerWrong('attacker');
    expect(S().showFight.wizard.locked.attacker).toBe(true);
    expect(S().showFight.wizard.pos).toBe(pos0); // rai inchangé sur une faute
    // Un camp verrouillé ne peut plus répondre tant que le verrou tient.
    answerCorrect('attacker');
    expect(S().showFight.wizard.pos).toBe(pos0);
    vi.advanceTimersByTime(WIZARD_WRONG_HOLD_MS);
    expect(S().showFight.wizard.locked.attacker).toBe(false); // verrou relevé
  });

  it('pousser jusqu\'à la victoire : winner + coup au but, puis fightMatchWin (reward)', () => {
    startWizardDuel('phone');
    // 3 bonnes réponses de l'attaquant : 50→68→86→100 (clamp) → victoire.
    answerCorrect('attacker'); // 68
    answerCorrect('attacker'); // 86
    answerCorrect('attacker'); // 100 → winner
    const w = S().showFight.wizard;
    expect(w.pos).toBe(100);
    expect(w.winner).toBe('attacker');
    expect(w.hit).toBeTruthy();
    expect(w.hit.side).toBe('defender'); // le perdant est frappé
    // La victoire de combat n'est marquée qu'après le coup au but.
    expect(S().showFight.winnerSide).toBeFalsy();
    vi.advanceTimersByTime(WIZARD_HIT_MS);
    expect(S().showFight.winnerSide).toBe('attacker');
    expect(S().showFight.phase).toBe('reward'); // duel unique → récompense
  });

  it('le défenseur peut aussi pousser (course) : bonne réponse → rai vers 0', () => {
    startWizardDuel('phone');
    answerCorrect('defender');
    expect(S().showFight.wizard.pos).toBe(50 - WIZARD_PUSH);
    expect(S().showFight.wizard.push.side).toBe('defender');
  });

  it('anti-triche : le payload publie la question du rai SANS la bonne réponse', () => {
    startWizardDuel('phone');
    const wizard = buildTurnPayload(S()).fight.wizard;
    expect(wizard).toBeTruthy();
    expect(wizard.q).toBeTruthy();
    expect(Array.isArray(wizard.q.a)).toBe(true); // les réponses visibles : OK
    expect(wizard.q.c).toBeUndefined();           // la bonne réponse : JAMAIS
    expect(wizard.q.e).toBeUndefined();           // l'explication non plus
    expect(JSON.stringify(wizard)).not.toContain('"c":');
  });

  it('anti-triche : le snapshot en ligne strippe aussi wizard.q.c', () => {
    startWizardDuel('online');
    const snap = serializeSnapshot(S());
    const wq = snap.showFight.wizard.q;
    expect(wq).toBeTruthy();
    expect(Array.isArray(wq.a)).toBe(true);
    expect(wq.c).toBeUndefined();
    expect(wq.e).toBeUndefined();
  });

  it('un intent turnWizardAnswer est mappé au bon camp par jeton', () => {
    startWizardDuel('phone');
    const f = S().showFight;
    const correct = f.wizard.q.c;
    // Le DÉFENSEUR (idx = defenderIndex) envoie l'index correct : mappé sur SON
    // camp → pousse le rai vers 0 (côté défenseur), pas vers l'attaquant.
    S().applyFightIntent(f.defenderIndex, 'turnWizardAnswer', { index: correct });
    expect(S().showFight.wizard.pos).toBe(50 - WIZARD_PUSH);
    expect(S().showFight.wizard.push.side).toBe('defender');
  });

  it('repli propre : sans pool de questions, bascule en duel éclair (pas de soft-lock)', () => {
    useGameStore.setState({
      phase: 'setup', devSandbox: false, _devRestore: null,
      connectionMode: 'board', phoneController: false, sessionCode: null,
      showFight: null, finished: false, log: [], askedQuestions: {},
    });
    S().devStartFight('harrypotter', false, 'phone');
    // Pas de pool harrypotter injecté (et non bundlé) → fightPickQuestion = null.
    useGameStore.setState({ questions: {}, askedQuestions: {} });
    S().fightBegin();
    const f = S().showFight;
    // Ni blocage ni wizard sans question : repli course (race) OU manche marquée.
    expect(f.wizard).toBeFalsy();
    // Le combat n'est jamais coincé en minigame sans mécanique (race servie, ou
    // déjà résolu vers reward si le repli course n'a pas de pool non plus).
    expect(['minigame', 'reward', 'result']).toContain(f.phase);
  });
});
