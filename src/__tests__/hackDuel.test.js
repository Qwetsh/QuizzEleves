// Cyber-duel (Hacking) « complète les trous » multi-surface, PILOTÉ PAR LE STORE.
// Comme les échecs, il tourne AUSSI en ligne : chaque camp CHOISIT SON LANGAGE
// (une fois), puis reçoit SES énigmes et remplit ses trous via les intents
// turnHackLang / turnHackPick (hackDuelLang / hackDuelPick). L'hôte est
// l'autorité : moteur logic/hackPuzzle, minuteries de blocage / révélation,
// victoire de manche (BO3). Le SECRET (réponse de chaque trou + état de
// remplissage) reste module-level → jamais publié (seuls les `choices` partent).
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { useGameStore } from '../store/gameStore.js';
import { buildTurnPayload } from '../logic/sessionConfig.js';
import { HACK_WRONG_HOLD_MS, HACK_REVEAL_MS } from '../store/hackFightHandlers.js';
import hackData from '../data/hackPuzzles.json';
import { languagesOf } from '../logic/hackPuzzle.js';

const S = () => useGameStore.getState();

// Le thème `informatique_numerique` résout le moteur `hack` (cf. THEME_MINIGAMES).
function startHackDuel(surface = 'phone') {
  useGameStore.setState({
    phase: 'setup', devSandbox: false, _devRestore: null,
    connectionMode: 'board', phoneController: false, sessionCode: null,
    showFight: null, finished: false, log: [],
  });
  S().devStartFight('informatique_numerique', false, surface);
  S().fightBegin();
}

// Premier langage disponible dans le jeu d'énigmes (menu de choix stable).
function firstLang() {
  return languagesOf(hackData.puzzles)[0];
}

// Retrouve le puzzle joué par un camp à partir de sa vue publique (langage +
// lignes de code), puis renvoie les RÉPONSES ordonnées de ses trous — le secret
// n'est PAS exposé par le store, on le recalcule ici pour piloter le remplissage.
function answersFor(side) {
  const pub = S().showFight.hack.sides[side];
  const puzzle = hackData.puzzles.find(
    (p) => p.lang === pub.lang && JSON.stringify(p.lines) === JSON.stringify(pub.lines),
  );
  return puzzle ? puzzle.blanks.map((b) => b.answer) : null;
}
// Un token FAUX pour le trou courant d'un camp (un choix ≠ la bonne réponse).
function wrongTokenFor(side) {
  const pub = S().showFight.hack.sides[side];
  const answers = answersFor(side);
  const cur = pub.cur;
  const choices = pub.blanks[cur].choices;
  return choices.find((c) => c !== answers[cur]);
}

