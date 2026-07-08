import { describe, it, expect } from 'vitest';
import {
  serializeSnapshot, hydrateSnapshot, SNAPSHOT_FIELDS, SNAPSHOT_VERSION,
} from '../logic/onlineSnapshot.js';

// État de store minimal représentatif pour les tests.
function makeState(over = {}) {
  return {
    teams: [{ name: 'Lions', pos: 3 }, { name: 'Dragons', pos: 5 }],
    currentTeam: 1,
    board: [
      { id: 0, type: 'start' },
      { id: 1, type: 'subject', subject: 'maths', trap: { by: 0, kind: 'recul' } },
      { id: 2, type: 'event' },
    ],
    askedQuestions: { maths: new Set([10, 20]), fr: new Set() },
    phase: 'game',
    log: ['a', 'b'],
    turnCount: 4,
    rolling: true,
    diceValue: 6,
    movePath: [{ teamIndex: 1, waypoints: [{ x: 0, y: 0 }] }],
    showQuestion: null,
    ...over,
  };
}

describe('onlineSnapshot', () => {
  it('inclut le socle de jeu ET les champs de rendu transitoires', () => {
    expect(SNAPSHOT_FIELDS).toContain('teams');      // socle
    expect(SNAPSHOT_FIELDS).toContain('board');
    expect(SNAPSHOT_FIELDS).toContain('rolling');    // rendu
    expect(SNAPSHOT_FIELDS).toContain('showQuestion');
    // dédupliqué
    expect(new Set(SNAPSHOT_FIELDS).size).toBe(SNAPSHOT_FIELDS.length);
  });

  it('EXCLUT le pool `questions` du snapshot (bande passante : ~3 Mo évités par publish)', () => {
    expect(SNAPSHOT_FIELDS).not.toContain('questions');
    const snap = serializeSnapshot(makeState({ questions: { maths: [{ q: 'grosse liste' }] } }));
    expect('questions' in snap).toBe(false);
    // Le miroir ne pioche jamais de question (l'hôte pousse `showQuestion`) → son
    // pool local ne doit pas être écrasé par l'hydratation.
    const hydrated = hydrateSnapshot(snap);
    expect('questions' in hydrated).toBe(false);
  });

  it('sérialise askedQuestions (Set → array) et le rehydrate (array → Set)', () => {
    const snap = serializeSnapshot(makeState());
    expect(snap.v).toBe(SNAPSHOT_VERSION);
    expect(snap.askedQuestions.maths).toEqual([10, 20]);
    // JSON-safe : pas de Set résiduel
    expect(JSON.parse(JSON.stringify(snap)).askedQuestions.maths).toEqual([10, 20]);

    const hydrated = hydrateSnapshot(snap);
    expect(hydrated.askedQuestions.maths).toBeInstanceOf(Set);
    expect([...hydrated.askedQuestions.maths]).toEqual([10, 20]);
    expect(hydrated._mirror).toBe(true);
  });

  it('retire les pièges du plateau (info cachée)', () => {
    const snap = serializeSnapshot(makeState());
    expect(snap.board[1].trap).toBeUndefined();
    // le reste de la case est préservé
    expect(snap.board[1].subject).toBe('maths');
    expect(snap.board[0].type).toBe('start');
  });

  it('masque la bonne réponse tant que la question n\'est pas révélée', () => {
    const q = { question: { q: '2+2 ?', a: ['3', '4'], c: 1, e: 'quatre' }, answerRevealed: false };
    const snap = serializeSnapshot(makeState({ showQuestion: q }));
    expect(snap.showQuestion.question.c).toBeUndefined();
    expect(snap.showQuestion.question.e).toBeUndefined();
    expect(snap.showQuestion.question.a).toEqual(['3', '4']); // énoncé/choix conservés
  });

  it('révèle la bonne réponse une fois answerRevealed=true', () => {
    const q = { question: { q: '2+2 ?', a: ['3', '4'], c: 1, e: 'quatre' }, answerRevealed: true };
    const snap = serializeSnapshot(makeState({ showQuestion: q }));
    expect(snap.showQuestion.question.c).toBe(1);
    expect(snap.showQuestion.question.e).toBe('quatre');
  });

  it('round-trip : les champs de fond survivent à sérialise→hydrate', () => {
    const hydrated = hydrateSnapshot(serializeSnapshot(makeState()));
    expect(hydrated.teams).toHaveLength(2);
    expect(hydrated.currentTeam).toBe(1);
    expect(hydrated.turnCount).toBe(4);
    expect(hydrated.diceValue).toBe(6);
    expect(hydrated.rolling).toBe(true);
  });

  it('hydrateSnapshot renvoie null sur entrée invalide', () => {
    expect(hydrateSnapshot(null)).toBeNull();
    expect(hydrateSnapshot(42)).toBeNull();
  });
});
