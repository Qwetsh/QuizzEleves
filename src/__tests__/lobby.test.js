// Tests : conversion des fiches de lobby (créées au téléphone) en setupTeams,
// + démarrage depuis le lobby (mode téléphone) + payload publié.
import { describe, it, expect } from 'vitest';
import { useGameStore, buildLobbySetupTeams } from '../store/gameStore.js';
import { buildSessionPayload, randomToken } from '../logic/sessionConfig.js';
import { BAG_SIZE } from '../store/itemHandlers.js';

const S = () => useGameStore.getState();

describe('buildLobbySetupTeams', () => {
  it('convertit les fiches, conserve le token et dé-doublonne les noms', () => {
    const rows = [
      { token: 'a', name: 'Lions', emoji: '🦁', color: '#f00', power_def: 'bouclier', power_off: 'foudre' },
      { token: 'b', name: 'Lions', emoji: '🐯' }, // doublon de nom
      { token: 'c', name: '', emoji: '🦅' },        // nom vide → défaut
    ];
    const teams = buildLobbySetupTeams(rows);
    expect(teams).toHaveLength(3);
    expect(teams[0].token).toBe('a');
    expect(teams[0].powerDef).toBe('bouclier');
    expect(teams[1].name).toBe('Lions 2');   // suffixe anti-doublon
    expect(teams[2].name).toBe('Équipe 3');  // nom vide → défaut
    expect(teams[2].color).toBeTruthy();      // couleur assignée par défaut
  });

  it('ignore les équipes retirées (removed)', () => {
    const teams = buildLobbySetupTeams([
      { token: 'a', name: 'A' },
      { token: 'b', name: 'B', removed: true },
    ]);
    expect(teams.map((t) => t.token)).toEqual(['a']);
  });

  it('dé-doublonne 3 noms identiques en X / X 2 / X 3', () => {
    const teams = buildLobbySetupTeams([
      { token: 'a', name: 'Z' }, { token: 'b', name: 'Z' }, { token: 'c', name: 'Z' },
    ]);
    expect(teams.map((t) => t.name)).toEqual(['Z', 'Z 2', 'Z 3']);
  });

  it('assigne des couleurs distinctes par défaut + bag/equipement vides au départ', () => {
    const teams = buildLobbySetupTeams([{ token: 'a', name: 'A' }, { token: 'b', name: 'B' }]);
    expect(teams[0].color).toBeTruthy();
    expect(teams[1].color).toBeTruthy();
    expect(teams[0].color).not.toBe(teams[1].color);
    expect(teams[0].money).toBe(0);
  });

  it('liste vide → aucune équipe', () => {
    expect(buildLobbySetupTeams([])).toEqual([]);
    expect(buildLobbySetupTeams(null)).toEqual([]);
  });
});

describe('startFromLobby', () => {
  it('démarre la partie ; lance direct si pouvoirs déjà choisis', () => {
    useGameStore.setState({
      phase: 'setup', devSandbox: true, log: [],
      lobbyTeams: [
        { token: 'a', name: 'Lions', emoji: '🦁', power_def: 'bouclier', power_off: 'foudre' },
        { token: 'b', name: 'Aigles', emoji: '🦅', power_def: 'indice', power_off: 'sablier' },
      ],
      boardParams: { casesParVoie: 4, nbVoies: 3, nbSections: 3, voieFinale: 'court-long', couloirsMix: 2, eventEveryX: 3 },
      level: ['cycle4'], useBrevet: false,
      starterChestConfig: undefined,
    });
    const ok = S().startFromLobby();
    expect(ok).toBe(true);
    // pouvoirs présents partout → on saute la sélection et on est en jeu
    expect(S().phase).toBe('game');
    expect(S().teams).toHaveLength(2);
    expect(S().teams[0].token).toBe('a');
    // pouvoir défensif finalisé (charges attribuées)
    expect(S().teams[0].powers.bouclier).toBeTruthy();
  });

  it('passe par la sélection des pouvoirs si certains manquent', () => {
    useGameStore.setState({
      phase: 'setup', devSandbox: true, log: [],
      lobbyTeams: [
        { token: 'a', name: 'Lions', emoji: '🦁', power_def: 'bouclier' }, // pas d'offensif
      ],
      boardParams: { casesParVoie: 4, nbVoies: 3, nbSections: 3, voieFinale: 'court-long', couloirsMix: 2, eventEveryX: 3 },
      level: ['cycle4'], useBrevet: false,
    });
    S().startFromLobby();
    expect(S().phase).toBe('powerSelect');
  });

  it('lobby vide → ne démarre pas (retourne false, reste en setup)', () => {
    useGameStore.setState({ phase: 'setup', lobbyTeams: [], log: [] });
    expect(S().startFromLobby()).toBe(false);
    expect(S().phase).toBe('setup');
  });

  it('génère le plateau et initialise le sac/équipement', () => {
    useGameStore.setState({
      phase: 'setup', devSandbox: true, log: [],
      lobbyTeams: [
        { token: 'a', name: 'Lions', power_def: 'bouclier', power_off: 'foudre' },
        { token: 'b', name: 'Aigles', power_def: 'indice', power_off: 'sablier' },
      ],
      boardParams: { casesParVoie: 4, nbVoies: 3, nbSections: 3, voieFinale: 'court-long', couloirsMix: 2, eventEveryX: 3 },
      level: ['cycle4'], useBrevet: false,
    });
    S().startFromLobby();
    expect(S().board).toBeTruthy();
    expect(S().teams[0].bag).toHaveLength(BAG_SIZE);
    expect(S().teams[0].equipment).toEqual({ head: null, body: null, feet: null });
    expect(S().teams[0].pos).toBe('depart');
  });
});

describe('connectionMode (garde de phase)', () => {
  it('modifiable au setup, ignoré en jeu', () => {
    useGameStore.setState({ phase: 'setup', connectionMode: 'board' });
    S().setConnectionMode('phone');
    expect(S().connectionMode).toBe('phone');
    useGameStore.setState({ phase: 'game' });
    S().setConnectionMode('board');
    expect(S().connectionMode).toBe('phone'); // ignoré hors setup
  });
});

describe('buildSessionPayload (sécurité + drapeaux)', () => {
  const teams = [{ name: 'Lions', emoji: '🦁', color: '#f00', token: 'SECRET', money: 5, equipment: { head: null, body: null, feet: null }, bag: [], powers: {} }];

  it('NE publie JAMAIS le token des équipes', () => {
    const p = buildSessionPayload({ teams, currentTeam: 0, status: 'playing', shopStock: [], log: [], extensions: null });
    expect(p.teams[0].token).toBeUndefined();
    expect(JSON.stringify(p)).not.toContain('SECRET');
  });

  it('propage le drapeau locked', () => {
    expect(buildSessionPayload({ teams, currentTeam: 0, status: 'playing', shopStock: [], log: [], locked: true }).locked).toBe(true);
    expect(buildSessionPayload({ teams, currentTeam: 0, status: 'playing', shopStock: [], log: [] }).locked).toBe(false);
  });

  it('aplatit les entrées de log structurées en texte', () => {
    const p = buildSessionPayload({ teams, currentTeam: 0, status: 'playing', shopStock: [], log: ['plain', { text: 'struct', detail: [] }] });
    expect(p.log).toEqual(['plain', 'struct']);
  });
});

describe('randomToken', () => {
  it('génère des jetons non vides et uniques', () => {
    const a = randomToken(); const b = randomToken();
    expect(a).toBeTruthy();
    expect(a).not.toBe(b);
  });
});
