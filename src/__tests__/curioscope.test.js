// Curioscope (P1) : registre d'univers, barème exponentiel, métriques geo/flat,
// tirage anti-répétition LRU (persisté par sauvegarde) et câblage du moteur
// dans le registre des mini-jeux de duel.
import { describe, it, expect } from 'vitest';
import {
  getUniverse, universeMetric, universeScore, pickSpot, CURIO_TARGET_SCORE,
  setCurioSpots, universeHasSpots, spotImageUrl,
} from '../data/universes.js';
import { rowsToSpots } from '../logic/spotsConfig.js';
import { getMinigame, getDefaultMinigame } from '../components/Fight/minigames';
import { SAVE_FIELDS } from '../store/persistence.js';
import { useGameStore } from '../store/gameStore.js';
import { runEffects } from '../store/effectEngine.js';
import { serializeSnapshot } from '../logic/onlineSnapshot.js';
import {
  parseSavedVariables, entriesToRows, mergeRows, parseCsv, toCsv, applyCalib,
} from '../../scripts/curioscope/snaplib.mjs';
import {
  maxZoomFor, levelSize, tileGrid, totalTiles, solveFrame,
} from '../../scripts/curioscope/tilelib.mjs';

const S = () => useGameStore.getState();

// --- Harnais moteur (même pattern qu'effects.test.js) ---------------------
const LINEAR = (() => {
  const b = { depart: { x: 0, y: 0, type: 'depart', next: ['n1'] } };
  for (let i = 1; i <= 8; i++) {
    b[`n${i}`] = { x: i, y: 0, type: 'subject', subject: 'maths', next: [i === 8 ? 'arrivee' : `n${i + 1}`] };
  }
  b.arrivee = { x: 9, y: 0, type: 'arrivee', next: [] };
  return b;
})();

const mkTeam = (i, over = {}) => ({
  name: `T${i}`, color: '#111', emoji: '🦁',
  pos: 'n4', correct: 0, wrong: 0, money: 50,
  powerDef: null, powerOff: null, powers: {},
  equipment: { head: null, body: null, feet: null }, bag: [],
  ...over,
});

function freshGame(overrides = [{}, {}]) {
  useGameStore.setState({
    phase: 'game', devSandbox: true, connectionMode: 'local',
    teams: overrides.map((o, i) => mkTeam(i, o)),
    currentTeam: 0, board: LINEAR, finished: false,
    askedQuestions: {}, questions: {}, log: [],
    pendingActions: null, showCurioChallenge: null, showTargetPicker: null,
    movePath: null, enabledItems: [], trapDepth: 0,
  });
}

const zset = (patch) => useGameStore.setState(patch);
const zget = () => S();
const exec = (actions, ctx = {}) => runEffects(zset, zget, actions, ctx);

const CHALLENGE = {
  action: 'startMinigame', minigame: 'curioscope', rounds: 2,
  tiers: [{ min: 4000, kind: 'money', n: 25 }, { min: 2000, kind: 'move', n: 2 }],
};

// Univers factice « plat » (préfigure WoW en P3) : carte 2:1, 100 lieues de haut.
const FLAT = { id: 'test_flat', crs: 'flat', map: { aspect: 2 }, mapUnits: 100, score: { max: 5000, freeDist: 5, k: 40 } };

// Univers factice pour le tirage : 3 spots photo + 2 spots « nom à placer ».
const mkPickable = (pickPlan) => ({
  id: 'test_pick', crs: 'flat', map: { aspect: 1 }, score: { max: 5000, freeDist: 1, k: 10 },
  pickPlan,
  spots: () => [
    { id: 'a', label: 'A', x: 0.1, y: 0.1, kind: 'photo' },
    { id: 'b', label: 'B', x: 0.2, y: 0.2, kind: 'photo' },
    { id: 'c', label: 'C', x: 0.3, y: 0.3, kind: 'photo' },
    { id: 'd', label: 'D', x: 0.4, y: 0.4, kind: 'label' },
    { id: 'e', label: 'E', x: 0.5, y: 0.5, kind: 'label' },
  ],
});

