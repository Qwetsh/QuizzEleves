// Combat Pokémon piloté par le store (surface « écran + téléphones ») :
// draft par intents, choix SECRETS (payload = accusés booléens seulement),
// résolution séquencée par minuteries hôte, remplaçant, garde-fous.
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { useGameStore } from '../store/gameStore';
import { buildTurnPayload } from '../logic/sessionConfig';

const baseFight = () => ({
  attackerIndex: 0, defenderIndex: 1, subject: 'pokemon',
  phase: 'versus', round: 1, wins: { attacker: 0, defender: 0 },
  winnerSide: null, reward: null, resultMessage: null,
});

const teams = [
  { name: 'Les Lions', emoji: '🦁', color: '#d84939', powers: {}, equipment: {}, bag: [], money: 0 },
  { name: 'Les Aigles', emoji: '🦅', color: '#2f6fd6', powers: {}, equipment: {}, bag: [], money: 0 },
];

describe('combat Pokémon — duel piloté par le store (Game Boy)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    useGameStore.setState({ teams, showFight: baseFight(), phoneController: true, connectionMode: 'phone' });
    useGameStore.getState().fightBegin();
  });
  afterEach(() => {
    vi.useRealTimers();
    useGameStore.setState({ showFight: null, phoneController: false, connectionMode: 'board' });
  });

  const pk = () => useGameStore.getState().showFight?.pkmn;

  it('fightBegin (surface téléphones) route vers le duel store : draft 6/6', () => {
    const p = pk();
    expect(p).toBeTruthy();
    expect(p.stage).toBe('draft');
    expect(p.offers.A.length).toBe(6);
    expect(p.offers.B.length).toBe(6);
    expect(useGameStore.getState().showFight.phase).toBe('minigame');
  });

  it('draft : picks bornés à 3, validation des deux camps → combat + vue', () => {
    const st = useGameStore.getState();
    const p = pk();
    p.offers.A.forEach((m) => st.pkmnDuelPick('A', m.id)); // essaie d'en prendre 6
    expect(pk().picks.A.length).toBe(3); // borné
    p.offers.B.slice(0, 3).forEach((m) => st.pkmnDuelPick('B', m.id));
    st.pkmnDuelValidate('A');
    expect(pk().stage).toBe('draft'); // B pas encore prêt
    st.pkmnDuelValidate('B');
    const after = pk();
    expect(after.stage).toBe('battle');
    expect(after.view.A.fighters.length).toBe(3);
    expect(after.view.A.fighters[0].moves.length).toBeGreaterThan(0); // la Game Boy voit ses capacités
  });

  it('choix SECRETS : le payload ne publie que des accusés, la résolution avance la vue', () => {
    const st = useGameStore.getState();
    const p = pk();
    p.offers.A.slice(0, 3).forEach((m) => st.pkmnDuelPick('A', m.id));
    p.offers.B.slice(0, 3).forEach((m) => st.pkmnDuelPick('B', m.id));
    st.pkmnDuelValidate('A');
    st.pkmnDuelValidate('B');

    st.pkmnDuelChoose('A', { type: 'move', index: 0 });
    // Anti-triche : le contenu du choix ne part pas dans le payload.
    const payload = buildTurnPayload(useGameStore.getState());
    expect(payload.fight.pkmn.chosen).toEqual({ A: true, B: false });
    expect(payload.fight.pkmn.choice).toBeUndefined();
    expect(pk().phaseB).toBe('choose');

    st.pkmnDuelChoose('B', { type: 'move', index: 0 });
    expect(pk().phaseB).toBe('anim');
    const hpBefore = ['A', 'B'].map((s) => pk().view[s].fighters[pk().view[s].active].hp);
    vi.advanceTimersByTime(20000); // rejeu séquencé complet du tour
    const after = pk();
    expect(['choose', 'replace', 'over']).toContain(after.phaseB);
    const hpAfter = ['A', 'B'].map((s) => after.view[s].fighters[after.view[s].active].hp);
    // au moins un camp a été touché OU un statut/boost a été posé (jamais un tour muet)
    const boosted = ['A', 'B'].some((s) => Object.values(after.view[s].fighters[after.view[s].active].boosts).some((n) => n !== 0));
    const statused = ['A', 'B'].some((s) => after.view[s].fighters[after.view[s].active].status);
    expect(hpAfter[0] < hpBefore[0] || hpAfter[1] < hpBefore[1] || boosted || statused).toBe(true);
    if (after.phaseB === 'choose') {
      expect(after.choice).toEqual({ A: null, B: null }); // choix remis à zéro
      expect(after.dialog.length).toBeGreaterThan(0);
    }
  });

  it('garde-fous : pas de double choix, pas de switch vers un K.O./actif', () => {
    const st = useGameStore.getState();
    const p = pk();
    p.offers.A.slice(0, 3).forEach((m) => st.pkmnDuelPick('A', m.id));
    p.offers.B.slice(0, 3).forEach((m) => st.pkmnDuelPick('B', m.id));
    st.pkmnDuelValidate('A');
    st.pkmnDuelValidate('B');
    st.pkmnDuelChoose('A', { type: 'switch', index: 0 }); // switch vers l'actif → refusé
    expect(pk().choice.A).toBe(null);
    st.pkmnDuelChoose('A', { type: 'move', index: 0 });
    st.pkmnDuelChoose('A', { type: 'move', index: 2 }); // déjà choisi → ignoré
    expect(pk().choice.A.index).toBe(0);
  });
});
