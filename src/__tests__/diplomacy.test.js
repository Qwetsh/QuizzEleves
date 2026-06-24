// Extension « Complots & pactes » : pactes de non-agression secrets (réutilisent
// le flux du Troc) + trahison punie. Couvre les helpers purs, l'application d'une
// offre avec pacte, l'expiration au fil des tours et la trahison d'un pacte.
import { describe, it, expect } from 'vitest';
import { useGameStore } from '../store/gameStore.js';
import {
  hasPactSpec, isPactTrade, pactTurns, withPromise, hasActivePromise,
  withoutPromise, tickPromises, PACT_DEFAULT_TURNS, PACT_MAX_TURNS,
  hasCoalitionSpec, isCoalitionTrade, isDiploTrade, coalitionTurns,
  withCoalition, tickCoalitions,
} from '../logic/pacts.js';

const S = () => useGameStore.getState();
const logHas = (sub) => S().log.some((e) => (typeof e === 'string' ? e : e?.text || '').includes(sub));

function team(i, over = {}) {
  return {
    name: `T${i}`, emoji: '🦁', color: '#111', pos: 'n1',
    money: 50, correct: 0, wrong: 0, powers: {},
    equipment: { head: null, body: null, feet: null }, bag: [],
    ...over,
  };
}

function setup(teams, extra = {}) {
  useGameStore.setState({
    phase: 'game', devSandbox: true, finished: false, currentTeam: 99, log: [],
    board: { n1: { x: 1, y: 0, type: 'subject', next: ['n2'] }, n2: { x: 2, y: 0, type: 'subject', next: [] } },
    // On coupe équipement/maîtrise pour garder nextTurn/usePower minimalistes.
    extensions: { equipment: false, mastery: false, trade: true, diplomacy: true },
    showQuestion: null, showEvent: null, showFight: null, showDuelChoice: null,
    rolling: false, showDiceModal: false, awaitingChoice: false, pendingActions: null, pendingLanding: false,
    showTargetPicker: null,
    ...extra, teams,
  });
}

describe('pacts : helpers purs', () => {
  it('hasPactSpec / isPactTrade', () => {
    expect(hasPactSpec({ pact: { turns: 1 } })).toBe(true);
    expect(hasPactSpec({ gold: 5 })).toBe(false);
    expect(isPactTrade({ give: { pact: { turns: 1 } }, want: {} })).toBe(true);
    expect(isPactTrade({ give: { gold: 5 }, want: {} })).toBe(false);
  });

  it('pactTurns : clampe la durée (1..5, défaut)', () => {
    expect(pactTurns({ pact: { turns: 3 } })).toBe(3);
    expect(pactTurns({ pact: { turns: 99 } })).toBe(PACT_MAX_TURNS);
    expect(pactTurns({ pact: { turns: 0 } })).toBe(PACT_DEFAULT_TURNS);
    expect(pactTurns({ gold: 5 })).toBe(0);
  });

  it('withPromise garde la durée la plus longue ; withoutPromise retire', () => {
    let p = withPromise([], 1, 2);
    expect(p).toEqual([{ to: 1, turns: 2 }]);
    p = withPromise(p, 1, 1); // ne raccourcit pas
    expect(p).toEqual([{ to: 1, turns: 2 }]);
    expect(hasActivePromise({ promises: p }, 1)).toBe(true);
    expect(withoutPromise(p, 1)).toEqual([]);
  });

  it('tickPromises décrémente et expire à 0', () => {
    expect(tickPromises([{ to: 1, turns: 2 }])).toEqual({ promises: [{ to: 1, turns: 1 }], expired: 0 });
    expect(tickPromises([{ to: 1, turns: 1 }])).toEqual({ promises: [], expired: 1 });
  });
});

describe('applyTrade : offre avec pacte (secrète)', () => {
  it('extorsion : la cible paie, l’auteur promet, AUCUN log public', () => {
    setup([team(0, { money: 20 }), team(1, { money: 20 })]);
    const r = S().applyTrade({ from_idx: 0, to_idx: 1, give: { pact: { turns: 2 } }, want: { gold: 5 } });
    expect(r.ok).toBe(true);
    expect(S().teams[0].money).toBe(25); // reçoit la rançon
    expect(S().teams[1].money).toBe(15); // paie
    expect(hasActivePromise(S().teams[0], 1)).toBe(true); // A promet d'épargner B
    expect(hasActivePromise(S().teams[1], 0)).toBe(false);
    expect(logHas('affaire')).toBe(false); // pas de ligne de troc → secret
  });

  it('pacte mutuel : promesses des deux côtés', () => {
    setup([team(0), team(1)]);
    const r = S().applyTrade({ from_idx: 0, to_idx: 1, give: { pact: { turns: 3 } }, want: { pact: { turns: 3 } } });
    expect(r.ok).toBe(true);
    expect(hasActivePromise(S().teams[0], 1)).toBe(true);
    expect(hasActivePromise(S().teams[1], 0)).toBe(true);
  });

  it('non-régression : un troc SANS pacte reste journalisé et ne crée pas de promesse', () => {
    setup([team(0), team(1)]);
    const r = S().applyTrade({ from_idx: 0, to_idx: 1, give: { gold: 5 }, want: {} });
    expect(r.ok).toBe(true);
    expect(logHas('affaire')).toBe(true);
    expect((S().teams[0].promises || []).length).toBe(0);
  });
});