describe('universes — barème façon GeoGuessr', () => {
  const u = getUniverse('monde_reel');

  it('plein pot sous freeDist, puis décroissance exponentielle', () => {
    expect(universeScore(u, 0)).toBe(5000);
    expect(universeScore(u, 100)).toBe(5000);
    // 100 km au-delà du rayon gratuit + k=2000 → 5000·e^(−1) ≈ 1839 à d=2100
    expect(universeScore(u, 2100)).toBe(Math.round(5000 * Math.exp(-1)));
    expect(universeScore(u, 500)).toBeGreaterThan(universeScore(u, 1000));
    expect(universeScore(u, 20000)).toBeLessThan(50);
  });

  it('la cible de course est bien 10 000 pts (2 manches parfaites)', () => {
    expect(CURIO_TARGET_SCORE).toBe(10000);
  });
});

describe('universes — métriques', () => {
  it('geo : haversine cohérent (quart d\'équateur ≈ 10 000 km)', () => {
    const u = getUniverse('monde_reel');
    // {0.5, 0.5} = (lat 0, lon 0) ; {0.75, 0.5} = (lat 0, lon 90)
    const d = universeMetric(u, { x: 0.5, y: 0.5 }, { x: 0.75, y: 0.5 });
    expect(d).toBeGreaterThan(9900);
    expect(d).toBeLessThan(10100);
  });

  it('flat : euclidienne dans l\'espace carte, en lieues (hauteur = mapUnits)', () => {
    expect(universeMetric(FLAT, { x: 0, y: 0 }, { x: 0, y: 1 })).toBe(100); // toute la hauteur
    expect(universeMetric(FLAT, { x: 0, y: 0 }, { x: 1, y: 0 })).toBe(200); // toute la largeur (aspect 2)
    expect(universeMetric(FLAT, { x: 0.5, y: 0.5 }, { x: 0.5, y: 0.5 })).toBe(0);
  });
});

describe('pickSpot — alternance, LRU, exclusion intra-duel', () => {
  it('plan alternate : manche impaire = photo, paire = nom à placer', () => {
    const u = mkPickable('alternate');
    for (let i = 0; i < 5; i++) {
      expect(pickSpot(u, {}, 1).kind).toBe('photo');
      expect(pickSpot(u, {}, 2).kind).toBe('label');
    }
  });

  it('préfère toujours les spots jamais vus (seq 0)', () => {
    const u = mkPickable('alternate');
    // a et b déjà vus → seule c est « fraîche » côté photos
    for (let i = 0; i < 5; i++) {
      expect(pickSpot(u, { a: 1, b: 2 }, 1).id).toBe('c');
    }
  });

  it('tous vus → choisit le moins récemment vu', () => {
    const u = mkPickable('alternate');
    for (let i = 0; i < 5; i++) {
      expect(pickSpot(u, { a: 3, b: 1, c: 2 }, 1).id).toBe('b');
    }
  });

  it('exclut les spots déjà joués dans CE duel', () => {
    const u = mkPickable('alternate');
    for (let i = 0; i < 5; i++) {
      expect(pickSpot(u, {}, 1, new Set(['a', 'b'])).id).toBe('c');
    }
  });

  it('tout exclu → repli sur le pool complet (jamais null si spots existent)', () => {
    const u = mkPickable('alternate');
    expect(pickSpot(u, {}, 1, new Set(['a', 'b', 'c']))).not.toBeNull();
  });

  it('sans plan : tous les kinds confondus', () => {
    const u = mkPickable(undefined);
    const seen = { a: 1, b: 2, c: 3 }; // d et e jamais vus
    const got = new Set();
    for (let i = 0; i < 40; i++) got.add(pickSpot(u, seen, 1).id);
    expect([...got].sort()).toEqual(['d', 'e']);
  });
});

describe('monde_reel — banque de spots migrée du GeoDuel', () => {
  it('≥ 120 spots (90+ lieux photo + 50+ capitales), coordonnées valides, ids uniques', () => {
    const u = getUniverse('monde_reel');
    const spots = u.spots();
    expect(spots.length).toBeGreaterThanOrEqual(120);
    expect(spots.filter((s) => s.kind === 'photo').length).toBeGreaterThanOrEqual(80);
    expect(spots.filter((s) => s.kind === 'label').length).toBeGreaterThanOrEqual(50);
    for (const s of spots) {
      expect(s.x).toBeGreaterThanOrEqual(0);
      expect(s.x).toBeLessThanOrEqual(1);
      expect(s.y).toBeGreaterThanOrEqual(0);
      expect(s.y).toBeLessThanOrEqual(1);
    }
    expect(new Set(spots.map((s) => s.id)).size).toBe(spots.length);
  });
});

