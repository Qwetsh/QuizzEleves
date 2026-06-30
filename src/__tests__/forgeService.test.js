// Tests de la PRESTATION DE FORGEAGE (troc + forge collaborative).
import { describe, it, expect, beforeEach, beforeAll } from 'vitest';
import { useGameStore } from '../store/gameStore.js';
import { saveGame, loadGame } from '../store/persistence.js';
import { defaultDieFaces, getDieFaces, isForgeServiceTrade } from '../logic/forge.js';

// localStorage minimal (l'env de test n'en fournit pas) pour le round-trip save/load.
beforeAll(() => {
  if (typeof globalThis.localStorage === 'undefined') {
    const mem = {};
    globalThis.localStorage = {
      getItem: (k) => (k in mem ? mem[k] : null),
      setItem: (k, v) => { mem[k] = String(v); },
      removeItem: (k) => { delete mem[k]; },
      clear: () => { for (const k of Object.keys(mem)) delete mem[k]; },
    };
  }
});

const S = () => useGameStore.getState();
const face = (value, slot) => ({ value, slot, effects: [] });

function setup({ customerMoney = 50 } = {}) {
  useGameStore.getState().reset();
  useGameStore.setState({
    phase: 'game', currentTeam: 2, // équipe active = un tiers (ni forgeron ni client)
    extensions: { equipment: true, forge: true, trade: true },
    forgeService: null,
    shopFaceStock: [], // pas de catalogue par défaut (faces = réserve du forgeron)
    teams: [
      { name: 'Forge', emoji: '🔨', money: 0, bag: [], equipment: {}, faceStock: [face(9, 3), face(2, 5)], dieFaces: defaultDieFaces(), token: 'tk-forge' },
      { name: 'Client', emoji: '🧑', money: customerMoney, bag: [], equipment: {}, faceStock: [], dieFaces: defaultDieFaces(), token: 'tk-cli' },
      { name: 'Tiers', emoji: '🦊', money: 10, bag: [], equipment: {}, faceStock: [], dieFaces: defaultDieFaces() },
    ],
  });
}
const TRADE = { from_idx: 0, to_idx: 1, give: { forge: true }, want: { gold: 20 } };

describe('isForgeServiceTrade', () => {
  it('détecte une offre de forgeage dans les deux sens (give.forge OU want.forge)', () => {
    expect(isForgeServiceTrade(TRADE)).toBe(true);
    expect(isForgeServiceTrade({ give: { gold: 5 }, want: { forge: true } })).toBe(true);
    expect(isForgeServiceTrade({ give: { gold: 5 }, want: {} })).toBe(false);
  });
});

describe('sens client → forgeron (want.forge)', () => {
  beforeEach(() => setup());
  it('le forgeron (destinataire) devient provider, le demandeur paie (give)', () => {
    // Le CLIENT (idx 1) demande au FORGERON (idx 0) de forger son dé.
    const req = { from_idx: 1, to_idx: 0, give: { gold: 15 }, want: { forge: true } };
    const res = S().startForgeService(req);
    expect(res.ok).toBe(true);
    const fs = S().forgeService;
    expect(fs.providerIdx).toBe(0); // le forgeron
    expect(fs.customerIdx).toBe(1); // le demandeur
    expect(fs.price).toEqual({ gold: 15 }); // paiement = give du demandeur
    expect(S().teams[0].faceStock).toEqual([]); // réserve du forgeron en escrow
  });
});

describe('startForgeService (escrow)', () => {
  beforeEach(() => setup());
  it('met la réserve du forgeron en escrow et ouvre la session', () => {
    const res = S().startForgeService(TRADE);
    expect(res.ok).toBe(true);
    expect(S().teams[0].faceStock).toEqual([]); // réserve vidée (escrow)
    const fs = S().forgeService;
    expect(fs.providerIdx).toBe(0);
    expect(fs.customerIdx).toBe(1);
    expect(fs.providerStock.filter((f) => f.src === 'reserve').length).toBe(2); // les 2 faces de réserve
    expect(fs.price).toEqual({ gold: 20 });
  });
  it('refuse si une session est déjà en cours', () => {
    S().startForgeService(TRADE);
    expect(S().startForgeService(TRADE).ok).toBe(false);
  });
  it('s’ouvre même sans réserve ni catalogue (catalogue généré à la volée)', () => {
    useGameStore.setState({ teams: S().teams.map((t, i) => (i === 0 ? { ...t, faceStock: [] } : t)), shopFaceStock: [] });
    const res = S().startForgeService(TRADE);
    expect(res.ok).toBe(true);
    expect(S().forgeService.providerStock.length).toBeGreaterThan(0); // faces du catalogue
  });
  it('s’ouvre même sans réserve si le catalogue boutique a des faces', () => {
    useGameStore.setState({
      teams: S().teams.map((t, i) => (i === 0 ? { ...t, faceStock: [] } : t)),
      shopFaceStock: [{ value: 7, slot: 4, effects: [] }],
    });
    const res = S().startForgeService(TRADE);
    expect(res.ok).toBe(true);
    expect(S().forgeService.providerStock.length).toBe(1); // 0 réserve + 1 catalogue
    expect(S().forgeService.providerStock[0].src).toBe('shop');
  });
});

