// Gardes de surface des duels multi-surface (audit 2026-07) :
//  - fightBegin : memory/pkmn ne démarrent JAMAIS en ligne (aucun client online
//    ne rend ces vues → soft-lock) — repli duel éclair ;
//  - serveRaceQuestion : les sujets « larges » (cassettes : 'scolaire', 'lv2'…)
//    sont résolus via resolveSubjectFor avant de lire le pool ;
//  - applyFightIntent turnFightClose : fermeture seulement en phase result ;
//  - snapshot en ligne (stripFightSecret) : réponses de course en booléens,
//    pas d'usedIds curio, pas de blocs memory/pkmn, curioSeen/Seq non diffusés ;
//  - fightChooseReward : 'loot' refusé si l'extension objets est coupée ;
//  - applyClaimIntent : pas de vol d'équipe en partie réelle ;
//  - adminFightSkip : le prof débloque un duel coincé (pas de vainqueur).
import { describe, it, expect, vi, afterEach } from 'vitest';
import { useGameStore } from '../store/gameStore.js';
import { serializeSnapshot } from '../logic/onlineSnapshot.js';
import { getQuestionStore, setQuestionData } from '../data/questions/index.js';

const S = () => useGameStore.getState();

const BOARD = (() => {
  const b = { depart: { x: 0, y: 0, type: 'depart', next: ['n1'] } };
  for (let i = 1; i <= 8; i++) b[`n${i}`] = { x: i, y: 0, type: 'subject', subject: 'maths', next: [i === 8 ? 'arrivee' : `n${i + 1}`] };
  b.arrivee = { x: 9, y: 0, type: 'arrivee', next: [] };
  return b;
})();

const mkTeam = (i, over = {}) => ({
  name: `T${i}`, emoji: '🦁', color: '#111', money: 50, pos: 'n4',
  correct: 0, wrong: 0, streak: 0, powers: {},
  equipment: { head: null, body: null, feet: null }, bag: [],
  ...over,
});

const RACE_Q = { id: 'q1', q: 'Question ?', a: ['A', 'B', 'C', 'D'], c: 2, e: 'explication' };

const FIGHT = (over = {}) => ({
  attackerIndex: 0, defenderIndex: 1, subject: 'maths', phase: 'versus',
  round: 1, wins: { attacker: 0, defender: 0 }, winnerSide: null,
  reward: null, resultMessage: null,
  ...over,
});

// État « vrai mode en ligne » : connectionMode='online' ET phoneController=true
// (HomeScreen pose les deux flags — c'est LA combinaison qui piégeait fightBegin).
function setup(over = {}) {
  useGameStore.setState({
    phase: 'game', devSandbox: true, finished: false, currentTeam: 0, log: [],
    connectionMode: 'online', phoneController: true, sessionCode: null,
    board: BOARD, askedQuestions: {}, categoryPools: {}, questions: {},
    teams: [mkTeam(0), mkTeam(1)],
    showFight: null, movePath: null, extensions: undefined,
    curioSeen: {}, curioSeq: 0,
    ...over,
  });
}

afterEach(() => { vi.useRealTimers(); });

