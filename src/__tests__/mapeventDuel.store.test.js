// Duel « LIEU → ÉVÉNEMENT » (Chroniques de la Terre du Milieu) multi-surface,
// PILOTÉ PAR LE STORE. Comme les échecs / le hacking / les sorciers, il tourne
// AUSSI en ligne : les DEUX camps voient la MÊME cible marquée sur la carte et
// courent au bon événement via l'intent turnMapeventAnswer (mapeventAnswer).
// L'hôte est l'autorité : tirage pur logic/mapeventDuel, minuteries de verrou /
// révélation, best-of-3 NORMAL (fightRoundWin). Le SECRET (correctId de la
// manche) vit MODULE-LEVEL → jamais publié avant la révélation.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { useGameStore } from '../store/gameStore.js';
import { buildTurnPayload } from '../logic/sessionConfig.js';
import { serializeSnapshot } from '../logic/onlineSnapshot.js';
import { MAPEVENT_WRONG_HOLD_MS, MAPEVENT_REVEAL_MS } from '../store/mapeventFightHandlers.js';
import { drawMapeventRound } from '../logic/mapeventDuel.js';
import { LOTR_EVENTS } from '../data/lotrEvents.js';

const S = () => useGameStore.getState();

// Le thème `seigneur_des_anneaux` résout le moteur `mapevent` (cf. THEME_MINIGAMES).
// Auto-suffisant (LOTR_EVENTS bundlé) : pas de pool de questions à injecter.
function startMapeventDuel(surface = 'phone') {
  useGameStore.setState({
    phase: 'setup', devSandbox: false, _devRestore: null,
    connectionMode: 'board', phoneController: false, sessionCode: null,
    showFight: null, finished: false, log: [], askedQuestions: {},
  });
  S().devStartFight('seigneur_des_anneaux', false, surface);
  S().fightBegin();
}

// Le store NE publie PAS le bon choix avant révélation. On le dérive en jouant
// chaque choix : le SEUL qui déclenche `reveal` est le bon (les autres verrouillent
// puis se relèvent). On rejoue proprement à chaque essai via les timers factices.
function correctChoiceId(side = 'attacker') {
  const mv = S().showFight.mapevent;
  for (const c of mv.choices) {
    S().mapeventAnswer(side, c.id);
    const after = S().showFight.mapevent;
    if (after.reveal) return c.id;         // trouvé : la manche est révélée
    // Faux : le camp est verrouillé — on relève le verrou et on réessaie.
    vi.advanceTimersByTime(MAPEVENT_WRONG_HOLD_MS);
  }
  return null;
}