describe('registre des mini-jeux — thème geographie sur le moteur curioscope', () => {
  it('geographie → moteur à points, persistant, univers monde_reel', () => {
    const mg = getMinigame('geographie');
    expect(typeof mg.Component).toBe('function');
    expect(mg.pointsBased).toBe(true);
    expect(mg.persistent).toBe(true);
    expect(mg.content.universes).toEqual(['monde_reel']);
  });
});

describe('store — curioMarkSeen (anti-répétition persistée)', () => {
  it('marque avec un seq croissant, par univers', () => {
    useGameStore.setState({ devSandbox: false, curioSeen: {}, curioSeq: 0 });
    S().curioMarkSeen('u1', 's1');
    S().curioMarkSeen('u1', 's2');
    S().curioMarkSeen('u2', 's1');
    expect(S().curioSeen.u1.s1).toBe(1);
    expect(S().curioSeen.u1.s2).toBe(2);
    expect(S().curioSeen.u2.s1).toBe(3);
    expect(S().curioSeq).toBe(3);
  });

  it('re-voir un spot rafraîchit son ancienneté (LRU)', () => {
    useGameStore.setState({ devSandbox: false, curioSeen: {}, curioSeq: 0 });
    S().curioMarkSeen('u1', 's1');
    S().curioMarkSeen('u1', 's2');
    S().curioMarkSeen('u1', 's1');
    expect(S().curioSeen.u1.s1).toBe(3);
    expect(S().curioSeen.u1.s2).toBe(2);
  });

  it('no-op en bac à sable dev (simulateur de duel)', () => {
    useGameStore.setState({ devSandbox: true, curioSeen: {}, curioSeq: 0 });
    S().curioMarkSeen('u1', 's1');
    expect(S().curioSeen).toEqual({});
    expect(S().curioSeq).toBe(0);
    useGameStore.setState({ devSandbox: false });
  });

  it('l\'historique est persisté avec la sauvegarde', () => {
    expect(SAVE_FIELDS).toContain('curioSeen');
    expect(SAVE_FIELDS).toContain('curioSeq');
  });
});

describe('P3 — univers WoW dynamiques + garde-fou du registre', () => {
  it('les univers WoW existent en flat, vides tant que la DB n\'a rien livré', () => {
    setCurioSpots({});
    for (const id of ['wow_kalimdor', 'wow_royaumes_est']) {
      const u = getUniverse(id);
      expect(u.crs).toBe('flat');
      expect(u.unit).toBe('lieues');
      expect(u.spots()).toEqual([]);
      expect(universeHasSpots(id)).toBe(false);
    }
    expect(universeHasSpots('monde_reel')).toBe(true);
  });

  it('sans spots : le thème world_of_warcraft retombe sur le duel générique', () => {
    setCurioSpots({});
    expect(getMinigame('world_of_warcraft').Component).toBe(getDefaultMinigame().Component);
  });

  it('avec spots : le thème world_of_warcraft route vers le moteur curioscope', () => {
    setCurioSpots({ wow_kalimdor: [{ id: 's1', label: 'Orgrimmar', x: 0.6, y: 0.2, kind: 'photo', image: 'https://x/y.webp' }] });
    const mg = getMinigame('world_of_warcraft');
    expect(mg.pointsBased).toBe(true);
    expect(mg.content.universes).toEqual(['wow_kalimdor', 'wow_royaumes_est']);
    expect(getMinigame('geographie').pointsBased).toBe(true); // monde réel intact
    setCurioSpots({});
  });

  it('rowsToSpots : mapping DB → spots (chemin relatif → URL, actif filtré, bornes)', () => {
    const by = rowsToSpots([
      { id: 1, universe: 'wow_kalimdor', label: 'Portes d\'Orgrimmar', zone: 'Durotar', cx: '0.61234', cy: '0.21000', image_path: 'wow/s-abc.webp', difficulte: 1, actif: true },
      { id: 2, universe: 'wow_kalimdor', label: null, zone: 'Mulgore', cx: 0.4, cy: 0.6, image_path: 'https://ailleurs/x.webp', actif: true },
      { id: 3, universe: 'wow_kalimdor', cx: 0.5, cy: 0.5, image_path: 'wow/off.webp', actif: false },
      { id: 4, universe: 'wow_royaumes_est', cx: 1.7, cy: 0.5, image_path: 'wow/oob.webp', actif: true },
    ]);
    expect(by.wow_kalimdor).toHaveLength(2);
    expect(by.wow_kalimdor[0]).toMatchObject({ id: 's1', label: 'Portes d\'Orgrimmar', x: 0.61234, y: 0.21, kind: 'photo' });
    expect(by.wow_kalimdor[0].image).toBe(spotImageUrl('wow/s-abc.webp'));
    expect(by.wow_kalimdor[0].image).toMatch(/^https:\/\/.+\/quete-spots\/wow\/s-abc\.webp$/);
    expect(by.wow_kalimdor[1].label).toBe('Mulgore'); // repli sur la zone
    expect(by.wow_kalimdor[1].image).toBe('https://ailleurs/x.webp'); // URL absolue conservée
    expect(by.wow_royaumes_est).toBeUndefined(); // hors bornes écarté
  });
});