describe('place / remove (brouillon)', () => {
  beforeEach(() => { setup(); S().startForgeService(TRADE); });
  it('pose une face sur son slot cible et réinitialise les validations', () => {
    useGameStore.setState({ forgeService: { ...S().forgeService, providerOk: true, customerOk: true } });
    S().forgeServicePlace(undefined, 0, 0); // face(9,3) → slot 3 (index 2)
    const fs = S().forgeService;
    expect(fs.placements).toEqual({ 2: 0 });
    expect(fs.providerOk).toBe(false);
    expect(fs.customerOk).toBe(false);
  });
  it('seul le forgeron peut poser', () => {
    S().forgeServicePlace(undefined, 0, 1); // le client tente → ignoré
    expect(S().forgeService.placements).toEqual({});
  });
  it('retire une face posée', () => {
    S().forgeServicePlace(undefined, 0, 0);
    S().forgeServiceRemove(2, 0);
    expect(S().forgeService.placements).toEqual({});
  });
});

describe('double validation → pose + paiement', () => {
  beforeEach(() => { setup(); S().startForgeService(TRADE); S().forgeServicePlace(undefined, 0, 0); });
  it('applique seulement quand les DEUX valident', () => {
    S().forgeServiceValidate(0);
    expect(S().forgeService).not.toBeNull(); // une seule validation
    S().forgeServiceValidate(1);
    expect(S().forgeService).toBeNull(); // appliqué
    // Face posée sur le dé du client (slot 3 = index 2).
    expect(getDieFaces(S().teams[1])[2]).toMatchObject({ base: 3, value: 9 });
    // Paiement transféré.
    expect(S().teams[1].money).toBe(30); // 50 - 20
    expect(S().teams[0].money).toBe(20); // 0 + 20
    // Face posée consommée ; face non posée RENDUE au forgeron.
    expect(S().teams[0].faceStock).toEqual([face(2, 5)]);
  });
  it('paiement impossible : session ouverte, validations réinitialisées + erreur signalée', () => {
    setup({ customerMoney: 5 }); S().startForgeService(TRADE); S().forgeServicePlace(undefined, 0, 0);
    S().forgeServiceValidate(0); S().forgeServiceValidate(1);
    const fs = S().forgeService;
    expect(fs).not.toBeNull(); // pas appliqué
    expect(fs.providerOk).toBe(false); // validations RÉINITIALISÉES (sinon figé sur ✅✅)
    expect(fs.customerOk).toBe(false);
    expect(fs.error).toBe('payment'); // erreur diffusée pour feedback
    expect(getDieFaces(S().teams[1])[2].value).toBe(3); // dé inchangé
  });
});

describe('garde fin de partie', () => {
  beforeEach(() => { setup(); S().startForgeService(TRADE); S().forgeServicePlace(undefined, 0, 0); });
  it('partie finie : validate/apply n’appliquent rien', () => {
    useGameStore.setState({ finished: true });
    S().forgeServiceValidate(0); S().forgeServiceValidate(1);
    expect(getDieFaces(S().teams[1])[2].value).toBe(3); // dé inchangé après la fin
  });
  it('closeForgeService rend l’escrow et clôt la session', () => {
    S().closeForgeService();
    expect(S().forgeService).toBeNull();
    expect(S().teams[0].faceStock).toEqual([face(9, 3), face(2, 5)]); // réserve rendue
    expect(S().teams[1].money).toBe(50); // aucun paiement
  });
});

describe('persistance (P0-1 : escrow non perdu au reload)', () => {
  it('save→load conserve forgeService (réserve en escrow, placements)', () => {
    setup(); S().startForgeService(TRADE); S().forgeServicePlace(undefined, 0, 0);
    saveGame(useGameStore.getState());
    const loaded = loadGame();
    expect(loaded.forgeService).not.toBeNull();
    expect(loaded.forgeService.placements).toEqual({ 2: 0 });
    expect(loaded.forgeService.providerStock.filter((f) => f.src === 'reserve').length).toBe(2);
    expect(loaded.teams[0].faceStock).toEqual([]); // escrow préservé (récupérable via forgeService)
  });
});

describe('annulation : escrow rendu, aucun paiement', () => {
  beforeEach(() => { setup(); S().startForgeService(TRADE); S().forgeServicePlace(undefined, 0, 0); });
  it('rend la réserve au forgeron et n’applique aucun paiement', () => {
    S().forgeServiceCancel(1); // le client annule
    expect(S().forgeService).toBeNull();
    expect(S().teams[0].faceStock).toEqual([face(9, 3), face(2, 5)]); // réserve rendue
    expect(S().teams[1].money).toBe(50); // pas de paiement
    expect(getDieFaces(S().teams[1])[2].value).toBe(3); // dé inchangé
  });
});