describe('duel « lieu → événement » multi-surface (showFight.mapevent)', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('surface téléphone : fightBegin distribue un duel piloté par le store', () => {
    startMapeventDuel('phone');
    const f = S().showFight;
    expect(f.phase).toBe('minigame');
    expect(f.mapevent).toBeTruthy();
    expect(f.mapevent.roundNo).toBe(1);
    expect(f.mapevent.universe).toBe('terre_du_milieu_atlas');
    expect(f.mapevent.target).toBeTruthy();
    expect(typeof f.mapevent.target.place).toBe('string');
    expect(f.mapevent.choices).toHaveLength(4);
    expect(f.mapevent.reveal).toBeNull();
    expect(f.mapevent.locked).toEqual({ attacker: false, defender: false });
    expect(f.race).toBeFalsy(); // PAS le duel éclair de repli
  });

  it('surface en ligne : le duel démarre AUSSI (pas de repli éclair)', () => {
    startMapeventDuel('online');
    const f = S().showFight;
    expect(f.phase).toBe('minigame');
    expect(f.mapevent).toBeTruthy();
    expect(f.mapevent.choices).toHaveLength(4);
    expect(f.race).toBeFalsy();
  });

  it('mauvais choix : le camp est verrouillé (manche figée) puis relevé après la minuterie', () => {
    startMapeventDuel('phone');
    // Provoque un VERROU : on tente un choix ; s'il tombe pile sur le bon
    // (reveal), on enchaîne la manche suivante et on retente (borné) — jusqu'à
    // toucher un choix faux qui verrouille. Une manche a 3 choix faux sur 4.
    let locked = false;
    for (let attempt = 0; attempt < 8 && !locked; attempt++) {
      const mv = S().showFight.mapevent;
      S().mapeventAnswer('attacker', mv.choices[0].id); // toujours le 1er choix
      const st = S().showFight.mapevent;
      if (st.reveal) { vi.advanceTimersByTime(MAPEVENT_REVEAL_MS); continue; }
      locked = st.locked.attacker;
    }
    expect(locked).toBe(true);
    // Un camp verrouillé ne peut plus répondre tant que le verrou tient.
    const lockedRound = S().showFight.mapevent.roundNo;
    S().mapeventAnswer('attacker', S().showFight.mapevent.choices[1].id);
    expect(S().showFight.mapevent.roundNo).toBe(lockedRound); // rien n'a bougé
    expect(S().showFight.mapevent.reveal).toBeNull();
    vi.advanceTimersByTime(MAPEVENT_WRONG_HOLD_MS);
    expect(S().showFight.mapevent.locked.attacker).toBe(false); // verrou relevé
  });

  it('bon choix : reveal.correctId + fightRoundWin (wins++) + manche suivante', () => {
    startMapeventDuel('phone');
    const target0 = S().showFight.mapevent.target;
    const good = correctChoiceId('attacker');
    expect(good).toBeTruthy();
    const mvRevealed = S().showFight.mapevent;
    expect(mvRevealed.reveal).toBeTruthy();
    expect(mvRevealed.reveal.winner).toBe('attacker');
    expect(mvRevealed.reveal.correctId).toBe(good); // le secret sort À la révélation
    // Avant l'échéance : la manche n'est pas encore marquée.
    expect(S().showFight.wins.attacker).toBe(0);
    vi.advanceTimersByTime(MAPEVENT_REVEAL_MS);
    // La manche est marquée (BO3) et une nouvelle cible est distribuée.
    expect(S().showFight.wins.attacker).toBe(1);
    const nf = S().showFight;
    expect(nf.phase).toBe('minigame');
    expect(nf.mapevent.roundNo).toBe(2);
    expect(nf.mapevent.reveal).toBeNull();
    // Nouvelle cible (anti-répétition : différente de la précédente).
    expect(nf.mapevent.target.place).not.toBe(target0.place);
  });

  it('best-of-3 : deux manches gagnées → phase reward', () => {
    startMapeventDuel('phone');
    correctChoiceId('attacker');
    vi.advanceTimersByTime(MAPEVENT_REVEAL_MS); // manche 1 → wins.attacker = 1
    expect(S().showFight.wins.attacker).toBe(1);
    correctChoiceId('attacker');
    vi.advanceTimersByTime(MAPEVENT_REVEAL_MS); // manche 2 → victoire de combat
    expect(S().showFight.wins.attacker).toBe(2);
    expect(S().showFight.winnerSide).toBe('attacker');
    expect(S().showFight.phase).toBe('reward');
  });

  it('le défenseur peut aussi répondre (course)', () => {
    startMapeventDuel('phone');
    const good = correctChoiceId('defender');
    expect(good).toBeTruthy();
    expect(S().showFight.mapevent.reveal.winner).toBe('defender');
  });

  it('anti-triche : le payload publie choices SANS marquer le bon, et correctId reste caché', () => {
    startMapeventDuel('phone');
    const mapevent = buildTurnPayload(S()).fight.mapevent;
    expect(mapevent).toBeTruthy();
    expect(mapevent.target).toBeTruthy();
    expect(mapevent.choices).toHaveLength(4);
    // Aucun choix ne porte de flag « correct/bon », aucun correctId publié.
    for (const c of mapevent.choices) {
      expect(c).toHaveProperty('id');
      expect(c).toHaveProperty('event');
      expect(c.correct).toBeUndefined();
      expect(c.good).toBeUndefined();
    }
    expect(mapevent.reveal).toBeNull();
    expect(JSON.stringify(mapevent)).not.toContain('correctId');
  });

  it('anti-triche : le snapshot en ligne ne contient aucun correctId avant révélation', () => {
    startMapeventDuel('online');
    const snap = serializeSnapshot(S());
    const mv = snap.showFight.mapevent;
    expect(mv).toBeTruthy();
    expect(mv.choices).toHaveLength(4);
    expect(mv.reveal).toBeNull();
    expect(JSON.stringify(mv)).not.toContain('correctId');
  });

  it('un intent turnMapeventAnswer est mappé au bon camp par jeton', () => {
    startMapeventDuel('phone');
    const f = S().showFight;
    // On dérive le bon choix côté attaquant sans révéler (via le tirage pur —
    // le store ne l'expose pas). Ici on vérifie surtout le MAPPING du camp :
    // un choix FAUX envoyé par le défenseur doit verrouiller le DÉFENSEUR.
    const anyChoice = f.mapevent.choices[0];
    S().applyFightIntent(f.defenderIndex, 'turnMapeventAnswer', { choiceId: anyChoice.id });
    const mv = S().showFight.mapevent;
    if (mv.reveal) {
      expect(mv.reveal.winner).toBe('defender'); // c'était le bon → défenseur gagne
    } else {
      expect(mv.locked.defender).toBe(true);     // c'était faux → défenseur verrouillé
      expect(mv.locked.attacker).toBe(false);
    }
  });
});