describe('duel Curioscope piloté par le store (surfaces téléphones / en ligne)', () => {
  const SPOTS = {
    wow_kalimdor: [
      { id: 'k1', label: 'Orgrimmar', x: 0.6, y: 0.2, kind: 'photo', image: 'https://x/k1.webp' },
      { id: 'k2', label: 'Pitons', x: 0.5, y: 0.4, kind: 'photo', image: 'https://x/k2.webp' },
      { id: 'k3', label: 'Tanaris', x: 0.55, y: 0.8, kind: 'photo', image: 'https://x/k3.webp' },
    ],
  };

  function startVersus(over = {}) {
    freshGame();
    setCurioSpots(SPOTS);
    useGameStore.setState({
      connectionMode: 'online', phoneController: false,
      showFight: {
        attackerIndex: 0, defenderIndex: 1, subject: 'world_of_warcraft',
        phase: 'versus', round: 1, wins: { attacker: 0, defender: 0 },
        winnerSide: null, reward: null, resultMessage: null,
      },
      ...over,
    });
    S().fightBegin();
  }

  it('en ligne : fightBegin route le thème curioscope vers le duel store (pas le duel éclair)', () => {
    startVersus();
    const f = S().showFight;
    expect(f.phase).toBe('minigame');
    expect(f.race).toBeUndefined();
    expect(f.curio).toBeTruthy();
    expect(f.curio.target.universe).toBe('wow_kalimdor');
    expect(f.curio.target.image).toBe(SPOTS.wow_kalimdor.find((s) => s.id === f.curio.target.id).image);
    setCurioSpots({});
  });

  it('mode « écran + téléphones » : même routage ; tactile : briefing (moteur composant)', () => {
    startVersus({ connectionMode: 'board', phoneController: true });
    expect(S().showFight.curio).toBeTruthy();
    startVersus({ connectionMode: 'board', phoneController: false });
    expect(S().showFight.phase).toBe('briefing');
    expect(S().showFight.curio).toBeUndefined();
    setCurioSpots({});
  });

  it('commit-reveal : chaque camp valide, révélation quand les deux ont joué, scores cumulés', () => {
    startVersus();
    const t = S().showFight.curio.target;
    S().curioDuelValidate('attacker', { x: t.x, y: t.y }); // pile dessus
    expect(S().showFight.curio.reveal).toBeNull();
    expect(S().showFight.curio.validated.attacker).toBe(true);
    S().curioDuelValidate('defender', { x: Math.abs(t.x - 0.4), y: Math.abs(t.y - 0.3) });
    const c = S().showFight.curio;
    expect(c.reveal).toBeTruthy();
    expect(c.reveal.pA).toBe(5000);
    expect(c.scores.attacker).toBe(5000);
    expect(c.scores.defender).toBe(c.reveal.pB);
    // Manche suivante : nouvelle cible, marques remises à zéro
    S().curioDuelNext();
    const c2 = S().showFight.curio;
    expect(c2.roundNo).toBe(2);
    expect(c2.reveal).toBeNull();
    expect(c2.marks.attacker).toBeNull();
    expect(c2.target.id).not.toBe(t.id); // exclusion intra-duel
    setCurioSpots({});
  });

  it('victoire directe à 10 000 pts au passage de manche', () => {
    startVersus();
    const f = S().showFight;
    useGameStore.setState({ showFight: { ...f, curio: { ...f.curio, scores: { attacker: 5100, defender: 0 } } } });
    const t = S().showFight.curio.target;
    S().curioDuelValidate('attacker', { x: t.x, y: t.y });
    S().curioDuelValidate('defender', { x: 0.05, y: 0.95 });
    S().curioDuelNext();
    expect(S().showFight.winnerSide).toBe('attacker');
    expect(S().showFight.phase).toBe('reward');
    setCurioSpots({});
  });

  it('intents : le DÉFENSEUR valide depuis son écran (hors verrou équipe active), en ligne et en mode téléphones', () => {
    for (const over of [{ connectionMode: 'online' }, { connectionMode: 'board', phoneController: true }]) {
      startVersus(over);
      useGameStore.setState({ teams: S().teams.map((tm, i) => ({ ...tm, token: `TK${i}` })) });
      const t = S().showFight.curio.target;
      S().applyTeamIntent('TK1', 'turnCurioValidate', { x: t.x, y: t.y }); // défenseur (idx 1)
      expect(S().showFight.curio.validated.defender).toBe(true);
      S().applyTeamIntent('TK0', 'turnCurioValidate', { x: 0.1, y: 0.1 });
      expect(S().showFight.curio.reveal).toBeTruthy();
      // « Suivant » : UN camp ne suffit pas — il faut les DEUX (ou l'écran partagé).
      S().applyTeamIntent('TK1', 'turnCurioNext', {});
      expect(S().showFight.curio.roundNo).toBe(1);
      expect(S().showFight.curio.nextReady).toEqual({ attacker: false, defender: true });
      S().applyTeamIntent('TK1', 'turnCurioNext', {}); // double-clic du même camp : no-op
      expect(S().showFight.curio.roundNo).toBe(1);
      S().applyTeamIntent('TK0', 'turnCurioNext', {});
      expect(S().showFight.curio.roundNo).toBe(2);
      expect(S().showFight.curio.nextReady).toEqual({ attacker: false, defender: false }); // remis à zéro
    }
    setCurioSpots({});
  });

  it('« Suivant » sans camp (bouton écran partagé = autorité) : avance directe', () => {
    startVersus();
    const t = S().showFight.curio.target;
    S().curioDuelValidate('attacker', { x: t.x, y: t.y });
    S().curioDuelValidate('defender', { x: 0.1, y: 0.9 });
    expect(S().showFight.curio.reveal).toBeTruthy();
    S().curioDuelNext();
    expect(S().showFight.curio.roundNo).toBe(2);
    setCurioSpots({});
  });

  it('anti-triche : le snapshot en ligne strippe cible et marques avant révélation', () => {
    startVersus();
    S().curioDuelValidate('attacker', { x: 0.6, y: 0.2 });
    let snap = serializeSnapshot(useGameStore.getState());
    expect(snap.showFight.curio.target.x).toBeNull();
    expect(snap.showFight.curio.target.label).toBeNull(); // spot photo : label secret
    expect(snap.showFight.curio.target.image).toBeTruthy(); // la photo, elle, est l'énoncé
    expect(snap.showFight.curio.marks.attacker).toBeNull();
    expect(snap.showFight.curio.validated.attacker).toBe(true);
    // Après révélation : tout est public
    S().curioDuelValidate('defender', { x: 0.1, y: 0.9 });
    snap = serializeSnapshot(useGameStore.getState());
    expect(snap.showFight.curio.target.x).not.toBeNull();
    expect(snap.showFight.curio.marks.attacker).toBeTruthy();
    setCurioSpots({});
  });
});

