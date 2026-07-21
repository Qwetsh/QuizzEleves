// Duel de SORTS (rythme, façon Guitar Hero) multi-surface, PILOTÉ PAR LE STORE.
// Comme les échecs / le hacking, il tourne AUSSI en ligne : les DEUX camps jouent
// la MÊME partition (vagues de 4 sorts + événements qui tombent) et tapent le bon
// sort au bon moment via l'intent turnWizardHit (wizardHit). L'hôte est l'autorité :
// moteur pur logic/spellHero, timer de fin de chanson, victoire UNIQUE (fightMatchWin).
// Le SECRET (clé de réponse : index correct par note) vit module-level sur l'hôte —
// jamais publié (la partition publique ne porte que les labels + les 4 sorts).
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { useGameStore } from '../store/gameStore.js';
import { buildTurnPayload } from '../logic/sessionConfig.js';
import { serializeSnapshot } from '../logic/onlineSnapshot.js';
import {
  WIZARD_HIT_MS, SONG_LEAD_MS, SONG_FINALIZE_BUFFER_MS, _peekAnswerKey,
} from '../store/wizardFightHandlers.js';
import { HERO } from '../logic/spellHero.js';

const S = () => useGameStore.getState();

// Le thème `harrypotter` résout le moteur `wizard` (cf. THEME_MINIGAMES) et porte
// un pack de sorts BUNDLÉ (spellPacks.js) → aucune injection de contenu requise.
function beginDuel(surface = 'phone') {
  useGameStore.setState({
    phase: 'setup', devSandbox: false, _devRestore: null,
    connectionMode: 'board', phoneController: false, sessionCode: null,
    showFight: null, finished: false, log: [], askedQuestions: {},
  });
  S().devStartFight('harrypotter', false, surface);
  S().fightBegin();
}

// Tape le BON sort (lit la clé côté hôte) pour la note `note`, timing parfait (dt=0).
function hitPerfect(side, note) {
  const key = _peekAnswerKey();
  S().wizardHit(side, note.id, key[note.id], 0);
}
// Tape un MAUVAIS sort pour la note `note` (un index ≠ clé, timing parfait).
function hitWrong(side, note) {
  const key = _peekAnswerKey();
  S().wizardHit(side, note.id, (key[note.id] + 1) % HERO.HAND, 0);
}