describe('fightBegin — routage par surface', () => {
  it('(a) en ligne + phoneController : sujet memory → duel éclair (course), PAS de plateau memory', () => {
    vi.useFakeTimers();
    // 'vocabulaire' résout le moteur memory (cf. memoryDuel.test) — mais en
    // ligne, aucun client ne rend MemoryDuelStage : repli course obligatoire.
    setup({ questions: { vocabulaire: [RACE_Q] }, showFight: FIGHT({ subject: 'vocabulaire' }) });
    S().fightBegin();
    const f = S().showFight;
    expect(f.memory).toBeUndefined();
    expect(f.pkmn).toBeUndefined();
    expect(f.phase).toBe('minigame');
    expect(f.race?.q?.q).toBe(RACE_Q.q);
    vi.clearAllTimers();
  });

  it('surface « écran + téléphones » (hors ligne) : memory route toujours vers le plateau store', () => {
    vi.useFakeTimers();
    setup({ connectionMode: 'phone', showFight: FIGHT({ subject: 'vocabulaire' }) });
    S().fightBegin();
    expect(S().showFight.memory).toBeTruthy();
    expect(S().showFight.race).toBeUndefined();
    vi.clearAllTimers();
  });

  it('(d) sujet LARGE (cassettes) résolu via resolveSubjectFor avant de lire le pool', () => {
    vi.useFakeTimers();
    setup({ questions: { maths: [RACE_Q] }, showFight: FIGHT({ subject: 'scolaire' }) });
    const orig = S().resolveSubjectFor;
    const spy = vi.fn(() => 'maths');
    useGameStore.setState({ resolveSubjectFor: spy });
    S().fightBegin();
    // Résolu pour l'ATTAQUANT (équipe qui arrive), comme fightPickQuestion.
    expect(spy).toHaveBeenCalledWith('scolaire', 0);
    // Le pool résolu sert la question (sans résolution : pool ['scolaire'] vide
    // → l'attaquant aurait gagné la manche sans jouer).
    expect(S().showFight.race?.q?.q).toBe(RACE_Q.q);
    expect(S().showFight.wins).toEqual({ attacker: 0, defender: 0 });
    useGameStore.setState({ resolveSubjectFor: orig });
    vi.clearAllTimers();
  });

  it('(e) thème hors partie mais présent dans le STORE : repli transverse sert la question (pas de victoire gratuite)', () => {
    vi.useFakeTimers();
    // Régression « startDuel + aléatoire à N choix » : le picker tire dans
    // allSubjectsWithContent (STORE global), plus large que get().questions
    // (pool de la partie). Un thème présent au STORE mais absent de la partie
    // doit passer par le repli getSubjectPool — sinon pool vide → l'attaquant
    // gagne la manche sans jouer.
    const origCycle4 = getQuestionStore().cycle4;
    setQuestionData({ cycle4: { ...origCycle4, themeHorsPartie: [RACE_Q] } });
    setup({ questions: {}, showFight: FIGHT({ subject: 'themeHorsPartie' }) });
    S().fightBegin();
    const f = S().showFight;
    expect(f.race?.q?.q).toBe(RACE_Q.q);                   // question bien servie…
    expect(f.wins).toEqual({ attacker: 0, defender: 0 });  // …aucune manche offerte
    setQuestionData({ cycle4: origCycle4 });               // restaure le STORE
    vi.clearAllTimers();
  });
});

describe('applyFightIntent — turnFightClose gardé par phase', () => {
  it('(b) refusé en phase reward (esquive de récompense) et minigame (annulation de défaite)', () => {
    setup({ showFight: FIGHT({ phase: 'reward', winnerSide: 'attacker' }) });
    S().applyFightIntent(1, 'turnFightClose'); // le PERDANT tente d'esquiver
    expect(S().showFight?.phase).toBe('reward');

    useGameStore.setState({ showFight: FIGHT({ phase: 'minigame', race: { q: RACE_Q, answers: {}, deadline: null } }) });
    S().applyFightIntent(0, 'turnFightClose');
    expect(S().showFight?.phase).toBe('minigame');
  });

  it('accepté en phase result (fin normale du duel)', () => {
    setup({ showFight: FIGHT({ phase: 'result', winnerSide: 'attacker', resultMessage: 'ok' }) });
    S().applyFightIntent(0, 'turnFightClose');
    expect(S().showFight).toBeNull();
  });
});