describe('P3 — pipeline snaplib (parse SavedVariables → CSV)', () => {
  const LUA = `
CurioSnapDB = {
\t{
\t\t["t"] = "071726_213045",
\t\t["map"] = 1412,
\t\t["zone"] = "Mulgore",
\t\t["x"] = 47.24,
\t\t["y"] = 60.11,
\t\t["cont"] = 1414,
\t\t["contName"] = "Kalimdor",
\t\t["cx"] = 0.44851,
\t\t["cy"] = 0.63423,
\t}, -- [1]
\t{
\t\t["t"] = "071726_213412",
\t\t["map"] = 1458,
\t\t["zone"] = "Fossoyeuse",
\t\t["x"] = 50,
\t\t["y"] = 50,
\t}, -- [2] (souterrain : pas de position continent)
}
`;

  it('parse les entrées (avec et sans continent)', () => {
    const e = parseSavedVariables(LUA);
    expect(e).toHaveLength(2);
    expect(e[0]).toMatchObject({ t: '071726_213045', map: 1412, zone: 'Mulgore', cont: 1414, cx: 0.44851, cy: 0.63423 });
    expect(e[1].cont).toBeUndefined();
  });

  it('entriesToRows : univers résolu, image appariée par t, actif=0 si incomplet', () => {
    const e = parseSavedVariables(LUA);
    const rows = entriesToRows(e, new Map([['071726_213045', 'WoWScrnShot_071726_213045.jpg']]));
    expect(rows[0]).toMatchObject({ universe: 'wow_kalimdor', fichier: 'WoWScrnShot_071726_213045.jpg', label: 'Mulgore', actif: 1 });
    expect(rows[1].actif).toBe(0); // pas d'image + pas de continent
  });

  it('appariement TOLÉRANT ±2 s (l\'addon horodate parfois 1 s après le fichier)', () => {
    const e = parseSavedVariables(LUA); // t = 071726_213045
    const rows = entriesToRows(e, new Map([['071726_213044', 'WoWScrnShot_071726_213044.jpg']]));
    expect(rows[0].fichier).toBe('WoWScrnShot_071726_213044.jpg');
    // hors tolérance → pas apparié ; et une image n'est servie qu'une fois
    const far = entriesToRows(e, new Map([['071726_213050', 'WoWScrnShot_071726_213050.jpg']]));
    expect(far[0].fichier).toBe('');
    const dupes = entriesToRows(
      [...e, { ...e[0] }],
      new Map([['071726_213045', 'a.jpg']]),
    );
    expect(dupes.filter((r) => r.fichier === 'a.jpg')).toHaveLength(1);
  });

  it('CSV aller-retour + fusion qui préserve les lignes éditées', () => {
    const e = parseSavedVariables(LUA);
    const rows = entriesToRows(e, new Map([['071726_213045', 'WoWScrnShot_071726_213045.jpg']]));
    const parsed = parseCsv(toCsv(rows));
    expect(parsed).toHaveLength(2);
    expect(parsed[0].universe).toBe('wow_kalimdor');
    // L'utilisateur édite le label puis relance parse-snaps : sa ligne est conservée.
    parsed[0].label = 'Village de Camp Narache';
    const merged = mergeRows(parsed, entriesToRows(e, new Map()));
    expect(merged).toHaveLength(2);
    expect(merged[0].label).toBe('Village de Camp Narache');
  });

  it('applyCalib : identité par défaut, affine bornée sinon', () => {
    expect(applyCalib(0.4, 0.6)).toEqual({ cx: 0.4, cy: 0.6 });
    const c = applyCalib(0.5, 0.5, { ax: 2, bx: -0.2, ay: 1, by: 0.6 });
    expect(c.cx).toBeCloseTo(0.8);
    expect(c.cy).toBe(1); // borné à 1
  });
});

