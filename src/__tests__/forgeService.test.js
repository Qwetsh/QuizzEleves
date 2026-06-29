// Tests de la PRESTATION DE FORGEAGE (troc + forge collaborative).
import { describe, it, expect, beforeEach } from 'vitest';
import { useGameStore } from '../store/gameStore.js';
import { defaultDieFaces, getDieFaces, isForgeServiceTrade } from '../logic/forge.js';

const S = () => useGameStore.getState();
const face = (value, slot) => ({ value, slot, effects: [] });

function setup({ customerMoney = 50 } = {}) {
  useGameStore.getState().reset();
  useGameStore.setState({
    phase: 'game', currentTeam: 2, // équipe active = un tiers (ni forgeron ni client)
    extensions: { equipment: true, forge: true, trade: true },
    forgeService: null,
    teams: [
      { name: 'Forge', emoji: '🔨', money: 0, bag: [], equipment: {}, faceStock: [face(9, 3), face(2, 5)], dieFaces: defaultDieFaces(), token: 'tk-forge' },
      { name: 'Client', emoji: '🧑', money: customerMoney, bag: [], equipment: {}, faceStock: [], dieFaces: defaultDieFaces(), token: 'tk-cli' },
      { name: 'Tiers', emoji: '🦊', money: 10, bag: [], equipment: {}, faceStock: [], dieFaces: defaultDieFaces() },
    ],
  });
}
const TRADE = { from_idx: 0, to_idx: 1, give: { forge: true }, want: { gold: 20 } };

describe('isForgeServiceTrade', () => {
  it('détecte une offre de forgeage (give.forge)', () => {
    expect(isForgeServiceTrade(TRADE)).toBe(true);
    expect(isForgeServiceTrade({ give: { gold: 5 }, want: {} })).toBe(false);
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
    expect(fs.providerStock.length).toBe(2);
    expect(fs.price).toEqual({ gold: 20 });
  });
  it('refuse si une session est déjà en cours', () => {
    S().startForgeService(TRADE);
    expect(S().startForgeService(TRADE).ok).toBe(false);
  });
  it('refuse si le forgeron n’a aucune face en réserve', () => {
    useGameStore.setState({ teams: S().teams.map((t, i) => (i === 0 ? { ...t, faceStock: [] } : t)) });
    expect(S().startForgeService(TRADE).ok).toBe(false);
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
  it('paiement impossible : la session reste ouverte, dé inchangé', () => {
    setup({ customerMoney: 5 }); S().startForgeService(TRADE); S().forgeServicePlace(undefined, 0, 0);
    S().forgeServiceValidate(0); S().forgeServiceValidate(1);
    expect(S().forgeService).not.toBeNull(); // pas appliqué
    expect(getDieFaces(S().teams[1])[2].value).toBe(3); // dé inchangé (valeur d'origine)
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