describe('Cyber-duel Hacking multi-surface (showFight.hack)', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('surface téléphone : fightBegin démarre un duel piloté par le store (langs null, pas démarré)', () => {
    startHackDuel('phone');
    const f = S().showFight;
    expect(f.phase).toBe('minigame');
    expect(f.hack).toBeTruthy();
    expect(f.hack.roundNo).toBe(1);
    expect(f.hack.started).toBe(false);
    expect(f.hack.langs).toEqual({ attacker: null, defender: null });
    expect(f.hack.sides).toEqual({ attacker: null, defender: null });
  });

  it('surface en ligne : le Cyber-duel démarre AUSSI (pas de repli éclair)', () => {
    startHackDuel('online');
    const f = S().showFight;
    expect(f.phase).toBe('minigame');
    expect(f.hack).toBeTruthy();   // hack a bien démarré en ligne
    expect(f.race).toBeFalsy();    // PAS le duel éclair de repli
  });

  it('choix de langage : un seul camp ne démarre pas ; les deux → énigmes servies (cur=0)', () => {
    startHackDuel('phone');
    const lang = firstLang();
    // Un seul camp choisit → pas encore démarré.
    S().hackDuelLang('attacker', lang);
    expect(S().showFight.hack.started).toBe(false);
    expect(S().showFight.hack.langs.attacker).toBe(lang);
    expect(S().showFight.hack.sides.attacker).toBeNull();
    // Le second camp choisit → le duel démarre, chaque camp a SON énigme.
    S().hackDuelLang('defender', lang);
    const h = S().showFight.hack;
    expect(h.started).toBe(true);
    expect(h.sides.attacker.lang).toBe(lang);
    expect(h.sides.defender.lang).toBe(lang);
    expect(h.sides.attacker.cur).toBe(0);
    expect(h.sides.attacker.filled).toEqual([]);
    expect(h.sides.attacker.breach).toBe(0);
    expect(Array.isArray(h.sides.attacker.blanks)).toBe(true);
  });

  it('re-choisir un langage est ignoré une fois fixé', () => {
    startHackDuel('phone');
    const [l0, l1] = languagesOf(hackData.puzzles);
    S().hackDuelLang('attacker', l0);
    S().hackDuelLang('attacker', l1 || l0); // ignoré : déjà choisi
    expect(S().showFight.hack.langs.attacker).toBe(l0);
  });

  it('bon token : cur avance et breach monte ; dernier trou → reveal + manche marquée', () => {
    startHackDuel('phone');
    const lang = firstLang();
    S().hackDuelLang('attacker', lang);
    S().hackDuelLang('defender', lang);
    const answers = answersFor('attacker');
    expect(answers && answers.length).toBeTruthy();
    // Remplit tous les trous SAUF le dernier : cur avance, breach monte.
    for (let i = 0; i < answers.length - 1; i++) {
      S().hackDuelPick('attacker', answers[i]);
      expect(S().showFight.hack.sides.attacker.cur).toBe(i + 1);
    }
    if (answers.length > 1) {
      expect(S().showFight.hack.sides.attacker.breach).toBeGreaterThan(0);
    }
    expect(S().showFight.hack.reveal).toBeNull();
    // Dernier trou → énigme résolue → révélation du vainqueur.
    S().hackDuelPick('attacker', answers[answers.length - 1]);
    expect(S().showFight.hack.reveal).toEqual({ winner: 'attacker' });
    expect(S().showFight.hack.sides.attacker.solved).toBe(true);
    expect(S().showFight.hack.sides.attacker.breach).toBe(100);
    expect(S().showFight.wins.attacker).toBe(0); // pas encore marqué (révélation)
    vi.advanceTimersByTime(HACK_REVEAL_MS);
    expect(S().showFight.wins.attacker).toBe(1); // manche marquée
    // Le combat continue (BO3) → nouvelle manche propre, reveal purgé.
    const nh = S().showFight.hack;
    expect(nh.reveal).toBeNull();
    expect(nh.roundNo).toBe(2);
    expect(nh.started).toBe(true);
    expect(nh.sides.attacker.cur).toBe(0);
  });

  it('mauvais token : verrou posé (denySeq++) puis relevé après la minuterie', () => {
    startHackDuel('phone');
    const lang = firstLang();
    S().hackDuelLang('attacker', lang);
    S().hackDuelLang('defender', lang);
    const before = S().showFight.hack.sides.attacker;
    const bad = wrongTokenFor('attacker');
    S().hackDuelPick('attacker', bad);
    const after = S().showFight.hack.sides.attacker;
    expect(after.locked).toBe(true);
    expect(after.denySeq).toBe((before.denySeq || 0) + 1);
    expect(after.cur).toBe(before.cur);       // pas d'avancée
    expect(after.breach).toBe(before.breach); // brèche inchangée
    vi.advanceTimersByTime(HACK_WRONG_HOLD_MS);
    expect(S().showFight.hack.sides.attacker.locked).toBe(false); // verrou relevé
  });

  it('anti-triche : le payload publie les choices mais AUCUN answer', () => {
    startHackDuel('phone');
    const lang = firstLang();
    S().hackDuelLang('attacker', lang);
    S().hackDuelLang('defender', lang);
    const hack = buildTurnPayload(S()).fight.hack;
    expect(hack).toBeTruthy();
    expect(hack.started).toBe(true);
    // Les choices (4 tokens) sont publiés, mais jamais le champ `answer`.
    const blanks = hack.sides.attacker.blanks;
    expect(Array.isArray(blanks)).toBe(true);
    expect(Array.isArray(blanks[0].choices)).toBe(true);
    expect(blanks[0].answer).toBeUndefined();
    const blob = JSON.stringify(hack);
    expect(blob).not.toContain('"answer"');
  });

  it('un intent turnHackPick est mappé au bon camp par jeton (pas de contrôle adverse)', () => {
    startHackDuel('phone');
    const f = S().showFight;
    const lang = firstLang();
    S().hackDuelLang('attacker', lang);
    S().hackDuelLang('defender', lang);
    const answersAtt = answersFor('attacker');
    // Le DÉFENSEUR (idx = defenderIndex) envoie le bon token de l'ATTAQUANT :
    // le routeur le mappe sur SON propre camp → n'affecte pas l'attaquant.
    // (Sauf coïncidence où le token vaut aussi la réponse du défenseur, le camp
    // attaquant reste à cur=0 ; on vérifie qu'il n'a PAS gagné via l'attaquant.)
    S().applyFightIntent(f.defenderIndex, 'turnHackPick', { token: answersAtt[0] });
    expect(S().showFight.hack.sides.attacker.cur).toBe(0); // l'attaquant n'a pas bougé
  });
});