describe('P3 — tilelib (pyramide de tuiles « satellite »)', () => {
  it('maxZoomFor / levelSize : pyramide standard 256 px', () => {
    expect(maxZoomFor(1002, 668)).toBe(2);   // 1002/256 → 4 tuiles de large → z=2
    expect(maxZoomFor(16384, 10922)).toBe(6);
    expect(maxZoomFor(200, 100)).toBe(0);    // tient dans une tuile
    expect(levelSize(1002, 668, 2, 2)).toEqual({ w: 1002, h: 668 });
    expect(levelSize(1002, 668, 0, 2)).toEqual({ w: 251, h: 167 });
  });

  it('tileGrid : couvre toute l\'image, tuiles de bord tronquées', () => {
    const grid = tileGrid(1002, 668, 2, 2);
    expect(grid).toHaveLength(12); // 4×3
    const last = grid[grid.length - 1];
    expect(last).toMatchObject({ x: 3, y: 2, w: 1002 - 3 * 256, h: 668 - 2 * 256 });
    expect(totalTiles(1002, 668, 2)).toBe(12 + 4 + 1);
  });

  it('solveFrame : résout le cadre uiMap depuis 2 points de référence', () => {
    // Cadre réel : left=100, top=50, 2000×1200 → deux lieux connus dessus.
    const refs = [
      { cx: 0.2, cy: 0.25, px: 100 + 0.2 * 2000, py: 50 + 0.25 * 1200 },
      { cx: 0.8, cy: 0.75, px: 100 + 0.8 * 2000, py: 50 + 0.75 * 1200 },
    ];
    expect(solveFrame(refs)).toEqual({ left: 100, top: 50, width: 2000, height: 1200 });
    expect(() => solveFrame([refs[0]])).toThrow();
    expect(() => solveFrame([refs[0], { ...refs[0] }])).toThrow(); // dégénéré
  });

  it('les univers WoW sont configurés en mode tuiles', () => {
    for (const id of ['wow_kalimdor', 'wow_royaumes_est']) {
      const m = getUniverse(id).map;
      expect(m.type).toBe('tiles');
      expect(m.path).toBe(`maps/${id}`);
      expect(m.maxNativeZoom).toBeGreaterThanOrEqual(2);
      expect(m.w / m.h).toBeCloseTo(1.5, 1);
    }
  });
});