// --- Tirage PUR (logic/mapeventDuel) : déterministe, réutilisable ---
describe('drawMapeventRound (tirage pur)', () => {
  // rng déterministe : renvoie toujours 0 → choix reproductible.
  const rngZero = () => 0;

  it('produit une cible + 4 choix + correctId cohérent', () => {
    const round = drawMapeventRound(LOTR_EVENTS, { served: new Set(), rng: rngZero });
    expect(round).toBeTruthy();
    expect(round.target).toBeTruthy();
    expect(round.choices).toHaveLength(4);
    // Le choix correctId porte bien l'événement de la cible.
    const correct = round.choices.find((c) => c.id === round.correctId);
    const targetEntry = LOTR_EVENTS.find((e) => e.place === round.target.place);
    expect(correct.event).toBe(targetEntry.event);
    // Ids opaques distincts c0..c3.
    expect(new Set(round.choices.map((c) => c.id)).size).toBe(4);
  });

  it('la cible n\'est jamais un distracteur d\'elle-même (4 events distincts)', () => {
    const round = drawMapeventRound(LOTR_EVENTS, { served: new Set(), rng: Math.random });
    const events = round.choices.map((c) => c.event);
    expect(new Set(events).size).toBe(4); // pas de doublon d'événement
  });

  it('anti-répétition : `served` reçoit la cible ; reset quand le pool frais est épuisé', () => {
    const served = new Set();
    const seen = [];
    // Tire autant de manches qu'il y a de lieux : chaque cible est fraîche.
    for (let i = 0; i < LOTR_EVENTS.length; i++) {
      const r = drawMapeventRound(LOTR_EVENTS, { served, rng: Math.random });
      expect(r).toBeTruthy();
      seen.push(r.target.place);
    }
    // Toutes les cibles servies sont distinctes (aucune répétition avant reset).
    expect(new Set(seen).size).toBe(LOTR_EVENTS.length);
    // Le tirage suivant réinitialise `served` (pool frais épuisé) et repart.
    const next = drawMapeventRound(LOTR_EVENTS, { served, rng: Math.random });
    expect(next).toBeTruthy();
  });

  it('retourne null si moins de 4 lieux', () => {
    expect(drawMapeventRound(LOTR_EVENTS.slice(0, 3), {})).toBeNull();
    expect(drawMapeventRound([], {})).toBeNull();
  });
});