describe('expiration au fil des tours', () => {
  it('un pacte perd un tour quand l’équipe regagne la main', () => {
    setup([team(0, { promises: [{ to: 1, turns: 2 }] }), team(1)]);
    useGameStore.setState({ currentTeam: 1 }); // newCurrent = 0 → team0 décrémente
    S().nextTurn();
    expect(S().teams[0].promises[0].turns).toBe(1);
  });
});

describe('coalitions : helpers purs', () => {
  it('hasCoalitionSpec / isCoalitionTrade / isDiploTrade', () => {
    expect(hasCoalitionSpec({ coalition: { against: 2, turns: 2 } })).toBe(true);
    expect(hasCoalitionSpec({ gold: 5 })).toBe(false);
    const coTrade = { give: { coalition: { against: 2, turns: 2 } }, want: { coalition: { against: 2, turns: 2 } } };
    expect(isCoalitionTrade(coTrade)).toBe(true);
    expect(isPactTrade(coTrade)).toBe(false);
    expect(isDiploTrade(coTrade)).toBe(true); // coalition = offre secrète
    expect(isDiploTrade({ give: { pact: { turns: 1 } }, want: {} })).toBe(true);
    expect(isDiploTrade({ give: { gold: 5 }, want: {} })).toBe(false);
  });

  it('coalitionTurns clampe ; withCoalition garde la plus longue ; tickCoalitions expire', () => {
    expect(coalitionTurns({ coalition: { against: 2, turns: 9 } })).toBe(PACT_MAX_TURNS);
    expect(coalitionTurns({ gold: 5 })).toBe(0);
    let c = withCoalition([], 1, 2, 3);
    expect(c).toEqual([{ with: 1, against: 2, turns: 3 }]);
    c = withCoalition(c, 1, 2, 1); // ne raccourcit pas
    expect(c).toEqual([{ with: 1, against: 2, turns: 3 }]);
    expect(tickCoalitions([{ with: 1, against: 2, turns: 1 }])).toEqual({ coalitions: [], expired: 1 });
  });
});

describe('applyTrade : coalition (attaque commune, secrète)', () => {
  it('les deux alliés enregistrent la coalition contre la cible, AUCUN log public', () => {
    setup([team(0), team(1), team(2)]);
    const term = { coalition: { against: 2, turns: 3 } };
    const r = S().applyTrade({ from_idx: 0, to_idx: 1, give: term, want: { coalition: { against: 2, turns: 3 } } });
    expect(r.ok).toBe(true);
    expect(S().teams[0].coalitions).toEqual([{ with: 1, against: 2, turns: 3 }]);
    expect(S().teams[1].coalitions).toEqual([{ with: 0, against: 2, turns: 3 }]);
    expect(S().teams[2].coalitions || []).toEqual([]); // la cible n'est au courant de rien
    expect(logHas('affaire')).toBe(false); // secret
  });

  it('une coalition perd un tour quand l’équipe regagne la main', () => {
    setup([team(0, { coalitions: [{ with: 1, against: 2, turns: 2 }] }), team(1), team(2)]);
    useGameStore.setState({ currentTeam: 2 }); // 3 équipes : (2+1)%3 = 0 → team0 décrémente
    S().nextTurn();
    expect(S().teams[0].coalitions[0].turns).toBe(1);
  });
});

describe('trahison d’un pacte', () => {
  it('attaquer une cible promise : pénalité + promesse rompue + log public', () => {
    setup([
      team(0, { money: 50, promises: [{ to: 1, turns: 2 }], powers: { foudre: { level: 1, charges: 1 } } }),
      team(1, { money: 50 }),
    ]);
    useGameStore.setState({ currentTeam: 0, showTargetPicker: { powerKey: 'foudre' } });
    S().applyOffensivePower(1);
    expect(S().teams[0].money).toBe(40); // -PACT_BETRAY_PENALTY
    expect(hasActivePromise(S().teams[0], 1)).toBe(false); // pacte rompu
    expect(logHas('TRAHISON')).toBe(true); // cérémonie publique
  });

  it('attaquer une équipe SANS pacte : aucune pénalité', () => {
    setup([
      team(0, { money: 50, powers: { foudre: { level: 1, charges: 1 } } }),
      team(1, { money: 50 }),
    ]);
    useGameStore.setState({ currentTeam: 0, showTargetPicker: { powerKey: 'foudre' } });
    S().applyOffensivePower(1);
    expect(S().teams[0].money).toBe(50);
  });
});