describe('duel de sorts (rythme) multi-surface (showFight.wizard)', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('surface téléphone : fightBegin distribue la partition, rai au centre, scores à 0', () => {
    beginDuel('phone');
    const w = S().showFight.wizard;
    expect(S().showFight.phase).toBe('minigame');
    expect(w).toBeTruthy();
    expect(w.mode).toBe('rhythm');
    expect(w.pos).toBe(50);
    expect(w.chart.waves).toHaveLength(HERO.WAVES);
    expect(w.chart.notes).toHaveLength(HERO.WAVES * HERO.NOTES_PER_WAVE);
    expect(w.chart.waves[0].spells).toHaveLength(HERO.HAND);
    expect(w.scores).toEqual({ attacker: 0, defender: 0 });
    expect(w.winner).toBeNull();
    expect(typeof w.songStartAt).toBe('number');
    expect(S().showFight.race).toBeFalsy(); // PAS le duel éclair de repli
  });

  it('surface en ligne : le duel de sorts démarre AUSSI (pas de repli éclair)', () => {
    beginDuel('online');
    expect(S().showFight.wizard?.mode).toBe('rhythm');
    expect(S().showFight.race).toBeFalsy();
  });

  it('bon sort au bon timing : le score du camp monte, le rai penche vers lui', () => {
    beginDuel('phone');
    const note = S().showFight.wizard.chart.notes[0];
    hitPerfect('attacker', note);
    const w = S().showFight.wizard;
    expect(w.scores.attacker).toBe(HERO.PERFECT_PTS);
    expect(w.combos.attacker).toBe(1);
    expect(w.last.attacker.verdict).toBe('perfect');
    expect(w.pos).toBeGreaterThan(50);        // penche vers le défenseur (l'attaquant mène)
    expect(w.push.side).toBe('attacker');
  });

  it('mauvais sort : aucun point, combo cassé, rai inchangé', () => {
    beginDuel('phone');
    const notes = S().showFight.wizard.chart.notes;
    hitPerfect('attacker', notes[0]);          // combo 1
    hitWrong('attacker', notes[1]);            // casse
    const w = S().showFight.wizard;
    expect(w.scores.attacker).toBe(HERO.PERFECT_PTS); // pas de point ajouté
    expect(w.combos.attacker).toBe(0);
    expect(w.last.attacker.verdict).toBe('wrong');
  });

  it('anti double-compte : la même note ne peut être marquée deux fois par un camp', () => {
    beginDuel('phone');
    const note = S().showFight.wizard.chart.notes[0];
    hitPerfect('attacker', note);
    const after1 = S().showFight.wizard.scores.attacker;
    hitPerfect('attacker', note);              // rejoué : ignoré
    expect(S().showFight.wizard.scores.attacker).toBe(after1);
  });

  it('K.O. avant la fin : écart de score plein → winner + coup au but, puis fightMatchWin', () => {
    beginDuel('phone');
    const notes = S().showFight.wizard.chart.notes;
    // 6 parfaits d'affilée : 100×4 (×1) + 200×2 (×2) = 800 = KO_DIFF → K.O.
    for (let i = 0; i < 6; i++) hitPerfect('attacker', notes[i]);
    const w = S().showFight.wizard;
    expect(w.pos).toBe(100);
    expect(w.winner).toBe('attacker');
    expect(w.hit.side).toBe('defender');       // le perdant est frappé
    expect(S().showFight.winnerSide).toBeFalsy();
    vi.advanceTimersByTime(WIZARD_HIT_MS);
    expect(S().showFight.winnerSide).toBe('attacker');
    expect(S().showFight.phase).toBe('reward'); // duel unique → récompense
  });

  it('fin de chanson (timer d\'autorité) : meilleur score gagne', () => {
    beginDuel('phone');
    const w0 = S().showFight.wizard;
    hitPerfect('attacker', w0.chart.notes[0]); // 100 pts, sous le seuil K.O.
    // Laisse filer toute la chanson + la marge + le coup au but.
    vi.advanceTimersByTime(SONG_LEAD_MS + w0.chart.duration + SONG_FINALIZE_BUFFER_MS);
    expect(S().showFight.wizard.winner).toBe('attacker');
    vi.advanceTimersByTime(WIZARD_HIT_MS);
    expect(S().showFight.winnerSide).toBe('attacker');
    expect(S().showFight.phase).toBe('reward');
  });

  it('un intent turnWizardHit est mappé au bon camp par jeton', () => {
    beginDuel('phone');
    const f = S().showFight;
    const note = f.wizard.chart.notes[0];
    const key = _peekAnswerKey();
    // Le DÉFENSEUR (idx = defenderIndex) tape le bon sort : mappé sur SON camp.
    S().applyFightIntent(f.defenderIndex, 'turnWizardHit', {
      noteId: note.id, spellIndex: key[note.id], dt: 0,
    });
    const w = S().showFight.wizard;
    expect(w.scores.defender).toBe(HERO.PERFECT_PTS);
    expect(w.pos).toBeLessThan(50);            // penche vers l'attaquant (le défenseur mène)
    expect(w.push.side).toBe('defender');
  });

  it('anti-triche : le payload publie la partition SANS la clé de réponse', () => {
    beginDuel('phone');
    const wizard = buildTurnPayload(S()).fight.wizard;
    expect(wizard).toBeTruthy();
    expect(wizard.chart).toBeTruthy();
    expect(Array.isArray(wizard.chart.notes)).toBe(true); // les notes visibles : OK
    expect(wizard.key).toBeUndefined();                   // la clé : JAMAIS
    expect(wizard.scores).toBeTruthy();
    expect(JSON.stringify(wizard)).not.toContain('"key"');
  });

  it('anti-triche : le snapshot en ligne ne porte pas non plus la clé', () => {
    beginDuel('online');
    const wizard = serializeSnapshot(S()).showFight.wizard;
    expect(wizard).toBeTruthy();
    expect(wizard.chart).toBeTruthy();
    expect(wizard.key).toBeUndefined();
  });
});