describe('snapshot en ligne — stripFightSecret durci', () => {
  it('(c) réponses en booléens, pas d’usedIds, pas de memory/pkmn, curioSeen/Seq exclus', () => {
    setup({
      curioSeen: { monde_reel: { paris: 1 } }, curioSeq: 1,
      showFight: FIGHT({
        phase: 'minigame',
        race: { q: { ...RACE_Q }, answers: { attacker: { index: 1, at: 5 } }, deadline: 123 },
        curio: {
          roundNo: 1, scores: { attacker: 0, defender: 0 }, usedIds: ['paris'],
          target: { id: 'paris', label: 'Paris', x: 0.5, y: 0.5, universe: 'monde_reel', image: 'img.jpg', showName: false },
          marks: { attacker: { x: 0.1, y: 0.1 }, defender: null },
          validated: { attacker: false, defender: false }, reveal: null,
        },
        memory: { cards: [{ key: 'k', text: 'secret', pairId: 'p' }], matched: {}, flipped: [] },
        pkmn: { choice: { A: { type: 'atk', index: 0 } } },
      }),
    });
    const data = serializeSnapshot(S());
    const f = data.showFight;
    // Course : ni bonne réponse ni index adverses avant la fin de manche.
    expect(f.race.q.c).toBeUndefined();
    expect(f.race.q.e).toBeUndefined();
    expect(f.race.answers).toEqual({ attacker: true, defender: false });
    // Curio : usedIds (le dernier id EST la réponse) et cible/marques masqués.
    expect(f.curio.usedIds).toBeUndefined();
    expect(f.curio.target.id).toBeNull();
    expect(f.curio.target.x).toBeNull();
    expect(f.curio.marks).toEqual({ attacker: null, defender: null });
    // Défense en profondeur : memory/pkmn ne partent jamais dans le snapshot.
    expect(f.memory).toBeUndefined();
    expect(f.pkmn).toBeUndefined();
    // Anti-répétition curio : sauvegardé localement mais jamais diffusé.
    expect('curioSeen' in data).toBe(false);
    expect('curioSeq' in data).toBe(false);
  });

  it('usedIds reste absent même à la révélation (cible publiée, historique non)', () => {
    setup({
      showFight: FIGHT({
        phase: 'minigame',
        curio: {
          roundNo: 1, scores: { attacker: 100, defender: 0 }, usedIds: ['paris'],
          target: { id: 'paris', label: 'Paris', x: 0.5, y: 0.5, universe: 'monde_reel', image: 'img.jpg', showName: false },
          marks: { attacker: { x: 0.1, y: 0.1 }, defender: { x: 0.2, y: 0.2 } },
          validated: { attacker: true, defender: true },
          reveal: { scores: { attacker: 100, defender: 0 } },
        },
      }),
    });
    const f = serializeSnapshot(S()).showFight;
    expect(f.curio.usedIds).toBeUndefined();
    expect(f.curio.target.x).toBe(0.5); // révélé : la cible part
  });
});

describe('fightChooseReward — butin d’objet gaté par l’extension', () => {
  it('refuse « loot » quand l’extension objets est coupée (intent forgé)', () => {
    setup({ extensions: { equipment: false }, showFight: FIGHT({ phase: 'reward', winnerSide: 'attacker' }) });
    S().fightChooseReward('loot');
    expect(S().showFight.reward).toBeNull(); // rien posé, pas de soft-lock
  });

  it('l’accepte quand l’extension est active', () => {
    vi.useFakeTimers();
    setup({ extensions: { equipment: true }, showFight: FIGHT({ phase: 'reward', winnerSide: 'attacker' }) });
    S().fightChooseReward('loot');
    expect(S().showFight.reward?.choice).toBe('loot');
    vi.clearAllTimers();
  });
});

describe('applyClaimIntent — garde anti-vol d’équipe', () => {
  it('partie réelle : refuse un jeton étranger, accepte re-claim et équipe libre', () => {
    setup({ devSandbox: false, teams: [mkTeam(0, { token: 'tA' }), mkTeam(1, { token: null })] });
    S().applyClaimIntent('pirate', { idx: 0 });
    expect(S().teams[0].token).toBe('tA'); // vol refusé
    S().applyClaimIntent('tA', { idx: 0 });
    expect(S().teams[0].token).toBe('tA'); // re-claim idempotent (reload)
    S().applyClaimIntent('tB', { idx: 1 });
    expect(S().teams[1].token).toBe('tB'); // claim initial d'une équipe libre
  });

  it('bac à sable dev : liens de test libres (on rejoue les équipes à volonté)', () => {
    setup({ devSandbox: true, teams: [mkTeam(0, { token: 'tA' }), mkTeam(1)] });
    S().applyClaimIntent('autre', { idx: 0 });
    expect(S().teams[0].token).toBe('autre');
  });
});

describe('adminFightSkip — déblocage prof d’un duel coincé', () => {
  it('abandonne le duel sans vainqueur et enchaîne le tour suivant', () => {
    setup({ showFight: FIGHT({ phase: 'minigame', race: { q: RACE_Q, answers: {}, deadline: null } }) });
    S().applyAdminIntent('adminFightSkip', {});
    expect(S().showFight).toBeNull();
    expect(S().currentTeam).toBe(1); // le tour est passé
    expect(S().teams[0].money).toBe(50); // aucune récompense appliquée
    expect(S().teams[1].money).toBe(50);
  });

  it('no-op sans duel en cours', () => {
    setup({ showFight: null });
    S().applyAdminIntent('adminFightSkip', {});
    expect(S().currentTeam).toBe(0);
  });
});