describe('action startMinigame — défi Curioscope solo (P2)', () => {
  it('suspend la file et ouvre la modale de défi', () => {
    freshGame();
    exec([CHALLENGE], { source: 'item' });
    expect(S().showCurioChallenge).toEqual({ teamIndex: 0, universes: ['monde_reel'], rounds: 2 });
    expect(S().pendingActions).toBeTruthy();
  });

  it('palier haut : le total est converti en or (action money injectée)', () => {
    freshGame();
    exec([CHALLENGE], { source: 'item' });
    S().curioChallengeResolve(4500);
    expect(S().showCurioChallenge).toBeNull();
    expect(S().pendingActions).toBeNull(); // file vidée après conversion
    expect(S().teams[0].money).toBe(75); // 50 + 25
  });

  it('palier intermédiaire : avance de N cases', () => {
    freshGame();
    exec([CHALLENGE], { source: 'item' });
    S().curioChallengeResolve(2300);
    expect(S().teams[0].money).toBe(50); // pas d'or
    expect(S().teams[0].pos).toBe('n6'); // n4 + 2 cases
  });

  it('sous tous les paliers : aucune récompense', () => {
    freshGame();
    exec([CHALLENGE], { source: 'item' });
    S().curioChallengeResolve(500);
    expect(S().teams[0].money).toBe(50);
    expect(S().teams[0].pos).toBe('n4');
    expect(S().pendingActions).toBeNull();
  });

  it('un palier min 0 sert de filet (loot par défaut possible)', () => {
    freshGame();
    exec([{ ...CHALLENGE, tiers: [{ min: 0, kind: 'money', n: 5 }] }], { source: 'item' });
    S().curioChallengeResolve(0);
    expect(S().teams[0].money).toBe(55);
  });

  it('équipe bot : défi sauté proprement (pas de modale, file terminée)', () => {
    freshGame([{ isBot: true }, {}]);
    exec([CHALLENGE], { source: 'item' });
    expect(S().showCurioChallenge).toBeNull();
    expect(S().pendingActions).toBeNull();
  });

  it('mode en ligne : défi sauté proprement', () => {
    freshGame();
    useGameStore.setState({ connectionMode: 'online' });
    exec([CHALLENGE], { source: 'item' });
    expect(S().showCurioChallenge).toBeNull();
    expect(S().pendingActions).toBeNull();
    useGameStore.setState({ connectionMode: 'local' });
  });

  it('les actions suivantes de la file reprennent après la conversion', () => {
    freshGame();
    exec([CHALLENGE, { action: 'money', mode: 'gain', target: 'self', n: 3, unit: 'flat' }], { source: 'item' });
    S().curioChallengeResolve(4500);
    expect(S().teams[0].money).toBe(78); // 50 + 25 (palier) + 3 (action suivante)
  });
});
