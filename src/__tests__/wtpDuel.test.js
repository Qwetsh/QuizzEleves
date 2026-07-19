// Duel silhouette (« Qui est ce Pokémon ?! ») multi-surface : sur les surfaces
// téléphone/en ligne, fightBegin route vers une COURSE D'IMAGES pilotée par le
// store (flag showFight.wtp = clé du pool) — plateau TV sur l'écran partagé
// (WtpDuelStage), réponses par intents turnFightAnswer. La révélation
// (« C'est … ! ») fige la manche (deadline coupée, réponses ignorées) avant de
// marquer le point ou de resservir une silhouette.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { useGameStore } from '../store/gameStore.js';

const S = () => useGameStore.getState();

const QS = [
  { q: 'Qui est ce Pokémon ?', a: ['Pikachu', 'Salamèche', 'Bulbizarre', 'Carapuce'], c: 0, img: 'https://x/pika.png', render: 'silhouette' },
  { q: 'Qui est ce Pokémon ?', a: ['Rondoudou', 'Évoli', 'Psykokwak', 'Goupix'], c: 1, img: 'https://x/evoli.png', render: 'silhouette' },
];

function startWtpDuel(surface = 'phone') {
  useGameStore.setState({
    phase: 'setup', devSandbox: false, _devRestore: null,
    connectionMode: 'board', phoneController: false, sessionCode: null,
    showFight: null, finished: false, log: [],
  });
  S().devStartFight('pokemon_silhouette', false, surface);
  // devStartFight recharge les pools scolaires : on injecte la cassette après.
  useGameStore.setState({ questions: { pokemon_silhouette: QS }, askedQuestions: {} });
  S().fightBegin();
}

describe('duel silhouette multi-surface (showFight.wtp)', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('surface téléphone : fightBegin route vers la course d\'images', () => {
    startWtpDuel('phone');
    const f = S().showFight;
    expect(f.wtp).toBe('pokemon_silhouette');
    expect(f.phase).toBe('minigame');
    expect(f.race?.q?.img).toBeTruthy();
    expect(f.race.reveal ?? null).toBeNull();
  });

  it('surface en ligne : même routage (chaque duelliste voit la silhouette chez lui)', () => {
    startWtpDuel('online');
    expect(S().showFight.wtp).toBe('pokemon_silhouette');
    expect(S().showFight.race?.q?.img).toBeTruthy();
  });

  it('surface tactile : pas de course — briefing puis mini-jeu composant', () => {
    startWtpDuel('board');
    expect(S().showFight.phase).toBe('briefing');
    expect(S().showFight.wtp).toBeUndefined();
  });

  it('bonne réponse → révélation figée, puis manche marquée et silhouette suivante', () => {
    startWtpDuel('phone');
    const f = S().showFight;
    S().submitFightAnswer(f.attackerIndex, f.race.q.c);
    const r = S().showFight.race;
    expect(r.reveal).toEqual({ c: f.race.q.c, winner: 'attacker' });
    expect(r.deadline).toBeNull(); // manche figée → le timeout en vol s'annule
    expect(S().showFight.wins.attacker).toBe(0); // pas encore marqué
    // Réponse arrivée pendant la révélation : ignorée.
    S().submitFightAnswer(f.defenderIndex, 0);
    expect(S().showFight.race.answers.defender).toBeUndefined();
    vi.advanceTimersByTime(3000);
    expect(S().showFight.wins.attacker).toBe(1);
    expect(S().showFight.race.q.img).not.toBe(f.race.q.img); // silhouette suivante
    expect(S().showFight.race.reveal ?? null).toBeNull();
  });

  it('deux erreurs → révélation sans vainqueur puis nouvelle silhouette (0–0)', () => {
    startWtpDuel('phone');
    const f = S().showFight;
    const wrong = (f.race.q.c + 1) % 4;
    S().submitFightAnswer(f.attackerIndex, wrong);
    expect(S().showFight.race.reveal ?? null).toBeNull(); // on attend l'autre camp
    S().submitFightAnswer(f.defenderIndex, wrong);
    expect(S().showFight.race.reveal).toBeTruthy();
    expect(S().showFight.race.reveal.winner).toBeNull();
    vi.advanceTimersByTime(3000);
    expect(S().showFight.wins).toEqual({ attacker: 0, defender: 0 });
    expect(S().showFight.race.reveal ?? null).toBeNull();
  });

  it('temps écoulé sans réponse → révélation sans vainqueur puis resert', () => {
    startWtpDuel('phone');
    const firstImg = S().showFight.race.q.img;
    vi.advanceTimersByTime(20000); // RACE_DURATION
    expect(S().showFight.race.reveal).toBeTruthy();
    expect(S().showFight.race.reveal.winner).toBeNull();
    vi.advanceTimersByTime(3000);
    expect(S().showFight.race.q.img).not.toBe(firstImg);
    expect(S().showFight.wins).toEqual({ attacker: 0, defender: 0 });
  });
});
